-- ═══════════════════════════════════════════════════════════════
--  WATENKABAB — Vollständiges Supabase-Schema
--  → Neues Supabase-Projekt anlegen, dann SQL-Editor → "New Query"
--    → diesen kompletten Inhalt einfügen → "Run".
--
--  Enthält: Tische, Reservierungen, gesperrte Slots, Einstellungen,
--  Online-Bestellungen + alle RPC-Funktionen (Kapazitätsprüfung,
--  Stornierung). Idempotent — kann mehrfach ausgeführt werden.
--
--  HINWEIS: Die Telefonnummer in den Storno-Meldungen (unten, 2×)
--  vor dem Deploy auf die watenkabab-Nummer anpassen.
-- ═══════════════════════════════════════════════════════════════

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

drop policy if exists "auth_all_tables" on tables;
create policy "auth_all_tables"
  on tables for all to authenticated using (true) with check (true);

drop policy if exists "anon_read_tables" on tables;
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

drop policy if exists "anon_read_reservations" on reservations;
create policy "anon_read_reservations"
  on reservations for select to anon using (true);

drop policy if exists "anon_insert_reservations" on reservations;
create policy "anon_insert_reservations"
  on reservations for insert to anon with check (status = 'pending');

drop policy if exists "auth_all_reservations" on reservations;
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

drop policy if exists "anon_read_blocked" on blocked_slots;
create policy "anon_read_blocked"
  on blocked_slots for select to anon using (true);

drop policy if exists "auth_all_blocked" on blocked_slots;
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
drop function if exists check_cancellable_reservation(bigint);
drop function if exists check_cancellable_reservation(bigint, int);
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
    return jsonb_build_object('ok',false,'error','Stornierungen sind nur bis ' || h_label || ' vor dem Termin möglich. Bitte rufen Sie uns an: +49 XXX XXXXXXX');
  end if;
  return jsonb_build_object('ok',true,'name',r.name,'date',r.date::text,'time',r.time,'guests',r.guests);
end;
$$;
grant execute on function check_cancellable_reservation to anon;

drop function if exists cancel_reservation_by_id(bigint);
drop function if exists cancel_reservation_by_id(bigint, int);
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
    return jsonb_build_object('ok',false,'error','Stornierungen sind nur bis ' || h_label || ' vor dem Termin möglich. Bitte rufen Sie uns an: +49 XXX XXXXXXX');
  end if;
  update reservations set status='cancelled' where id=p_id;
  return jsonb_build_object('ok',true,'name',r.name,'date',r.date::text,'time',r.time,'guests',r.guests);
end;
$$;
grant execute on function cancel_reservation_by_id to anon;

-- ── 6. Beispiel-Tische (optional — später im Admin anpassbar) ─
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
drop policy if exists "anon_read_settings" on settings;
create policy "anon_read_settings"  on settings for select to anon using (true);
drop policy if exists "auth_all_settings" on settings;
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
-- idempotente Spalten (falls Tabelle bereits existiert)
alter table bestellungen add column if not exists email        text;
alter table bestellungen add column if not exists prep_minutes int;

alter table bestellungen enable row level security;
drop policy if exists "anon_insert_bestellungen" on bestellungen;
create policy "anon_insert_bestellungen" on bestellungen for insert to anon with check (true);
drop policy if exists "auth_all_bestellungen" on bestellungen;
create policy "auth_all_bestellungen"   on bestellungen for all to authenticated using (true);

grant insert on bestellungen to anon;
grant select, insert, update, delete on bestellungen to authenticated;
grant usage, select on sequence bestellungen_id_seq to anon;
grant usage, select on sequence bestellungen_id_seq to authenticated;

-- ═══════════════════════════════════════════════════════════════
--  Fertig. Danach in Authentication → Users einen Admin-User
--  anlegen (E-Mail + Passwort) für den Login in admin.html.
-- ═══════════════════════════════════════════════════════════════
