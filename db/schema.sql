-- =====================================================================
-- Pizza Shop - Full Schema (PostgreSQL / Supabase)
-- =====================================================================

-- ---------- USERS / STAFF ----------
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone_number VARCHAR(20),
  role VARCHAR(20) DEFAULT 'staff',      -- admin | manager | staff | rider
  status VARCHAR(20) DEFAULT 'active',   -- active | inactive
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- CUSTOMERS ----------
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone_number VARCHAR(20) UNIQUE,
  email VARCHAR(150),
  points INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
  address_line TEXT,
  sub_district VARCHAR(100),
  district VARCHAR(100),
  province VARCHAR(100),
  postal_code VARCHAR(10),
  is_default BOOLEAN DEFAULT FALSE
);

-- ---------- MENU ----------
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  category_id INT REFERENCES categories(id),
  name VARCHAR(150) NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS pizza_variants (
  id SERIAL PRIMARY KEY,
  menu_item_id INT REFERENCES menu_items(id) ON DELETE CASCADE,
  size VARCHAR(20),          -- S | M | L
  crust VARCHAR(50),         -- classic | thin | pan | cheese_burst
  sauce VARCHAR(50),         -- tomato | bbq | creamy
  price NUMERIC(10,2) NOT NULL,
  is_available BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS toppings (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  is_available BOOLEAN DEFAULT TRUE
);

-- ---------- STOCK ----------
CREATE TABLE IF NOT EXISTS ingredients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  stock_quantity NUMERIC(10,2) DEFAULT 0,
  unit VARCHAR(20),
  min_required_quantity NUMERIC(10,2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pizza_recipes (
  id SERIAL PRIMARY KEY,
  pizza_variant_id INT REFERENCES pizza_variants(id) ON DELETE CASCADE,
  ingredient_id INT REFERENCES ingredients(id),
  quantity_used NUMERIC(10,2) NOT NULL,
  UNIQUE (pizza_variant_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS inventory_logs (
  id SERIAL PRIMARY KEY,
  ingredient_id INT REFERENCES ingredients(id),
  change_quantity NUMERIC(10,2) NOT NULL,  -- + รับเข้า / - ตัดออก
  type VARCHAR(20),                        -- restock | sale | waste | adjust
  reference_order_id INT,
  user_id INT REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- PROMOTIONS ----------
CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE,
  name VARCHAR(150),
  discount_type VARCHAR(20),   -- percent | amount
  discount_value NUMERIC(10,2),
  min_order_amount NUMERIC(10,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT TRUE
);

-- ---------- ORDERS ----------
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_code VARCHAR(30) UNIQUE,
  customer_id INT REFERENCES customers(id),
  user_id INT REFERENCES users(id),          -- พนักงานที่รับออเดอร์
  address_id INT REFERENCES addresses(id),
  promotion_id INT REFERENCES promotions(id),
  order_type VARCHAR(20) DEFAULT 'pickup',   -- delivery | pickup | dine_in
  status VARCHAR(20) DEFAULT 'pending',      -- pending | preparing | ready | delivering | completed | cancelled
  subtotal NUMERIC(10,2) DEFAULT 0,
  discount NUMERIC(10,2) DEFAULT 0,
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INT REFERENCES menu_items(id),
  pizza_variant_id INT REFERENCES pizza_variants(id),
  quantity INT NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS order_item_toppings (
  id SERIAL PRIMARY KEY,
  order_item_id INT REFERENCES order_items(id) ON DELETE CASCADE,
  topping_id INT REFERENCES toppings(id),
  quantity INT DEFAULT 1,
  price NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  method VARCHAR(20),       -- cash | promptpay | card | transfer
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'unpaid',  -- unpaid | paid | refunded
  transaction_ref VARCHAR(100),
  paid_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deliveries (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  rider_id INT REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'assigned',  -- assigned | picked_up | delivered | failed
  picked_up_at TIMESTAMP,
  delivered_at TIMESTAMP,
  note TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  customer_id INT REFERENCES customers(id),
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- INDEXES ----------
CREATE INDEX IF NOT EXISTS idx_orders_customer   ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created    ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_variants_menu     ON pizza_variants(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_variant   ON pizza_recipes(pizza_variant_id);

-- ---------- TRIGGER: updated_at ----------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- VIEWS ----------
CREATE OR REPLACE VIEW v_menu_full AS
SELECT
  m.id            AS menu_item_id,
  m.name          AS menu_name,
  m.description,
  m.image_url,
  m.is_active,
  c.id            AS category_id,
  c.name          AS category_name,
  v.id            AS variant_id,
  v.size, v.crust, v.sauce, v.price, v.is_available
FROM menu_items m
JOIN categories c      ON c.id = m.category_id
LEFT JOIN pizza_variants v ON v.menu_item_id = m.id;

CREATE OR REPLACE VIEW v_daily_sales AS
SELECT
  DATE(created_at)      AS sale_date,
  COUNT(*)              AS total_orders,
  SUM(total_amount)     AS revenue,
  ROUND(AVG(total_amount), 2) AS avg_order_value
FROM orders
WHERE status = 'completed'
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;

CREATE OR REPLACE VIEW v_low_stock AS
SELECT id, name, stock_quantity, min_required_quantity, unit
FROM ingredients
WHERE stock_quantity <= min_required_quantity;
