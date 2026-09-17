# watenkabab — Website (Einrichtung & Betrieb)

Diese Website ist ein **eigenständiger Fork** der Injera-Website — komplett getrennt:
eigene Datenbank (Supabase), eigenes E-Mail-Backend (AWS SES via Vercel-Funktion),
eigenes Deployment. Injera bleibt unberührt.

**Funktionen:** Online-Bestellung (Abholung) + Tischreservierung + Admin-Verwaltung.

**Technik:** Statische Website (HTML/CSS/Vanilla-JS, kein Build) + 1 Serverless-Funktion
(`api/send-email.js`) + Supabase (Datenbank, direkt aus dem Browser).

---

## Struktur

| Datei / Ordner | Zweck |
|---|---|
| `index.html` | Startseite + **Tischreservierungs-Modal** |
| `bestellen.html` | **Online-Bestellung** (Warenkorb, Abholung) |
| `admin.html` | Admin-Bereich (Reservierungen, Bestellungen, Tische, Öffnungszeiten) — Login nötig |
| `menu.html`, `menu-karte.html`, `menu-translations.json`, `menu-karte.pdf` | Speisekarte |
| `agb.html`, `datenschutz.html`, `impressum.html`, `404.html`, `kommt-bald.html` | Rechts-/Systemseiten |
| `supabase.config.js` | **Supabase-Zugang** (URL + Key) + Reservierungs-Einstellungen |
| `schema.sql` | **Komplettes DB-Schema** — einmalig im Supabase-SQL-Editor ausführen |
| `api/send-email.js` | **E-Mail-Versand** (AWS SES) — Reservierungs- & Bestellbestätigungen |
| `supabase/functions/create-payment-intent/index.ts` | Optional: Stripe-Online-Zahlung (Edge Function) |
| `vercel.json`, `manifest.json`, `sw.js`, `robots.txt`, `sitemap.xml` | Deploy / PWA / SEO |
| `photos-nobg/`, `Photos-opt/`, `fonts/`, `logo.svg` | Bilder, Schriften, Logo |

---

## Einrichtung (Reihenfolge einhalten)

### 1. Supabase (Datenbank)
1. Auf https://supabase.com → **New Project** → Name `watenkabab`, Region **Frankfurt (eu-central-1)**.
2. **SQL Editor → New Query** → kompletten Inhalt von `schema.sql` einfügen → **Run**.
   (Erstellt Tabellen `tables`, `reservations`, `blocked_slots`, `settings`, `bestellungen`
   inkl. RLS-Policies und RPC-Funktionen.)
3. **Settings → API** → *Project URL* und *anon / publishable key* kopieren und in
   `supabase.config.js` eintragen (Zeilen mit `window.SUPABASE_URL` / `window.SUPABASE_KEY`).
4. **Authentication → Users → Add user** → deine E-Mail + Passwort. Damit meldest du dich in
   `admin.html` an.
5. In `schema.sql` (bzw. nachträglich in den beiden Storno-Funktionen) die Telefonnummer
   `+49 XXX XXXXXXX` auf die watenkabab-Nummer setzen.

### 2. AWS SES (E-Mail-Versand)
1. AWS-Konto → **SES** (Region z. B. `eu-central-1`).
2. Absender **verifizieren**: entweder eine Domain (`watenkabab.de`) oder eine Einzeladresse
   (`noreply@watenkabab.de`). Im Sandbox-Modus müssen auch Empfänger verifiziert werden →
   für den Echtbetrieb **Production Access** beantragen.
3. IAM-User mit `AmazonSESFullAccess` (oder minimalen SES-Send-Rechten) anlegen →
   **Access Key ID** + **Secret Access Key** notieren (für Vercel, Schritt 3).

### 3. Vercel (Deployment)
1. In diesem Ordner: `npx vercel` (oder das Projekt im Vercel-Dashboard importieren).
   Da kein `.vercel/` mitkopiert wurde, entsteht ein **neues** Projekt (nicht Injera).
