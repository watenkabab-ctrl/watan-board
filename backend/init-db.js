// Legt die Tabellen in beiden Railway-Datenbanken an.
// Aufruf (lokal oder als Railway "one-off"):  node init-db.js
import fs from 'fs';
import pg from 'pg';
const { Client } = pg;

async function run(url, file, label) {
  if (!url) { console.log(`[skip] ${label}: keine URL gesetzt`); return; }
  const sql = fs.readFileSync(new URL('./db/' + file, import.meta.url), 'utf8');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query(sql);
  await c.end();
  console.log(`[ok] ${label} initialisiert (${file})`);
}
await run(process.env.DATABASE_URL_RES, 'reservations.sql', 'Reservierungs-DB');
await run(process.env.DATABASE_URL_ORDERS, 'orders.sql', 'Bestell-DB');
console.log('Fertig.');
