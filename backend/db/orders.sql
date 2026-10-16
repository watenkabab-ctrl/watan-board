-- Watan Kabab — Bestell-Datenbank (eigene DB auf Railway)
-- In der Railway-Postgres "watan-orders" ausführen (psql / Query-Tab).

CREATE TABLE IF NOT EXISTS orders (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  email        TEXT,
  pickup_time  TEXT,                 -- gewünschte Abholzeit ("asap" oder HH:MM)
  note         TEXT,
  total        NUMERIC(8,2) NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'new',  -- new | preparing | ready | done | cancelled
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id         BIGSERIAL PRIMARY KEY,
  order_id   BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id    TEXT,
  name       TEXT NOT NULL,
  qty        INTEGER NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(8,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
