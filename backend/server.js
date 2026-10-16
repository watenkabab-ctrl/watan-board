// Watan Kabab API — Tischreservierung + Online-Bestellung
// Zwei getrennte Postgres-Datenbanken auf Railway:
//   DATABASE_URL_RES     -> Reservierungen (db/reservations.sql)
//   DATABASE_URL_ORDERS  -> Bestellungen   (db/orders.sql)
// Zeitzone fest auf Europe/Berlin setzen (vor jeder Date-Nutzung), damit Storno-Frist
// und 'Heute'-Cutoff unabhängig von der Server-TZ (Railway = UTC) korrekt rechnen.
process.env.TZ = 'Europe/Berlin';

import express from 'express';
import cors from 'cors';
import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;
// DATE (OID 1082) als reinen 'YYYY-MM-DD'-String zurückgeben (keine TZ-Verschiebung)
pg.types.setTypeParser(1082, v => v);
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'watan-admin-token-change-me';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@watan-kabab.de').trim().toLowerCase();
const ORIGIN = process.env.CORS_ORIGIN || '*'; // z.B. https://watan-kabab.de

function pool(url) {
  if (!url) return null;
  const local = /localhost|127\.0\.0\.1/.test(url) || process.env.PGSSL === 'disable';
  return new Pool({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false }, max: 10, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
}
const resDB = pool(process.env.DATABASE_URL_RES);
const ordDB = pool(process.env.DATABASE_URL_ORDERS);

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: ORIGIN }));
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
});

const need = (db, res) => { if (!db) { res.status(503).json({ error: 'Datenbank nicht konfiguriert' }); return false; } return true; };
const isAdmin = req => (req.headers.authorization || '') === 'Bearer ' + ADMIN_TOKEN;
const requireAdmin = (req, res, next) => isAdmin(req) ? next() : res.status(401).json({ error: 'Nicht autorisiert' });

// ── Helpers: Konfiguration + Slot-Berechnung ──────────────────────────────
async function getConfig() {
  const def = { from: 12, to: 23, slotInterval: 30, resDuration: 120, maxGuestsPerSlot: 20,
    maxAutoConfirmGuests: 9, maxAdvanceDays: 60, cancelHours: 2, closedDays: [1], schedule: null };
  if (!resDB) return def;
  try {
    const { rows } = await resDB.query("SELECT value FROM settings WHERE key='config'");
    return Object.assign(def, rows[0]?.value || {});
  } catch { return def; }
}
function allSlots(cfg, dateStr) {
  const dow = new Date(dateStr + 'T12:00:00').getDay();
  const day = cfg.schedule ? cfg.schedule[dow] : null;
  const f = day?.from ?? cfg.from, t = day?.to ?? cfg.to;
  const iv = cfg.slotInterval || 30, out = [];
  for (let m = f * 60; m < t * 60; m += iv) out.push(String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'));
  return out;
}
function dayClosed(cfg, dateStr) {
  const dow = new Date(dateStr + 'T12:00:00').getDay();
  if (cfg.schedule) return !cfg.schedule[dow]?.open;
  return (cfg.closedDays || []).includes(dow);
}
const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };

// Belegte Gäste je Slot (unter Berücksichtigung der Aufenthaltsdauer)
function takenBySlot(cfg, dateStr, reservations, blocked) {
  const dur = cfg.resDuration || 120, taken = {}, slots = allSlots(cfg, dateStr);
  slots.forEach(s => taken[s] = 0);
  reservations.forEach(r => {
    const start = toMin(r.time), end = start + dur;
    slots.forEach(s => { const sm = toMin(s); if (sm >= start && sm < end) taken[s] += r.guests; });
  });
  const blockedTimes = new Set(blocked.filter(b => b.time).map(b => b.time));
  return { taken, blockedTimes, dayBlocked: blocked.some(b => !b.time) };
}
function slotState(cfg, taken, guests) {
  const max = cfg.maxGuestsPerSlot || 20, rem = max - taken;
  if (rem <= 0 || rem < guests) return 'full';
  if (rem <= Math.ceil(max * 0.25)) return 'limited';
  return 'avail';
}

// ── Health ────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ ok: true, res: !!resDB, orders: !!ordDB }));
app.get('/api/config', async (req, res) => { res.json(await getConfig()); });

