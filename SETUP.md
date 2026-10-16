# Watan Kabab — Website (Einrichtung & Betrieb)

Eigenständige Website für **Watan Kabab – Afghan Grill** (afghanischer Holzkohlegrill &
orientalische Küche). Dunkles „Feuer & Kohle"-Design. **Kein Supabase** — Reservierung und
Bestellung laufen über ein **eigenes Railway-Backend mit zwei getrennten Datenbanken**.

**Funktionen:** Tischreservierung (mit Live-Verfügbarkeit) · Online-Bestellung (Abholung) ·
Admin-Verwaltung · mehrsprachig (DE/EN/AR).

**Technik:**
- **Frontend:** statische Website (HTML/CSS/Vanilla-JS, kein Build) → Vercel o. beliebiges Static-Hosting.
- **Backend:** Node/Express-API + **2× PostgreSQL** auf **Railway** (Ordner `backend/`).

---

## Struktur

| Datei / Ordner | Zweck |
|---|---|
| `index.html` | Startseite + Tischreservierungs-Modal + Storno-Flow |
| `menu.html` | Speisekarte (in die Startseite eingebettet) |
| `menu-karte.html` | Große Speisekarte / Menü-Karte (Druck-Layout) |
| `bestellen.html` | Online-Bestellung (Warenkorb, Abholung) |
| `admin.html` | Admin-Bereich (Reservierungen, Bestellungen, Einstellungen) — Passwort-Login |
| `api.config.js` | **Verbindung zum Railway-Backend** (`window.API_BASE`) |
| `backend/` | **Railway-API + DB-Schema** (eigene README dort) |
| `agb.html`, `datenschutz.html`, `impressum.html`, `404.html`, `kommt-bald.html` | Rechts-/Systemseiten |
| `dishes/` | Optimierte Gericht-Fotos (Bestellseite) |
| `hero-grill.jpg`, `favicon.svg` | Hero-Bild, Flammen-Logo |
| `fonts/`, `manifest.json`, `sw.js`, `robots.txt`, `sitemap.xml`, `vercel.json` | Assets / PWA / Deploy / SEO |

---

## Einrichtung (Reihenfolge)

### 1. Backend auf Railway (Datenbanken + API)
Siehe **`backend/README.md`** — Kurzfassung:
1. Railway → *New Project*.
2. **Zwei** PostgreSQL-Datenbanken hinzufügen (Reservierungen + Bestellungen).
3. API-Service aus dem Ordner `backend/` deployen.
4. Variablen setzen: `DATABASE_URL_RES`, `DATABASE_URL_ORDERS`, `ADMIN_PASSWORD`,
   `ADMIN_TOKEN`, `CORS_ORIGIN` (= deine Website-Domain).
5. Tabellen anlegen: `node init-db.js` (oder `backend/db/*.sql` im Query-Tab ausführen).
6. Railway liefert eine URL, z. B. `https://watan-kabab-api.up.railway.app`.

### 2. Frontend verbinden
In **`api.config.js`** die Railway-URL eintragen:
```js
window.API_BASE = "https://watan-kabab-api.up.railway.app";
```
> Solange leer, läuft die Seite im **Demo-Modus** (alles sichtbar, Speichern inaktiv;
> Reservierung nutzt E-Mail-Fallback).

### 3. Frontend deployen
`npx vercel --prod` (oder beliebiges Static-Hosting). Danach Domain verbinden und in
`robots.txt` / `sitemap.xml` eintragen.

---

## Admin
`admin.html` → mit `ADMIN_PASSWORD` (aus Railway) anmelden. Verwaltung von
Reservierungen (bestätigen/stornieren, manuell anlegen), Bestellungen (Status), Öffnungszeiten
& Regeln, Ruhetagen/gesperrten Zeitfenstern.

---

## Noch anzupassen (Platzhalter)
Alles rein inhaltlich — überall im Frontend als klare Platzhalter hinterlegt:
- **Kontakt:** Telefon `+49 XXX XXXXXXX`, E-Mail `info@watan-kabab.de`,
  Instagram/Facebook `watan.kabab`, Domain `watan-kabab.de`.
- **Adresse:** `Musterstraße 1, 12345 Musterstadt` (Fußzeile, Kontakt, Impressum, Datenschutz, JSON-LD).
- **Öffnungszeiten:** im Admin unter *Einstellungen* (oder Standard in `backend/db/reservations.sql`).
- **Preise:** Grill-Preise sind real; übrige Preise sind Richtwerte — in `menu.html`,
  `menu-karte.html` und `bestellen.html` (MENU-Array) prüfen/anpassen.
- **Rechtstexte:** `impressum.html`, `datenschutz.html`, `agb.html` finalisieren.
- **E-Mail (optional):** Bestätigungs-Mails laufen best-effort über `/api/send-email`
  (Vercel-Funktion, falls vorhanden). Ansonsten inaktiv — kann später ergänzt werden.

---

## Lokal testen
```bash
# Frontend
cd /Users/salim/watenkaba/webapp
python3 -m http.server 8080      # http://localhost:8080

# Backend (optional, mit lokaler/Railway-Postgres)
cd backend && npm install && node init-db.js && npm start
```
