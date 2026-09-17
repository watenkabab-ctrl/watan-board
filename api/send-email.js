'use strict';

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

// ── Absender/Kontakt (per Vercel-Env überschreibbar — siehe SETUP.md) ──
// TODO: Platzhalter unten bzw. die Vercel-Env-Variablen auf watenkabab-Werte setzen.
const FROM          = process.env.FROM_EMAIL      || 'noreply@watenkabab.de';
const ADMIN_EMAIL   = process.env.ADMIN_EMAIL     || 'admin@watenkabab.de';
const CONTACT_EMAIL = process.env.CONTACT_EMAIL   || 'info@watenkabab.de';
const PHONE         = process.env.CONTACT_PHONE   || '+49 XXX XXXXXXX';
const ADDRESS       = process.env.CONTACT_ADDRESS || 'Deine Adresse · PLZ Ort';
const WEBSITE       = process.env.WEBSITE_URL     || 'https://watenkabab.de';
const LOGO_URL      = process.env.LOGO_URL        || 'https://watenkabab.de/logo.png';

const ses = new SESClient({ region: process.env.AWS_REGION || 'eu-central-1' });

async function sendMail({ to, subject, html }) {
  const cmd = new SendEmailCommand({
    Source: FROM,
    Destination: { ToAddresses: Array.isArray(to) ? to : [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body:    { Html:    { Data: html,    Charset: 'UTF-8' } },
    },
  });
  return ses.send(cmd);
}

function formatDate(iso) {
  if (!iso) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// ── Outer wrapper ─────────────────────────────────────────────────────────────
function wrap(body) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>WATENKABAB Restaurant</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,700;1,400;1,700&display=swap');
    :root { color-scheme: light !important; }
    @media only screen and (max-width:600px) {
      .outer-td  { padding: 20px 8px 36px !important; }
      .main-table{ width: 100% !important; }
      .pad       { padding-left: 20px !important; padding-right: 20px !important; }
      .logo-area { padding: 20px 20px !important; }
      .logo-img  { width: 52px !important; height: 52px !important; }
      .logo-name { font-size: 20px !important; letter-spacing: 0.18em !important; }
      .logo-under{ font-size: 10px !important; letter-spacing: 0.25em !important; }
      .logo-div  { height: 28px !important; }
      .body-text { font-size: 15px !important; }
    }
  </style>
</head>
<body bgcolor="#EDE5D9" style="margin:0;padding:0;background-color:#EDE5D9;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#EDE5D9" style="background-color:#EDE5D9;">
<tr><td align="center" bgcolor="#EDE5D9" class="outer-td" style="background-color:#EDE5D9;padding:40px 16px 56px;">
<table width="560" cellpadding="0" cellspacing="0" class="main-table" style="max-width:560px;width:100%;">
${body}
</table>
</td></tr>
</table>
</body></html>`;
}

// ── Logo header — identisch mit Website-Nav ───────────────────────────────────
function logoRow(sublabel) {
  return `
<tr><td bgcolor="#C9973A" height="3" style="background-color:#C9973A;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td bgcolor="#FDFAF4" class="logo-area" style="background-color:#FDFAF4;padding:22px 52px 20px;border-bottom:1px solid rgba(201,151,58,0.22);">
  <table cellpadding="0" cellspacing="0">
    <tr>
      <td style="vertical-align:middle;padding-right:12px;">
        <img src="${LOGO_URL}" alt="WATENKABAB Restaurant" width="58" height="58" class="logo-img"
          style="display:block;width:58px;height:58px;object-fit:contain;border:0;filter:drop-shadow(0 2px 8px rgba(100,40,8,0.15));" />
      </td>
      <td style="vertical-align:middle;">
        <div class="logo-name" style="font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700;letter-spacing:0.03em;white-space:nowrap;line-height:1;color:#21546A;">WATENKABAB</div>
        <div class="logo-under" style="font-family:Georgia,Arial,sans-serif;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.22em;color:rgba(46,26,14,0.80);margin-top:4px;">Restaurant</div>
      </td>
    </tr>
  </table>
  ${sublabel ? `<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(201,151,58,0.18);font-family:'Cormorant Garamond',Georgia,serif;font-size:12px;color:rgba(201,151,58,0.8);font-style:italic;letter-spacing:0.05em;">${sublabel}</div>` : ''}
</td></tr>`;
}

// ── Info rows (Datum / Uhrzeit / Personen) ────────────────────────────────────
function infoRows(r) {
  const row = (label, value) => `
  <tr>
    <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:rgba(201,151,58,0.8);padding:6px 0;white-space:nowrap;width:110px;letter-spacing:0.02em;">${label}</td>
    <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:#2E1A0E;padding:6px 0 6px 10px;letter-spacing:0.02em;">${value}</td>
  </tr>`;
  return `
<tr><td bgcolor="#FDFAF4" class="pad" style="background-color:#FDFAF4;border-left:1px solid rgba(201,151,58,0.15);border-right:1px solid rgba(201,151,58,0.15);padding:4px 52px 16px;">
  <table cellpadding="0" cellspacing="0">
    ${row('Datum:', formatDate(r.date))}
    ${row('Uhrzeit:', r.time + ' Uhr')}
    ${row('Personen:', r.guests)}
  </table>
</td></tr>`;
}

// ── Gold divider ──────────────────────────────────────────────────────────────
function divider() {
  return `<div style="height:1px;background:linear-gradient(90deg,transparent,rgba(201,151,58,0.3),transparent);margin:28px 0;"></div>`;
}

// ── Signature ─────────────────────────────────────────────────────────────────
const signature = `
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:rgba(46,26,14,0.55);margin:0 0 2px;letter-spacing:0.02em;">Herzliche Grüße</p>
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#21546A;font-weight:700;margin:0;letter-spacing:0.02em;">Ihr WATENKABAB Team</p>`;

// ── Footer ────────────────────────────────────────────────────────────────────
const footerRow = `
<tr><td bgcolor="#F5F0E8" style="background-color:#F5F0E8;border:1px solid rgba(201,151,58,0.12);border-top:none;border-radius:0 0 4px 4px;padding:26px 52px 32px;text-align:center;">
  <div style="width:40px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,151,58,0.4),transparent);margin:0 auto 22px;"></div>
  <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
    <tr>
      <td style="padding:5px 12px 5px 0;vertical-align:top;font-size:15px;line-height:1;">&#128205;</td>
      <td style="padding:5px 0;font-family:'Cormorant Garamond',Georgia,serif;font-size:13px;color:rgba(46,26,14,0.55);letter-spacing:0.04em;text-align:left;white-space:nowrap;">${ADDRESS}</td>
    </tr>
    <tr>
      <td style="padding:5px 12px 5px 0;vertical-align:top;font-size:15px;line-height:1;">&#9742;</td>
      <td style="padding:5px 0;font-family:'Cormorant Garamond',Georgia,serif;font-size:13px;letter-spacing:0.04em;text-align:left;white-space:nowrap;"><a href="tel:${PHONE.replace(/\s/g,'')}" style="color:#21546A;text-decoration:none;">${PHONE}</a></td>
    </tr>
    <tr>
      <td style="padding:5px 12px 5px 0;vertical-align:top;font-size:15px;line-height:1;">&#9993;</td>
      <td style="padding:5px 0;font-family:'Cormorant Garamond',Georgia,serif;font-size:13px;letter-spacing:0.04em;text-align:left;white-space:nowrap;"><a href="mailto:${CONTACT_EMAIL}" style="color:#21546A;text-decoration:none;">${CONTACT_EMAIL}</a></td>
    </tr>
  </table>
</td></tr>`;

// ── Body cell wrapper ─────────────────────────────────────────────────────────
const bodyCell = (content, pt, pb) =>
  `<tr><td bgcolor="#FDFAF4" class="pad" style="background-color:#FDFAF4;border-left:1px solid rgba(201,151,58,0.15);border-right:1px solid rgba(201,151,58,0.15);padding:${pt||36}px 52px ${pb||36}px;">${content}</td></tr>`;

// ── Buchungs-Karte (große visuelle Datum/Uhrzeit/Personen Anzeige) ────────────
function bookingCard(r, timeColor) {
  const tc = timeColor || '#C9973A';
  return `
<tr><td style="background-color:#FDFAF4;border-left:1px solid rgba(201,151,58,0.15);border-right:1px solid rgba(201,151,58,0.15);padding:0 40px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(201,151,58,0.22);background:linear-gradient(160deg,#F5EDD8 0%,#EDE5D9 100%);">
    <tr>
      <td style="padding:22px 20px;text-align:center;vertical-align:middle;border-right:1px solid rgba(201,151,58,0.15);width:42%;">
        <div style="font-family:Georgia,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,151,58,0.55);margin-bottom:8px;">Datum</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#2E1A0E;line-height:1.4;">${formatDate(r.date)}</div>
      </td>
      <td style="padding:18px;text-align:center;vertical-align:middle;border-right:1px solid rgba(201,151,58,0.15);">
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:44px;color:${tc};font-weight:300;line-height:1;">${r.time}</div>
        <div style="font-family:Georgia,sans-serif;font-size:8px;letter-spacing:3px;color:rgba(201,151,58,0.45);margin-top:3px;">UHR</div>
      </td>
      <td style="padding:22px 20px;text-align:center;vertical-align:middle;">
        <div style="font-family:Georgia,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,151,58,0.55);margin-bottom:8px;">Personen</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:36px;color:#21546A;font-weight:300;line-height:1;">${r.guests}</div>
      </td>
    </tr>
  </table>
</td></tr>`;
}

// ── Kontakdaten-Zeilen (Admin) ────────────────────────────────────────────────
function contactRows(r) {
  const row = (label, value) => `
  <tr>
    <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:rgba(201,151,58,0.75);padding:5px 0;white-space:nowrap;width:110px;letter-spacing:0.02em;">${label}</td>
    <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#2E1A0E;padding:5px 0 5px 10px;letter-spacing:0.02em;">${value}</td>
  </tr>`;
  return `
<tr><td bgcolor="#FDFAF4" class="pad" style="background-color:#FDFAF4;border-left:1px solid rgba(201,151,58,0.15);border-right:1px solid rgba(201,151,58,0.15);padding:16px 52px 16px;">
  <div style="height:1px;background:rgba(201,151,58,0.12);margin-bottom:12px;"></div>
  <table cellpadding="0" cellspacing="0">
    ${row('Telefon:', `<a href="tel:${(r.phone||'').replace(/\s/g,'')}" style="color:#21546A;text-decoration:none;">${r.phone}</a>`)}
    ${r.email ? row('E-Mail:', `<a href="mailto:${r.email}" style="color:#21546A;text-decoration:none;">${r.email}</a>`) : ''}
    ${r.note  ? row('Wünsche:', r.note) : ''}
  </table>
</td></tr>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GAST: Buchung sofort bestätigt
// ─────────────────────────────────────────────────────────────────────────────
function guestConfirmedHTML(r) {
  const firstName = r.name.split(' ')[0];
  const cancelUrl = r.id ? `${WEBSITE}/?cancel=${r.id}` : null;
  const hours = r.cancelHours ?? 2;
  const cancelHint = hours === 0
    ? 'Sie können jederzeit kostenlos stornieren.'
    : `Kostenlose Stornierung bis ${hours} Stunde${hours === 1 ? '' : 'n'} vor dem Termin.`;

  return wrap(`
  ${logoRow()}

  ${bodyCell(`
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:700;color:#21546A;margin:0 0 18px;line-height:1.5;letter-spacing:0.02em;">Wir freuen uns auf Sie, ${firstName}!</p>
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:rgba(46,26,14,0.72);margin:0;line-height:1.8;">Vielen Dank für Ihre Reservierung im WATENKABAB Restaurant. Ihr Tisch ist reserviert — wir freuen uns auf Ihren Besuch.</p>
  `, 44, 20)}

  ${infoRows(r)}

  ${bodyCell(`
    ${cancelUrl ? `<p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:rgba(46,26,14,0.5);margin:0 0 6px;line-height:1.75;">${cancelHint}</p><p style="margin:0 0 24px;"><a href="${cancelUrl}" style="font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:#21546A;text-decoration:underline;font-style:italic;">Reservierung stornieren</a></p>` : ''}
    ${divider()}
    ${signature}
  `, 0, 44)}

  ${footerRow}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GAST: Anfrage eingegangen (pending — große Gruppe)
// ─────────────────────────────────────────────────────────────────────────────
function guestPendingHTML(r) {
  const firstName = r.name.split(' ')[0];
  return wrap(`
  ${logoRow()}

  ${bodyCell(`
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:700;color:#21546A;margin:0 0 18px;line-height:1.5;letter-spacing:0.02em;">Danke für Ihre Anfrage, ${firstName}!</p>
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:rgba(46,26,14,0.72);margin:0;line-height:1.8;">Schön, dass Sie mit uns feiern möchten! Wir prüfen die Verfügbarkeit für Ihre Gruppe und melden uns so schnell wie möglich mit einer Bestätigung.</p>
  `, 44, 20)}

  ${infoRows(r)}

  ${bodyCell(`
    ${divider()}
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:rgba(46,26,14,0.78);margin:0 0 20px;line-height:1.75;letter-spacing:0.01em;">Wir freuen uns auf Ihren Besuch.</p>
    ${signature}
  `, 0, 44)}

  ${footerRow}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GAST: Statusänderung (bestätigt / abgesagt)
// ─────────────────────────────────────────────────────────────────────────────
function guestStatusUpdateHTML(r, status) {
  const confirmed = status === 'confirmed';
  const firstName = r.name.split(' ')[0];
  return wrap(`
  ${logoRow()}

  ${bodyCell(`
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:700;color:#21546A;margin:0 0 18px;line-height:1.5;letter-spacing:0.02em;">${confirmed ? `Ihr Tisch ist bestätigt, ${firstName}!` : `Liebe/r ${firstName},`}</p>
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:rgba(46,26,14,0.72);margin:0;line-height:1.8;">${
      confirmed
        ? 'Ihre Reservierung im WATENKABAB Restaurant ist offiziell bestätigt. Wir freuen uns darauf, Sie bald bei uns begrüßen zu dürfen.'
        : `leider müssen wir Ihre Reservierung absagen und entschuldigen uns aufrichtig. Für einen neuen Wunschtermin sind wir gerne für Sie da:<br><br><a href="tel:${PHONE.replace(/\s/g,'')}" style="color:#21546A;text-decoration:none;font-family:'Cormorant Garamond',Georgia,serif;">${PHONE}</a>`
    }</p>
  `, 44, 20)}

  ${infoRows(r)}

  ${bodyCell(`
    ${divider()}
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:rgba(46,26,14,0.78);margin:0 0 20px;line-height:1.75;letter-spacing:0.01em;">${confirmed ? 'Wir freuen uns auf Ihren Besuch.' : 'Wir hoffen, Sie bald bei uns willkommen zu heißen.'}</p>
    ${signature}
  `, 0, 44)}

  ${footerRow}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Neue Buchung eingegangen
// ─────────────────────────────────────────────────────────────────────────────
function adminNewBookingHTML(r) {
  const isPending = r.status === 'pending';
  return wrap(`
  ${logoRow()}

  ${bodyCell(`
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${isPending ? '#C9973A' : 'rgba(33,84,106,0.6)'};margin:0 0 12px;">${isPending ? '⚠ Neue Anfrage — Bestätigung erforderlich' : 'Neue Reservierung'}</p>
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:700;color:#21546A;margin:0;letter-spacing:0.04em;line-height:1.2;">${r.name}</p>
  `, 44, 20)}

  ${infoRows(r)}
  ${bookingCard(r)}
  ${contactRows(r)}

  ${bodyCell(`${divider()}`, 0, 20)}

  ${footerRow}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Statusänderung
// ─────────────────────────────────────────────────────────────────────────────
function adminStatusChangeHTML(r, status) {
  const confirmed = status === 'confirmed';
  const tc = confirmed ? '#C9973A' : '#C0392B';
  return wrap(`
  ${logoRow()}

  ${bodyCell(`
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:${tc};margin:0 0 12px;">${confirmed ? '✓ Reservierung bestätigt' : '✕ Reservierung abgesagt'}</p>
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:700;color:#21546A;margin:0;letter-spacing:0.04em;line-height:1.2;">${r.name}</p>
  `, 44, 20)}

  ${infoRows(r)}
  ${bookingCard(r, tc)}
  ${contactRows(r)}

  ${bodyCell(`${divider()}`, 0, 20)}

  ${footerRow}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Neue Online-Bestellung
// ─────────────────────────────────────────────────────────────────────────────
function adminNewOrderHTML(o) {
  const itemRows = (o.items || []).map(it =>
    `<tr>
      <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#2E1A0E;padding:5px 16px 5px 0;">${it.qty}× ${it.name}</td>
      <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#21546A;padding:5px 0;text-align:right;white-space:nowrap;font-weight:700;">${(it.price * it.qty).toFixed(2).replace('.',',')} €</td>
    </tr>`
  ).join('');
  return wrap(`
  ${logoRow()}

  ${bodyCell(`
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(33,84,106,0.6);margin:0 0 12px;">Neue Bestellung · Abholung</p>
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:700;color:#21546A;margin:0;letter-spacing:0.04em;line-height:1.2;">${o.name || '—'}</p>
  `, 44, 20)}

  <tr><td bgcolor="#FDFAF4" class="pad" style="background-color:#FDFAF4;border-left:1px solid rgba(201,151,58,0.15);border-right:1px solid rgba(201,151,58,0.15);padding:4px 52px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(201,151,58,0.22);background:linear-gradient(160deg,#F5EDD8 0%,#EDE5D9 100%);">
      <tr>
        <td colspan="2" style="padding:14px 20px;border-bottom:1px solid rgba(201,151,58,0.15);">
          <div style="font-family:Georgia,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,151,58,0.55);">Bestellübersicht</div>
        </td>
      </tr>
      <tr><td colspan="2" style="padding:16px 20px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          ${itemRows}
          <tr><td colspan="2" style="padding-top:10px;border-top:1px solid rgba(201,151,58,0.22);"></td></tr>
          <tr>
            <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-weight:700;color:#2E1A0E;padding:4px 0;">Gesamt</td>
            <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:700;color:#21546A;text-align:right;">${(o.total||0).toFixed(2).replace('.',',')} €</td>
          </tr>
        </table>
      </td></tr>
      ${o.notes ? `<tr><td colspan="2" style="padding:10px 20px;border-top:1px solid rgba(201,151,58,0.15);">
        <div style="font-family:Georgia,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,151,58,0.55);margin-bottom:4px;">Hinweis</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:rgba(46,26,14,0.7);font-style:italic;">${o.notes}</div>
      </td></tr>` : ''}
    </table>
  </td></tr>

  ${contactRows({ phone: o.phone, email: o.email || '' })}

  ${bodyCell(`${divider()}`, 0, 20)}

  ${footerRow}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GAST: Bestellbestätigung
// ─────────────────────────────────────────────────────────────────────────────
function guestOrderHTML(o) {
  const firstName = (o.name || '').split(' ')[0];
  const itemRows = (o.items || []).map(it =>
    `<tr>
      <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#2E1A0E;padding:5px 16px 5px 0;">${it.qty}× ${it.name}</td>
      <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#21546A;padding:5px 0;text-align:right;white-space:nowrap;font-weight:700;">${(it.price * it.qty).toFixed(2).replace('.',',')} €</td>
    </tr>`
  ).join('');
  return wrap(`
  ${logoRow()}

  ${bodyCell(`
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(33,84,106,0.6);margin:0 0 12px;">Bestellbestätigung · Abholung</p>
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:700;color:#21546A;margin:0 0 12px;letter-spacing:0.04em;line-height:1.2;">Vielen Dank, ${firstName}!</p>
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:rgba(46,26,14,0.7);margin:0;line-height:1.7;">Wir haben deine Bestellung erhalten und bereiten sie vor. Du kannst sie bald bei uns abholen.</p>
  `, 44, 20)}

  <tr><td bgcolor="#FDFAF4" class="pad" style="background-color:#FDFAF4;border-left:1px solid rgba(201,151,58,0.15);border-right:1px solid rgba(201,151,58,0.15);padding:4px 52px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(201,151,58,0.22);background:linear-gradient(160deg,#F5EDD8 0%,#EDE5D9 100%);">
      <tr>
        <td colspan="2" style="padding:14px 20px;border-bottom:1px solid rgba(201,151,58,0.15);">
          <div style="font-family:Georgia,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,151,58,0.55);">Deine Bestellung</div>
        </td>
      </tr>
      <tr><td colspan="2" style="padding:16px 20px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          ${itemRows}
          <tr><td colspan="2" style="padding-top:10px;border-top:1px solid rgba(201,151,58,0.22);"></td></tr>
          <tr>
            <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-weight:700;color:#2E1A0E;padding:4px 0;">Gesamt</td>
            <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:700;color:#21546A;text-align:right;">${(o.total||0).toFixed(2).replace('.',',')} €</td>
          </tr>
        </table>
      </td></tr>
      ${o.notes ? `<tr><td colspan="2" style="padding:10px 20px;border-top:1px solid rgba(201,151,58,0.15);">
        <div style="font-family:Georgia,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,151,58,0.55);margin-bottom:4px;">Dein Hinweis</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:rgba(46,26,14,0.7);font-style:italic;">${o.notes}</div>
      </td></tr>` : ''}
    </table>
  </td></tr>

  ${bodyCell(`
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid rgba(201,151,58,0.2);border-radius:6px;overflow:hidden;">
      <tr><td style="padding:14px 20px;background:rgba(33,84,106,0.05);">
        <div style="font-family:Georgia,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(33,84,106,0.5);margin-bottom:8px;">Abholung</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#2E1A0E;font-weight:700;">WATENKABAB Restaurant</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:rgba(46,26,14,0.65);margin-top:2px;">${ADDRESS}</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:rgba(46,26,14,0.65);margin-top:2px;">Tel: <a href="tel:${PHONE.replace(/\s/g,'')}" style="color:#21546A;text-decoration:none;">${PHONE}</a></div>
      </td></tr>
    </table>
    ${divider()}
    ${signature}
  `, 28, 40)}

  ${footerRow}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GAST: Bestellung in Zubereitung — Vorbereitungszeit
// ─────────────────────────────────────────────────────────────────────────────
function guestOrderPrepHTML(o) {
  const firstName = (o.name || '').split(' ')[0];
  const mins = o.prep_minutes || 0;
  const itemRows = (o.items || []).map(it =>
    `<tr>
      <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#2E1A0E;padding:5px 16px 5px 0;">${it.qty}× ${it.name}</td>
      <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#21546A;padding:5px 0;text-align:right;white-space:nowrap;font-weight:700;">${(it.price * it.qty).toFixed(2).replace('.',',')} €</td>
    </tr>`
  ).join('');
  return wrap(`
  ${logoRow()}

  ${bodyCell(`
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(33,84,106,0.6);margin:0 0 12px;">In Zubereitung · Abholung</p>
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:700;color:#21546A;margin:0 0 12px;letter-spacing:0.04em;line-height:1.2;">Es geht los, ${firstName}!</p>
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:rgba(46,26,14,0.7);margin:0;line-height:1.7;">Wir haben mit der Zubereitung deiner Bestellung begonnen. In etwa <strong>${mins} Minuten</strong> ist sie zur Abholung bereit.</p>
  `, 44, 20)}

  <tr><td bgcolor="#FDFAF4" style="background-color:#FDFAF4;border-left:1px solid rgba(201,151,58,0.15);border-right:1px solid rgba(201,151,58,0.15);padding:0 40px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(201,151,58,0.22);background:linear-gradient(160deg,#F5EDD8 0%,#EDE5D9 100%);">
      <tr><td style="padding:22px 20px;text-align:center;">
        <div style="font-family:Georgia,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,151,58,0.55);margin-bottom:8px;">Abholbereit in ca.</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:52px;color:#C9973A;font-weight:300;line-height:1;">${mins} <span style="font-size:18px;color:rgba(201,151,58,0.7);">Min.</span></div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td bgcolor="#FDFAF4" class="pad" style="background-color:#FDFAF4;border-left:1px solid rgba(201,151,58,0.15);border-right:1px solid rgba(201,151,58,0.15);padding:4px 52px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(201,151,58,0.22);background:#FDFAF4;">
      <tr>
        <td colspan="2" style="padding:14px 20px;border-bottom:1px solid rgba(201,151,58,0.15);">
          <div style="font-family:Georgia,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(201,151,58,0.55);">Deine Bestellung</div>
        </td>
      </tr>
      <tr><td colspan="2" style="padding:16px 20px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          ${itemRows}
          <tr><td colspan="2" style="padding-top:10px;border-top:1px solid rgba(201,151,58,0.22);"></td></tr>
          <tr>
            <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-weight:700;color:#2E1A0E;padding:4px 0;">Gesamt</td>
            <td style="font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:700;color:#21546A;text-align:right;">${(o.total||0).toFixed(2).replace('.',',')} €</td>
          </tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  ${bodyCell(`
    <table cellpadding="0" cellspacing="0" width="100%" style="border:1px solid rgba(201,151,58,0.2);border-radius:6px;overflow:hidden;">
      <tr><td style="padding:14px 20px;background:rgba(33,84,106,0.05);">
        <div style="font-family:Georgia,sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(33,84,106,0.5);margin-bottom:8px;">Abholung</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;color:#2E1A0E;font-weight:700;">WATENKABAB Restaurant</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:rgba(46,26,14,0.65);margin-top:2px;">${ADDRESS}</div>
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:rgba(46,26,14,0.65);margin-top:2px;">Tel: <a href="tel:${PHONE.replace(/\s/g,'')}" style="color:#21546A;text-decoration:none;">${PHONE}</a></div>
      </td></tr>
    </table>
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:13px;color:rgba(46,26,14,0.5);margin:14px 0 0;line-height:1.7;">Die Zeitangabe ist ein Richtwert. Du bezahlst bequem bei Abholung.</p>
    ${divider()}
    ${signature}
  `, 28, 40)}

  ${footerRow}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test-E-Mail
// ─────────────────────────────────────────────────────────────────────────────
function testEmailHTML() {
  const ts = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
  return wrap(`
  ${logoRow()}

  ${bodyCell(`
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;color:#21546A;margin:0 0 12px;font-weight:700;">E-Mail-System aktiv.</p>
    <p style="font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;color:rgba(46,26,14,0.5);margin:0;line-height:1.8;">Das Benachrichtigungssystem des WATENKABAB Restaurants funktioniert korrekt.<br/>Gesendet: <span style="color:#C9973A;">${ts}</span></p>
    ${divider()}
    ${signature}
  `, 36, 40)}

  ${footerRow}`);
}

// ── Handler ───────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, reservation, to } = req.body || {};

  try {
    if (type === 'test') {
      const target = to || ADMIN_EMAIL;
      await sendMail({ to: target, subject: `WATENKABAB Restaurant — E-Mail-System Test`, html: testEmailHTML() });
      return res.status(200).json({ ok: true, sent: 1, to: target });
    }

    if (!type) return res.status(400).json({ error: 'type erforderlich' });
    if (type !== 'order' && type !== 'order_prep' && !reservation) return res.status(400).json({ error: 'reservation erforderlich' });

    const r = reservation;
    const promises = [];

    if (type === 'new') {
      const isPending = r.status === 'pending';
      promises.push(sendMail({
        to: ADMIN_EMAIL,
        subject: isPending
          ? `⚠ Anfrage: ${r.name} · ${r.date} · ${r.time} · ${r.guests} Pers. — Bestätigung erforderlich`
          : `Neue Buchung: ${r.name} · ${r.date} · ${r.time} · ${r.guests} Pers.`,
        html: adminNewBookingHTML(r),
      }));
      if (r.email) {
        promises.push(sendMail({
          to: r.email,
          subject: isPending
            ? `Ihre Reservierungsanfrage — WATENKABAB Restaurant · ${formatDate(r.date)}`
            : `Reservierungsbestätigung — WATENKABAB Restaurant · ${formatDate(r.date)}`,
          html: isPending ? guestPendingHTML(r) : guestConfirmedHTML(r),
        }));
      }
    } else if (type === 'order') {
      const o = req.body.order || {};
      promises.push(sendMail({
        to: ADMIN_EMAIL,
        subject: `🛍 Neue Bestellung: ${o.name} · ${(o.total||0).toFixed(2).replace('.',',')} € · Abholung`,
        html: adminNewOrderHTML(o),
      }));
      if (o.email) {
        promises.push(sendMail({
          to: o.email,
          subject: `Bestellbestätigung — WATENKABAB Restaurant`,
          html: guestOrderHTML(o),
        }));
      }
    } else if (type === 'order_prep') {
      const o = req.body.order || {};
      if (o.email) {
        promises.push(sendMail({
          to: o.email,
          subject: `Deine Bestellung ist in Zubereitung — in ca. ${o.prep_minutes} Min. abholbereit · WATENKABAB Restaurant`,
          html: guestOrderPrepHTML(o),
        }));
      }
    } else if (type === 'status') {
      if (r.email) {
        promises.push(sendMail({
          to: r.email,
          subject: r.status === 'confirmed'
            ? `Reservierungsbestätigung — WATENKABAB Restaurant · ${formatDate(r.date)}`
            : `Ihre Reservierung — WATENKABAB Restaurant · ${formatDate(r.date)}`,
          html: guestStatusUpdateHTML(r, r.status),
        }));
      }
      promises.push(sendMail({
        to: ADMIN_EMAIL,
        subject: `${r.status === 'confirmed' ? '✓' : '✕'} ${r.name} · ${r.status === 'confirmed' ? 'Bestätigt' : 'Abgesagt'} · ${r.date} · ${r.time}`,
        html: adminStatusChangeHTML(r, r.status),
      }));
    }

    const results = await Promise.allSettled(promises);
    const sent    = results.filter(p => p.status === 'fulfilled').length;
    const errors  = results.filter(p => p.status === 'rejected').map(p => p.reason?.message);
    if (errors.length) console.error('E-Mail Fehler:', errors);
    res.status(200).json({ ok: true, sent, errors: errors.length ? errors : undefined });

  } catch (err) {
    console.error('send-email error:', err);
    res.status(500).json({ error: err.message });
  }
};