// ── Verfügbarkeit für einen Tag (Zeitraster) ────────────────────────────────
app.get('/api/availability', async (req, res) => {
  if (!need(resDB, res)) return;
  const date = req.query.date, guests = parseInt(req.query.guests || '2', 10);
  if (!date) return res.status(400).json({ error: 'date fehlt' });
  const cfg = await getConfig();
  if (dayClosed(cfg, date)) return res.json({ dayBlocked: true, closed: true, slots: [] });
  const [r1, r2] = await Promise.all([
    resDB.query("SELECT time,guests FROM reservations WHERE date=$1 AND status<>'cancelled'", [date]),
    resDB.query('SELECT time FROM blocked_slots WHERE date=$1', [date]),
  ]);
  const { taken, blockedTimes, dayBlocked } = takenBySlot(cfg, date, r1.rows, r2.rows);
  if (dayBlocked) return res.json({ dayBlocked: true, slots: [] });
  const now = new Date(), isToday = date === now.toISOString().slice(0,10);
  const cutoff = isToday ? now.getHours()*60 + now.getMinutes() + 30 : -1;
  const slots = allSlots(cfg, date).map(s => {
    if (blockedTimes.has(s)) return { time: s, state: 'full' };
    if (isToday && toMin(s) < cutoff) return { time: s, state: 'past' };
    return { time: s, state: slotState(cfg, taken[s] || 0, guests) };
  });
  res.json({ dayBlocked: false, slots });
});

// ── Monats-Verfügbarkeit für den Kalender ───────────────────────────────────
app.get('/api/month', async (req, res) => {
  if (!need(resDB, res)) return;
  const year = parseInt(req.query.year, 10), month = parseInt(req.query.month, 10); // month 0-11
  if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 0 || month > 11)
    return res.status(400).json({ error: 'Ungültiger Monat.' });
  const guests = Math.min(Math.max(parseInt(req.query.guests || '2', 10) || 2, 1), 200);
  try {
  const cfg = await getConfig();
  const pad = n => String(n).padStart(2,'0');
  const lastDay = new Date(year, month+1, 0).getDate();
  const first = `${year}-${pad(month+1)}-01`, last = `${year}-${pad(month+1)}-${pad(lastDay)}`;
  const today = new Date().toISOString().slice(0,10);
  const maxD = new Date(); maxD.setDate(maxD.getDate() + (cfg.maxAdvanceDays || 60));
  const maxStr = maxD.toISOString().slice(0,10);
  const [r1, r2] = await Promise.all([
    resDB.query("SELECT date,time,guests FROM reservations WHERE date BETWEEN $1 AND $2 AND status<>'cancelled'", [first, last]),
    resDB.query('SELECT date,time FROM blocked_slots WHERE date BETWEEN $1 AND $2', [first, last]),
  ]);
  const byDate = {};
  r1.rows.forEach(r => { const d = String(r.date).slice(0,10); (byDate[d] ||= []).push(r); });
  const blkByDate = {};
  r2.rows.forEach(b => { const d = String(b.date).slice(0,10); (blkByDate[d] ||= []).push(b); });
  const out = {};
  for (let d = 1; d <= lastDay; d++) {
    const ds = `${year}-${pad(month+1)}-${pad(d)}`;
    if (ds < today || ds > maxStr) { out[ds] = 'past'; continue; }
    if (dayClosed(cfg, ds)) { out[ds] = 'closed'; continue; }
    const blk = blkByDate[ds] || [];
    if (blk.some(b => !b.time)) { out[ds] = 'blocked'; continue; }
    const { taken, blockedTimes } = takenBySlot(cfg, ds, byDate[ds] || [], blk);
    const isToday = ds === today, now = new Date();
    const cutoff = isToday ? now.getHours()*60 + now.getMinutes() + 30 : -1;
    const hasSpace = allSlots(cfg, ds).some(s => {
      if (blockedTimes.has(s)) return false;
      if (isToday && toMin(s) < cutoff) return false;
      return slotState(cfg, taken[s] || 0, guests) !== 'full';
    });
    out[ds] = hasSpace ? 'available' : 'full';
  }
  res.json({ days: out });
  } catch (e) { console.error('month', e && e.message); res.status(500).json({ error: 'Serverfehler' }); }
});

