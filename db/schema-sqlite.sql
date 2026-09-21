-- =====================================================================
-- Pizza Shop - SQLite Schema
-- ใช้กับ better-sqlite3 / sqlite3 / DB Browser for SQLite
-- รัน: sqlite3 pizza_shop.db < db/schema-sqlite.sql
-- =====================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name    TEXT,
  last_name     TEXT,
  phone_number  TEXT,
  role          TEXT DEFAULT 'staff'  CHECK (role IN ('admin','manager','staff','rider')),
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at    TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS customers (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name   TEXT,
  last_name    TEXT,
  phone_number TEXT UNIQUE,
  email        TEXT,
  points       INTEGER DEFAULT 0,
  created_at   TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS addresses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id  INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  address_line TEXT,
  sub_district TEXT,
  district     TEXT,
  province     TEXT,
  postal_code  TEXT,
  is_default   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS menu_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories(id),
  name        TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  is_active   INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pizza_variants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_item_id  INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
  size          TEXT,
  crust         TEXT,
  sauce         TEXT,
  price         REAL NOT NULL,
  is_available  INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS toppings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  price        REAL NOT NULL,
  is_available INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS ingredients (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT NOT NULL,
  stock_quantity        REAL DEFAULT 0,
  unit                  TEXT,
  min_required_quantity REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pizza_recipes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  pizza_variant_id INTEGER REFERENCES pizza_variants(id) ON DELETE CASCADE,
  ingredient_id    INTEGER REFERENCES ingredients(id),
  quantity_used    REAL NOT NULL,
  UNIQUE (pizza_variant_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS inventory_logs (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  ingredient_id      INTEGER REFERENCES ingredients(id),
  change_quantity    REAL NOT NULL,
  type               TEXT CHECK (type IN ('restock','sale','waste','adjust')),
  reference_order_id INTEGER,
  user_id            INTEGER REFERENCES users(id),
  note               TEXT,
  created_at         TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS promotions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT UNIQUE,
  name             TEXT,
  discount_type    TEXT CHECK (discount_type IN ('percent','amount')),
  discount_value   REAL,
  min_order_amount REAL DEFAULT 0,
  start_date       TEXT,
  end_date         TEXT,
  is_active        INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_code    TEXT UNIQUE,
  customer_id   INTEGER REFERENCES customers(id),
  user_id       INTEGER REFERENCES users(id),
  address_id    INTEGER REFERENCES addresses(id),
  promotion_id  INTEGER REFERENCES promotions(id),
  order_type    TEXT DEFAULT 'pickup'  CHECK (order_type IN ('delivery','pickup','dine_in')),
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','delivering','completed','cancelled')),
  subtotal      REAL DEFAULT 0,
  discount      REAL DEFAULT 0,
  delivery_fee  REAL DEFAULT 0,
  total_amount  REAL DEFAULT 0,
  note          TEXT,
  created_at    TEXT DEFAULT (datetime('now','localtime')),
  updated_at    TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id         INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id     INTEGER REFERENCES menu_items(id),
  pizza_variant_id INTEGER REFERENCES pizza_variants(id),
  quantity         INTEGER NOT NULL DEFAULT 1,
  unit_price       REAL NOT NULL,
  total_price      REAL NOT NULL,
  note             TEXT
);

CREATE TABLE IF NOT EXISTS order_item_toppings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  order_item_id INTEGER REFERENCES order_items(id) ON DELETE CASCADE,
  topping_id    INTEGER REFERENCES toppings(id),
  quantity      INTEGER DEFAULT 1,
  price         REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id        INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  method          TEXT CHECK (method IN ('cash','promptpay','card','transfer')),
  amount          REAL NOT NULL,
  status          TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid','paid','refunded')),
  transaction_ref TEXT,
  paid_at         TEXT
);

CREATE TABLE IF NOT EXISTS deliveries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id     INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  rider_id     INTEGER REFERENCES users(id),
  status       TEXT DEFAULT 'assigned' CHECK (status IN ('assigned','picked_up','delivered','failed')),
  picked_up_at TEXT,
  delivered_at TEXT,
  note         TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id),
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);

-- ---------- INDEXES ----------
CREATE INDEX IF NOT EXISTS idx_orders_customer   ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_variants_menu     ON pizza_variants(menu_item_id);

-- ---------- TRIGGER: updated_at ----------
CREATE TRIGGER IF NOT EXISTS trg_orders_updated_at
AFTER UPDATE ON orders
BEGIN
  UPDATE orders SET updated_at = datetime('now','localtime') WHERE id = NEW.id;
END;

-- ---------- VIEWS ----------
CREATE VIEW IF NOT EXISTS v_daily_sales AS
SELECT DATE(created_at) AS sale_date,
       COUNT(*)         AS total_orders,
       SUM(total_amount) AS revenue,
       ROUND(AVG(total_amount), 2) AS avg_order_value
FROM orders WHERE status = 'completed'
GROUP BY DATE(created_at);

CREATE VIEW IF NOT EXISTS v_low_stock AS
SELECT id, name, stock_quantity, min_required_quantity, unit
FROM ingredients WHERE stock_quantity <= min_required_quantity;

-- =====================================================================
-- ความต่างที่ต้องรู้เมื่อย้ายจาก PostgreSQL มา SQLite
-- 1. SERIAL          -> INTEGER PRIMARY KEY AUTOINCREMENT
-- 2. BOOLEAN         -> INTEGER (0/1) SQLite ไม่มีชนิด boolean จริง
-- 3. NUMERIC(10,2)   -> REAL (ถ้าต้องการความแม่นยำเรื่องเงิน ให้เก็บเป็นสตางค์ในชนิด INTEGER)
-- 4. TIMESTAMP       -> TEXT เก็บเป็น ISO string
-- 5. ต้องสั่ง PRAGMA foreign_keys = ON; ทุกครั้งที่เปิด connection
-- 6. ไม่มี ILIKE  -> ใช้ LIKE (SQLite ไม่สนตัวพิมพ์เล็กใหญ่กับ ASCII อยู่แล้ว)
-- =====================================================================
