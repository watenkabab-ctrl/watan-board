# Watan Kabab — Backend (Railway)

Eigenständiges API für **Tischreservierung** und **Online-Bestellung** — mit **zwei getrennten
Postgres-Datenbanken** auf Railway, ausschließlich für Watan Kabab. Kein Supabase.

```
backend/
├── server.js            Express-API (Reservierung, Bestellung, Verfügbarkeit, Admin)
├── init-db.js           legt die Tabellen in beiden DBs an
├── db/reservations.sql  Schema + Standard-Öffnungszeiten (Reservierungs-DB)
├── db/orders.sql        Schema (Bestell-DB)
├── railway.json         Deploy-Konfig (Healthcheck /health)
└── .env.example         benötigte Variablen
```

## Einrichtung auf Railway (Reihenfolge)

1. **Projekt anlegen:** railway.app → *New Project*.
2. **Zwei Datenbanken:** im Projekt *Add → Database → PostgreSQL* **zweimal** ausführen.
   Benenne sie z. B. `watan-reservations` und `watan-orders`.
3. **API-Service:** *Add → GitHub Repo* (oder `railway up` aus diesem `backend/`-Ordner).
4. **Variablen** (Service → *Variables*, siehe `.env.example`):
   - `DATABASE_URL_RES`  → Connection-String der **Reservierungs**-DB
   - `DATABASE_URL_ORDERS` → Connection-String der **Bestell**-DB
   - `ADMIN_PASSWORD`, `ADMIN_TOKEN` (frei wählen), `CORS_ORIGIN` (deine Domain)
5. **Tabellen anlegen:** einmalig `node init-db.js` ausführen
   (lokal mit gesetzten Variablen, oder Railway *→ Deployments → Run command*).
   Alternativ den Inhalt von `db/*.sql` im jeweiligen Postgres-*Query*-Tab einfügen.
6. **Deploy** → Railway gibt eine URL wie `https://watan-kabab-api.up.railway.app`.

## Frontend verbinden

In der Website `api.config.js` die URL eintragen:

```js
window.API_BASE = "https://watan-kabab-api.up.railway.app";
```

Danach nutzen `index.html` (Reservierung) und `bestellen.html` (Bestellung) automatisch
die Railway-API. Ist `API_BASE` leer, läuft die Seite im Demo-Modus (Formulare sichtbar,
Speichern deaktiviert).

## Endpunkte (Kurzüberblick)

| Methode | Pfad | Zweck |
|---|---|---|
| GET  | `/health` | Status |
| GET  | `/api/config` | Öffnungszeiten/Regeln |
| GET  | `/api/availability?date&guests` | Zeitraster-Verfügbarkeit |
| GET  | `/api/month?year&month&guests` | Kalender-Verfügbarkeit |
| POST | `/api/reservations` | Reservierung anlegen |
| POST | `/api/reservations/cancel` | Reservierung stornieren |
| POST | `/api/orders` | Bestellung anlegen |
| POST | `/api/admin/login` | Admin-Login → Token |
| GET/PATCH | `/api/admin/reservations` | Admin: Reservierungen |
| GET/PATCH | `/api/admin/orders` | Admin: Bestellungen |

## Lokal testen
```bash
cd backend
npm install
# .env mit zwei lokalen/Railway-DB-URLs anlegen, dann:
node init-db.js
npm start          # -> http://localhost:3000/health
```