// ── Reservierung anlegen (kapazitätssicher in Transaktion) ──────────────────
app.post('/api/reservations', async (req, res) => {
  if (!need(resDB, res)) return;
  const b = req.body || {};
  if (b.website) return res.status(400).json({ error: 'spam' }); // Honeypot
  const guests = parseInt(b.guests, 10);
  if (!b.name || !b.phone || !b.date || !b.time) return res.status(400).json({ error: 'Pflichtfelder fehlen' });
  if (!Number.isInteger(guests) || guests < 1 || guests > 200) return res.status(400).json({ error: 'Ungültige Personenzahl.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date) || !/^\d{2}:\d{2}$/.test(b.time)) return res.status(400).json({ error: 'Ungültiges Datum bzw. Uhrzeit.' });
  const cfg = await getConfig();
  // Datum innerhalb des Buchungszeitraums (nicht Vergangenheit, nicht über Vorlauf)
  const today = new Date().toISOString().slice(0, 10);
  const maxD = new Date(); maxD.setDate(maxD.getDate() + (cfg.maxAdvanceDays || 60));
  const maxStr = maxD.toISOString().slice(0, 10);
  if (b.date < today || b.date > maxStr) return res.status(400).json({ error: 'Datum liegt außerhalb des Buchungszeitraums.' });
  if (dayClosed(cfg, b.date)) return res.status(409).json({ error: 'An diesem Tag ist geschlossen.' });
  if (!allSlots(cfg, b.date).includes(b.time)) return res.status(400).json({ error: 'Diese Uhrzeit ist nicht buchbar.' });
  if (b.date === today) {
    const now = new Date(), cut = now.getHours() * 60 + now.getMinutes() + 30;
    if (toMin(b.time) < cut) return res.status(400).json({ error: 'Diese Uhrzeit ist bereits vorbei.' });
  }
  const client = await resDB.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query("SELECT time,guests FROM reservations WHERE date=$1 AND status<>'cancelled' FOR UPDATE", [b.date]);
    const blk = await client.query('SELECT time FROM blocked_slots WHERE date=$1', [b.date]);
    const { taken, blockedTimes, dayBlocked } = takenBySlot(cfg, b.date, rows, blk.rows);
    if (dayBlocked || blockedTimes.has(b.time)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Dieser Zeitpunkt ist nicht verfügbar.' });
    }
    if ((taken[b.time] || 0) + guests > (cfg.maxGuestsPerSlot || 20)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Dieser Zeitpunkt ist leider ausgebucht.' });
    }
    const status = guests <= (cfg.maxAutoConfirmGuests ?? 9) ? 'confirmed' : 'pending';
    const ins = await client.query(
      `INSERT INTO reservations (name,phone,email,guests,date,time,occasion,note,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [b.name, b.phone, b.email || null, guests, b.date, b.time, b.occasion || null, b.note || null, status]);
    await client.query('COMMIT');
    res.json({ id: ins.rows[0].id, status });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Serverfehler' });
  } finally { client.release(); }
});

// ── Einzelne Reservierung (für Storno-Link; id dient als Token) ─────────────
app.get('/api/reservations/:id', async (req, res) => {
  if (!need(resDB, res)) return;
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: 'Reservierung nicht gefunden.' });
  try {
    const { rows } = await resDB.query('SELECT id,name,email,date,time,guests,status FROM reservations WHERE id=$1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Reservierung nicht gefunden.' });
    res.json(rows[0]);
  } catch (e) { console.error('res-lookup', e && e.message); res.status(500).json({ error: 'Serverfehler' }); }
});

// ── Reservierung stornieren ─────────────────────────────────────────────────
app.post('/api/reservations/cancel', async (req, res) => {
  if (!need(resDB, res)) return;
  const id = parseInt(req.body?.id, 10);
  if (!id) return res.status(400).json({ error: 'id fehlt' });
  const cfg = await getConfig();
  const { rows } = await resDB.query('SELECT * FROM reservations WHERE id=$1', [id]);
  const r = rows[0];
  if (!r) return res.status(404).json({ error: 'Reservierung nicht gefunden.' });
  if (r.status === 'cancelled') return res.json({ ok: true, already: true });
  const h = cfg.cancelHours ?? 2;
  if (h > 0) {
    const dt = new Date(String(r.date).slice(0,10) + 'T' + r.time);
    if (Date.now() > dt.getTime() - h*3600*1000) return res.status(400).json({ error: `Stornierung nur bis ${h} Std. vor dem Termin möglich.` });
  }
  await resDB.query("UPDATE reservations SET status='cancelled' WHERE id=$1", [id]);
  res.json({ ok: true });
});

// ── Bestellung anlegen ──────────────────────────────────────────────────────
app.post('/api/orders', async (req, res) => {
  if (!need(ordDB, res)) return;
  const b = req.body || {};
  if (b.website) return res.status(400).json({ error: 'spam' }); // Honeypot
  const items = Array.isArray(b.items) ? b.items : [];
  if (!b.name || !b.phone || items.length === 0) return res.status(400).json({ error: 'Pflichtfelder/Warenkorb fehlen' });
  if (items.length > 200) return res.status(400).json({ error: 'Zu viele Positionen.' });
  // Jede Warenkorb-Position validieren (verhindert 500er + negative/0-Mengen)
  const clean = [];
  for (const it of items) {
    const name = (it && typeof it.name === 'string') ? it.name.trim() : '';
    const qty = parseInt(it && it.qty, 10);
    const price = Number(it && it.price);
    if (!name || !Number.isInteger(qty) || qty < 1 || qty > 999 || !Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: 'Ungültige Warenkorb-Position.' });
    }
    clean.push({ id: (it.id != null ? String(it.id).slice(0, 80) : null), name: name.slice(0, 200), qty, price });
  }
  const total = clean.reduce((s, it) => s + it.price * it.qty, 0);
  const client = await ordDB.connect();
  try {
    await client.query('BEGIN');
    const o = await client.query(
      `INSERT INTO orders (name,phone,email,pickup_time,note,total,status)
       VALUES ($1,$2,$3,$4,$5,$6,'new') RETURNING id`,
      [b.name, b.phone, b.email || null, b.pickupTime || null, b.note || null, total.toFixed(2)]);
    const oid = o.rows[0].id;
    for (const it of clean) {
      await client.query(
        'INSERT INTO order_items (order_id,item_id,name,qty,unit_price) VALUES ($1,$2,$3,$4,$5)',
        [oid, it.id, it.name, it.qty, it.price]);
    }
    await client.query('COMMIT');
    res.json({ id: oid, status: 'new', total: Number(total.toFixed(2)) });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Serverfehler' });
  } finally { client.release(); }
});

// ── Admin ───────────────────────────────────────────────────────────────────
const _loginTries = new Map(); // ip -> {n, ts} (Brute-Force-Bremse, 15-Min-Fenster)
app.post('/api/admin/login', (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'x';
  const now = Date.now(), rec = _loginTries.get(ip);
  if (rec && now - rec.ts < 900000 && rec.n >= 10) return res.status(429).json({ error: 'Zu viele Versuche. Bitte in 15 Minuten erneut.' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = req.body?.password || '';
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) { _loginTries.delete(ip); return res.json({ token: ADMIN_TOKEN }); }
  const r = (rec && now - rec.ts < 900000) ? rec : { n: 0, ts: now };
  r.n++; _loginTries.set(ip, r);
  res.status(401).json({ error: 'E-Mail oder Passwort falsch' });
});
app.get('/api/admin/reservations', requireAdmin, async (req, res) => {
  if (!need(resDB, res)) return;
  const { rows } = await resDB.query('SELECT * FROM reservations ORDER BY date DESC, time DESC LIMIT 500');
  res.json(rows);
});
app.patch('/api/admin/reservations/:id', requireAdmin, async (req, res) => {
  if (!need(resDB, res)) return;
  await resDB.query('UPDATE reservations SET status=$1 WHERE id=$2', [req.body?.status || 'pending', parseInt(req.params.id,10)]);
  res.json({ ok: true });
});
app.get('/api/admin/orders', requireAdmin, async (req, res) => {
  if (!need(ordDB, res)) return;
  const { rows } = await ordDB.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 500');
  for (const o of rows) {
    const it = await ordDB.query('SELECT item_id,name,qty,unit_price FROM order_items WHERE order_id=$1', [o.id]);
    o.items = it.rows;
  }
  res.json(rows);
});
app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
  if (!need(ordDB, res)) return;
  await ordDB.query('UPDATE orders SET status=$1 WHERE id=$2', [req.body?.status || 'new', parseInt(req.params.id,10)]);
  res.json({ ok: true });
});

// Manuelle Reservierung durch Admin
app.post('/api/admin/reservations', requireAdmin, async (req, res) => {
  if (!need(resDB, res)) return;
  const b = req.body || {}; const g = parseInt(b.guests, 10);
  if (!b.name || !b.date || !b.time || !g) return res.status(400).json({ error: 'Pflichtfelder fehlen' });
  const ins = await resDB.query(
    `INSERT INTO reservations (name,phone,email,guests,date,time,occasion,note,status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'confirmed') RETURNING id`,
    [b.name, b.phone || '', b.email || null, g, b.date, b.time, b.occasion || null, b.note || null]);
  res.json({ id: ins.rows[0].id, status: 'confirmed' });
});

// Einstellungen (Öffnungszeiten/Regeln) speichern
app.patch('/api/admin/config', requireAdmin, async (req, res) => {
  if (!need(resDB, res)) return;
  const cfg = await getConfig();
  const merged = Object.assign({}, cfg, req.body || {});
  await resDB.query(
    "INSERT INTO settings (key,value) VALUES ('config',$1) ON CONFLICT (key) DO UPDATE SET value=$1",
    [merged]);
  res.json({ ok: true, config: merged });
});

// Gesperrte Slots / Ruhetage
app.get('/api/admin/blocked', requireAdmin, async (req, res) => {
  if (!need(resDB, res)) return;
  const from = req.query.from, to = req.query.to;
  const q = (from && to)
    ? await resDB.query('SELECT * FROM blocked_slots WHERE date BETWEEN $1 AND $2 ORDER BY date,time', [from, to])
    : await resDB.query('SELECT * FROM blocked_slots ORDER BY date,time LIMIT 500');
  res.json(q.rows);
});
app.post('/api/admin/blocked', requireAdmin, async (req, res) => {
  if (!need(resDB, res)) return;
  const b = req.body || {};
  if (!b.date) return res.status(400).json({ error: 'date fehlt' });
  const ins = await resDB.query('INSERT INTO blocked_slots (date,time,reason) VALUES ($1,$2,$3) RETURNING id',
    [b.date, b.time || null, b.reason || null]);
  res.json({ id: ins.rows[0].id });
});
app.delete('/api/admin/blocked/:id', requireAdmin, async (req, res) => {
  if (!need(resDB, res)) return;
  await resDB.query('DELETE FROM blocked_slots WHERE id=$1', [parseInt(req.params.id, 10)]);
  res.json({ ok: true });
});

// Beim Start die Tabellen anlegen (idempotent: CREATE TABLE IF NOT EXISTS),
// danach erst lauschen. So genügt die interne Railway-DB-URL, kein Extra-Init nötig.
async function initSchema() {
  const run = async (db, file, label) => {
    if (!db) { console.log('[init] ' + label + ': keine DB-URL gesetzt, übersprungen'); return; }
    try {
      const sql = fs.readFileSync(new URL('./db/' + file, import.meta.url), 'utf8');
      await db.query(sql);
      console.log('[init] ' + label + ' ok (' + file + ')');
    } catch (e) { console.error('[init] ' + label + ' FEHLER:', e.message); }
  };
  await run(resDB, 'reservations.sql', 'Reservierungs-Schema');
  await run(ordDB, 'orders.sql', 'Bestell-Schema');
}
// Sicherheitsnetz: kein Prozess-Crash bei vergessenem try/catch → Backend bleibt stabil
app.use((err, req, res, next) => { console.error('express-error', err && err.message); if (!res.headersSent) res.status(500).json({ error: 'Serverfehler' }); });
process.on('unhandledRejection', e => console.error('unhandledRejection', e && e.message));
process.on('uncaughtException', e => console.error('uncaughtException', e && e.message));
if (ADMIN_PASSWORD === 'change-me' || ADMIN_TOKEN === 'watan-admin-token-change-me') console.error('!!! WARN: unsichere Default-Admin-Credentials aktiv — ADMIN_PASSWORD/ADMIN_TOKEN in Railway setzen !!!');

initSchema().finally(() => {
  app.listen(PORT, () => console.log('Watan Kabab API on :' + PORT));
});
