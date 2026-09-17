// ═══════════════════════════════════════════════════════════════
//  WATENKABAB — Supabase Konfiguration
// ═══════════════════════════════════════════════════════════════
//  Einrichtung (einmalig, 5 Minuten) — siehe auch SETUP.md:
//
//  1. Kostenloses Konto auf https://supabase.com erstellen
//  2. "New Project" → Name: watenkabab → Region: Frankfurt (eu-central-1)
//  3. Project URL + anon/publishable key unten eintragen
//     (Settings → API → Project URL & anon public key)
//  4. SQL Editor → "New Query" → Inhalt von schema.sql einfügen → Run
//  5. Authentication → Users → "Invite user" → deine E-Mail
//     Passwort setzen → damit kannst du dich in admin.html anmelden
// ═══════════════════════════════════════════════════════════════

// TODO: Werte des NEUEN watenkabab-Supabase-Projekts eintragen (NICHT die von Injera!)
window.SUPABASE_URL = 'https://DEIN-PROJEKT-REF.supabase.co';
window.SUPABASE_KEY = 'DEIN-SUPABASE-ANON-PUBLISHABLE-KEY';

// ── Stripe Online-Zahlung ─────────────────────────────────────
//  1. Kostenloses Konto auf https://stripe.com erstellen
//  2. Dashboard → Developers → API Keys → Publishable key kopieren
//  3. Den Key unten eintragen (beginnt mit pk_live_ oder pk_test_)
window.STRIPE_PK = ''; // <-- HIER deinen Stripe Publishable Key eintragen

// Restaurant-Einstellungen
window.RES_CONFIG = {
  maxGuestsPerSlot     : 20,
  maxAutoConfirmGuests : 9,  // ≤9 → sofort bestätigt; ≥10 → pending (Admin muss bestätigen)
  closedDays           : [], // Ruhetage werden über Admin → Einstellungen → Öffnungszeiten gesteuert
  from                 : 13,  // Öffnung 13:00 Uhr
  to                   : 22,  // Schließung 22:00 Uhr (Fr/Sa 23:00 via DB schedule)
  slotInterval         : 30,
  maxAdvanceDays       : 60,
};