2. **Environment Variables** setzen (Project → Settings → Environment Variables):

   | Variable | Wert |
   |---|---|
   | `AWS_ACCESS_KEY_ID` | AWS Access Key |
   | `AWS_SECRET_ACCESS_KEY` | AWS Secret |
   | `AWS_REGION` | z. B. `eu-central-1` |
   | `FROM_EMAIL` | `noreply@watenkabab.de` (verifiziert) |
   | `ADMIN_EMAIL` | Adresse, die Bestell-/Reservierungsbenachrichtigungen bekommt |
   | `CONTACT_EMAIL` | öffentliche Kontaktadresse (E-Mail-Fußzeile) |
   | `CONTACT_PHONE` | Telefonnummer (E-Mail-Fußzeile) |
   | `CONTACT_ADDRESS` | Adresse (E-Mail-Fußzeile) |
   | `WEBSITE_URL` | `https://watenkabab.de` |
   | `LOGO_URL` | `https://watenkabab.de/logo.png` |

3. `npx vercel --prod` deployen. Danach eigene **Domain** verbinden und in `robots.txt` /
   `sitemap.xml` eintragen.

### 4. (Optional) Stripe-Online-Zahlung
Nur falls Bezahlung online gewünscht: `window.STRIPE_PK` in `supabase.config.js` setzen, die
Edge Function `supabase/functions/create-payment-intent` deployen
(`supabase functions deploy create-payment-intent`) und `STRIPE_SECRET_KEY` als
Supabase-Function-Secret hinterlegen. Standardmäßig **inaktiv** (Zahlung bei Abholung).

---

## Lokal testen
```bash
cd /Users/salim/watenkaba/webapp
npm install                 # installiert @aws-sdk/client-ses (für die E-Mail-Funktion)
npx serve .                 # oder: python3 -m http.server 8080
```
- Statische Seiten (`index.html`, `bestellen.html`, `menu.html`) laufen sofort.
- Reservierung/Bestellung **speichern** erst, wenn `supabase.config.js` die neuen
  Supabase-Werte enthält.
- Der **E-Mail-Versand** (`api/send-email.js`) läuft nur unter `npx vercel dev` (mit gesetzten
  AWS-Env-Variablen) oder nach dem Deploy — nicht bei einem reinen Static-Server.

---

## Branding später ändern (Landkarte)

Alles unten ist rein optisch/inhaltlich — die Trennung von Injera ist bereits erledigt.

- **Logo:** `logo.svg` + `logo-icon-colored.png` (in `manifest.json` referenziert) +
  `LOGO_URL` (Env, für E-Mails). Logo-Dateien im Root ersetzen.
- **Farben:** Gold `#C9973A`, Blau `#21546A`, Creme `#EDE5D9` / `#FDFAF4` — in den
  `<style>`-Blöcken der HTML-Seiten und in `api/send-email.js` (E-Mail-Vorlagen).
- **Texte / Name „WATENKABAB":** stehen in den HTML-Seiten und in `api/send-email.js`.
  (Restliche „INJERA"-Vorkommen wurden bereits durch „WATENKABAB" ersetzt — beim Feinschliff
  Schreibweise/Slogan anpassen.)
- **Adresse / Telefon / E-Mail:** in den HTML-Seiten (Fußzeile, Kontakt, Impressum,
  Datenschutz) sowie über die Vercel-Env-Variablen für die E-Mails.
- **Menü / Preise:** `menu.html`, `menu-karte.html`, `menu-translations.json`,
  `menu-karte.pdf`; die Bestell-Artikel in `bestellen.html`.
- **Fotos:** `photos-nobg/`, `Photos-opt/` durch watenkabab-Fotos ersetzen (eigene Assets
  liegen bereits unter `/Users/salim/watenkaba/images` und `/Users/salim/watenkaba/gerichte_freigestellt`).
- **Öffnungszeiten / Reservierungs-Regeln:** `RES_CONFIG` in `supabase.config.js` bzw. im Admin.
- **Rechtstexte:** `impressum.html`, `datenschutz.html`, `agb.html` an watenkabab anpassen.

---

## Checkliste
- [ ] Supabase-Projekt angelegt, `schema.sql` ausgeführt
- [ ] `supabase.config.js`: URL + Key eingetragen (nicht die von Injera!)
- [ ] Admin-User in Supabase Authentication angelegt
- [ ] Telefonnummer in den Storno-Funktionen gesetzt
- [ ] AWS SES: Absender verifiziert, Production Access, IAM-Keys
- [ ] Vercel: Projekt + alle Env-Variablen, deployed
- [ ] Domain verbunden, `robots.txt`/`sitemap.xml` aktualisiert
- [ ] Testreservierung + Testbestellung → landen in **neuer** DB, E-Mails kommen an
