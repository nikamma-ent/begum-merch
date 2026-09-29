-- Run once: npx wrangler d1 execute begum-merch --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,              -- pickup code, e.g. WAO-7K3Q2
  city           TEXT NOT NULL,
  name           TEXT NOT NULL,
  phone          TEXT NOT NULL,
  email          TEXT NOT NULL,
  amount         INTEGER NOT NULL,              -- paise
  status         TEXT NOT NULL DEFAULT 'pending', -- pending | paid | expired
  rzp_order_id   TEXT UNIQUE,
  rzp_payment_id TEXT,
  created_at     INTEGER NOT NULL,              -- ms since epoch
  paid_at        INTEGER
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id   TEXT NOT NULL REFERENCES orders(id),
  design     TEXT NOT NULL,
  size       TEXT NOT NULL,
  qty        INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,                  -- paise
  PRIMARY KEY (order_id, design, size)
);

CREATE TABLE IF NOT EXISTS stock (
  sku  TEXT PRIMARY KEY,                        -- city:design:size
  held INTEGER NOT NULL DEFAULT 0               -- paid + currently pending
);

CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_city_status ON orders(city, status);