/* ─────────────────────────────────────────────────────────────
   SQL — VOLLSTÄNDIGES SCHEMA — in Supabase SQL-Editor einfügen:
   ─────────────────────────────────────────────────────────────

-- ── 1. Tische ────────────────────────────────────────────────
create table if not exists tables (
  id        serial   primary key,
  name      text     not null,
  capacity  int      not null default 4,
  section   text     not null default 'innen',   -- innen | aussen | bar | vip
  active    boolean  not null default true,
  pos_x     int      not null default 10,        -- Tischplan-Position X (%)
  pos_y     int      not null default 10         -- Tischplan-Position Y (%)
);

alter table tables enable row level security;

create policy "auth_all_tables"
  on tables for all to authenticated using (true) with check (true);

create policy "anon_read_tables"
  on tables for select to anon using (true);

-- ── 2. Reservierungen ────────────────────────────────────────
create table if not exists reservations (
  id          bigserial    primary key,
  created_at  timestamptz  default now(),
  name        text         not null,
  phone       text         not null,
  email       text,
  guests      int          not null,
  date        date         not null,
  time        text         not null,
  note        text,
  status      text         default 'pending',    -- pending | confirmed | cancelled
  table_id    int          references tables(id) on delete set null,
  table_ids   int[]        default '{}'
);

alter table reservations enable row level security;

create policy "anon_read_reservations"
  on reservations for select to anon using (true);

create policy "anon_insert_reservations"
  on reservations for insert to anon with check (status = 'pending');

create policy "auth_all_reservations"
  on reservations for all to authenticated using (true);

-- ── 3. Gesperrte Slots ───────────────────────────────────────
create table if not exists blocked_slots (
  id      serial  primary key,
  date    date    not null,
  time    text,
  reason  text
);

alter table blocked_slots enable row level security;

create policy "anon_read_blocked"
  on blocked_slots for select to anon using (true);

create policy "auth_all_blocked"
  on blocked_slots for all to authenticated using (true);

-- ── 4. Atomare Kapazitätsprüfung ────────────────────────────
create or replace function insert_reservation_safe(
  p_name text, p_phone text, p_email text, p_guests int,
  p_date date, p_time text, p_note text, p_max_guests int,
  p_auto_confirm_max int default 9
) returns bigint language plpgsql security definer as $$
declare
  booked   int;
  new_id   bigint;
  p_status text;
  p_table  int;
begin
  perform pg_advisory_xact_lock(hashtext(p_date::text || '|' || p_time));

  select coalesce(sum(guests),0) into booked
    from reservations
    where date=p_date and time=p_time and status<>'cancelled';

  if booked + p_guests > p_max_guests then
    raise exception 'Slot ausgebucht: noch % Plätze frei', greatest(0, p_max_guests - booked);
  end if;

  p_status := case when p_guests <= p_auto_confirm_max then 'confirmed' else 'pending' end;

  if p_guests <= p_auto_confirm_max then
    select t.id into p_table
      from tables t
      where t.active = true
        and t.capacity >= p_guests
        and t.id not in (
          select r.table_id
          from reservations r
          where r.date = p_date
            and r.time = p_time
            and r.status <> 'cancelled'
            and r.table_id is not null
        )
      order by t.capacity asc, t.id asc
      limit 1;
  end if;

  insert into reservations(name,phone,email,guests,date,time,note,status,table_id)
    values(p_name,p_phone,p_email,p_guests,p_date,p_time,p_note,p_status,p_table)
    returning id into new_id;

  return new_id;
end;
$$;

grant execute on function insert_reservation_safe to anon;

-- ── 5. Stornierung ───────────────────────────────────────────
-- p_cancel_hours: konfigurierbare Stornierungsfrist (0 = jederzeit, default 2)
create or replace function check_cancellable_reservation(
  p_id bigint,
  p_cancel_hours int default 2
)
returns jsonb language plpgsql security definer as $$
declare
  r   reservations%rowtype;
  dt  timestamp;
  h_label text;
begin
  select * into r from reservations where id=p_id;
  if not found then
    return jsonb_build_object('ok',false,'error','Reservierung nicht gefunden.');
  end if;
  if r.status='cancelled' then
    return jsonb_build_object('ok',false,'error','Diese Reservierung wurde bereits storniert.');
  end if;
  dt := (r.date::text||' '||r.time)::timestamp;
  if dt < (now() at time zone 'Europe/Berlin') then
    return jsonb_build_object('ok',false,'error','Diese Reservierung liegt in der Vergangenheit.');
  end if;
  if p_cancel_hours > 0 and dt - (now() at time zone 'Europe/Berlin') < (p_cancel_hours || ' hours')::interval then
    h_label := case when p_cancel_hours = 1 then '1 Stunde' else p_cancel_hours || ' Stunden' end;
    return jsonb_build_object('ok',false,'error','Stornierungen sind nur bis ' || h_label || ' vor dem Termin möglich. Bitte rufen Sie uns an: +49 1575 1644776');
  end if;
  return jsonb_build_object('ok',true,'name',r.name,'date',r.date::text,'time',r.time,'guests',r.guests);
end;
$$;
grant execute on function check_cancellable_reservation to anon;

create or replace function cancel_reservation_by_id(
  p_id bigint,
  p_cancel_hours int default 2
)
returns jsonb language plpgsql security definer as $$
declare
  r   reservations%rowtype;
  dt  timestamp;
  h_label text;
begin
  select * into r from reservations where id=p_id;
  if not found then
    return jsonb_build_object('ok',false,'error','Reservierung nicht gefunden.');
  end if;
  if r.status='cancelled' then
    return jsonb_build_object('ok',false,'error','Diese Reservierung wurde bereits storniert.');
  end if;
  dt := (r.date::text||' '||r.time)::timestamp;
  if dt < (now() at time zone 'Europe/Berlin') then
    return jsonb_build_object('ok',false,'error','Diese Reservierung liegt in der Vergangenheit.');
  end if;
  if p_cancel_hours > 0 and dt - (now() at time zone 'Europe/Berlin') < (p_cancel_hours || ' hours')::interval then
    h_label := case when p_cancel_hours = 1 then '1 Stunde' else p_cancel_hours || ' Stunden' end;
    return jsonb_build_object('ok',false,'error','Stornierungen sind nur bis ' || h_label || ' vor dem Termin möglich. Bitte rufen Sie uns an: +49 1575 1644776');
  end if;
  update reservations set status='cancelled' where id=p_id;
  return jsonb_build_object('ok',true,'name',r.name,'date',r.date::text,'time',r.time,'guests',r.guests);
end;
$$;
grant execute on function cancel_reservation_by_id to anon;

-- ── 6. Beispiel-Tische ───────────────────────────────────────
insert into tables (name, capacity, section, pos_x, pos_y) values
  ('T1',  2, 'innen',  8,  12),
  ('T2',  4, 'innen',  8,  38),
  ('T3',  4, 'innen',  8,  62),
  ('T4',  6, 'innen', 30,  12),
  ('T5',  4, 'innen', 30,  38),
  ('T6',  4, 'innen', 30,  62),
  ('T7',  2, 'innen', 52,  12),
  ('T8',  4, 'innen', 52,  38),
  ('A1',  4, 'aussen', 68, 12),
  ('A2',  4, 'aussen', 68, 40),
  ('A3',  6, 'aussen', 68, 68),
  ('BAR', 3, 'bar',    52, 75);

-- ── 7. Einstellungen ─────────────────────────────────────────
create table if not exists settings (
  key   text primary key,
  value jsonb not null
);
alter table settings enable row level security;
create policy "anon_read_settings"  on settings for select to anon using (true);
create policy "auth_all_settings"   on settings for all to authenticated using (true);

-- ── 8. Bestellungen (Online-Bestellungen) ────────────────────
create table if not exists bestellungen (
  id           bigserial    primary key,
  created_at   timestamptz  default now(),
  name         text         not null,
  phone        text         not null,
  email        text,
  type         text         default 'Abholung',
  items        jsonb        not null,
  total        numeric      not null,
  notes        text,
  prep_minutes int,                          -- vom Admin vergebene Vorbereitungszeit (Min.)
  status       text         default 'neu'    -- neu | zubereitung | fertig | abgeholt
);
alter table bestellungen enable row level security;
create policy "anon_insert_bestellungen" on bestellungen for insert to anon with check (true);
create policy "auth_all_bestellungen"   on bestellungen for all to authenticated using (true);

   ───────────────────────────────────────────────────────────── */
