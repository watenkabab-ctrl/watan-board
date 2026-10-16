-- Watan Kabab — Reservierungs-Datenbank (eigene DB auf Railway)
-- In der Railway-Postgres "watan-reservations" ausführen (psql / Query-Tab).

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Standard-Konfiguration (Öffnungszeiten, Kapazität, Stornofrist)
INSERT INTO settings (key, value) VALUES ('config', '{
  "from": 12,
  "to": 23,
  "slotInterval": 30,
  "resDuration": 120,
  "maxGuestsPerSlot": 20,
  "maxAutoConfirmGuests": 9,
  "maxAdvanceDays": 60,
  "cancelHours": 2,
  "closedDays": [1],
  "schedule": {
    "0": {"open": true,  "from": 13, "to": 22},
    "1": {"open": false},
    "2": {"open": true,  "from": 13, "to": 22},
    "3": {"open": true,  "from": 13, "to": 22},
    "4": {"open": true,  "from": 13, "to": 22},
    "5": {"open": true,  "from": 13, "to": 23},
    "6": {"open": true,  "from": 13, "to": 23}
  }
}') ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS reservations (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  guests      INTEGER NOT NULL CHECK (guests > 0),
  date        DATE NOT NULL,
  time        TEXT NOT NULL,
  occasion    TEXT,
  note        TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | cancelled
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_res_date ON reservations(date) WHERE status <> 'cancelled';

-- Manuell gesperrte Slots (ganzer Tag = time IS NULL)
CREATE TABLE IF NOT EXISTS blocked_slots (
  id      BIGSERIAL PRIMARY KEY,
  date    DATE NOT NULL,
  time    TEXT,
  reason  TEXT
);
CREATE INDEX IF NOT EXISTS idx_block_date ON blocked_slots(date);
