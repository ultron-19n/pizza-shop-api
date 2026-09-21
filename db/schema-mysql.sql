-- =====================================================================
-- Pizza Shop - MySQL / MariaDB Schema
-- รัน: mysql -u root -p < db/schema-mysql.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS pizza_shop
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pizza_shop;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name    VARCHAR(100),
  last_name     VARCHAR(100),
  phone_number  VARCHAR(20),
  role          ENUM('admin','manager','staff','rider') DEFAULT 'staff',
  status        ENUM('active','inactive') DEFAULT 'active',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customers (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  first_name   VARCHAR(100),
  last_name    VARCHAR(100),
  phone_number VARCHAR(20) UNIQUE,
  email        VARCHAR(150),
  points       INT DEFAULT 0,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS addresses (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  customer_id  INT,
  address_line TEXT,
  sub_district VARCHAR(100),
  district     VARCHAR(100),
  province     VARCHAR(100),
  postal_code  VARCHAR(10),
  is_default   BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menu_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  image_url   TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pizza_variants (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  menu_item_id INT,
  size         VARCHAR(20),
  crust        VARCHAR(50),
  sauce        VARCHAR(50),
  price        DECIMAL(10,2) NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS toppings (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  price        DECIMAL(10,2) NOT NULL,
  is_available BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ingredients (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  name                  VARCHAR(100) NOT NULL,
  stock_quantity        DECIMAL(10,2) DEFAULT 0,
  unit                  VARCHAR(20),
  min_required_quantity DECIMAL(10,2) DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pizza_recipes (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  pizza_variant_id INT,
  ingredient_id    INT,
  quantity_used    DECIMAL(10,2) NOT NULL,
  UNIQUE KEY uq_recipe (pizza_variant_id, ingredient_id),
  FOREIGN KEY (pizza_variant_id) REFERENCES pizza_variants(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id)    REFERENCES ingredients(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_logs (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  ingredient_id      INT,
  change_quantity    DECIMAL(10,2) NOT NULL,
  type               ENUM('restock','sale','waste','adjust'),
  reference_order_id INT,
  user_id            INT,
  note               TEXT,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id),
  FOREIGN KEY (user_id)       REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS promotions (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  code             VARCHAR(50) UNIQUE,
  name             VARCHAR(150),
  discount_type    ENUM('percent','amount'),
  discount_value   DECIMAL(10,2),
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  start_date       DATE,
  end_date         DATE,
  is_active        BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_code   VARCHAR(30) UNIQUE,
  customer_id  INT,
  user_id      INT,
  address_id   INT,
  promotion_id INT,
  order_type   ENUM('delivery','pickup','dine_in') DEFAULT 'pickup',
  status       ENUM('pending','preparing','ready','delivering','completed','cancelled') DEFAULT 'pending',
  subtotal     DECIMAL(10,2) DEFAULT 0,
  discount     DECIMAL(10,2) DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  note         TEXT,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id)  REFERENCES customers(id),
  FOREIGN KEY (user_id)      REFERENCES users(id),
  FOREIGN KEY (address_id)   REFERENCES addresses(id),
  FOREIGN KEY (promotion_id) REFERENCES promotions(id),
  INDEX idx_orders_customer (customer_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  order_id         INT,
  menu_item_id     INT,
  pizza_variant_id INT,
  quantity         INT NOT NULL DEFAULT 1,
  unit_price       DECIMAL(10,2) NOT NULL,
  total_price      DECIMAL(10,2) NOT NULL,
  note             TEXT,
  FOREIGN KEY (order_id)         REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id)     REFERENCES menu_items(id),
  FOREIGN KEY (pizza_variant_id) REFERENCES pizza_variants(id),
  INDEX idx_order_items_order (order_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_item_toppings (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  order_item_id INT,
  topping_id    INT,
  quantity      INT DEFAULT 1,
  price         DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  FOREIGN KEY (topping_id)    REFERENCES toppings(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  order_id        INT,
  method          ENUM('cash','promptpay','card','transfer'),
  amount          DECIMAL(10,2) NOT NULL,
  status          ENUM('unpaid','paid','refunded') DEFAULT 'unpaid',
  transaction_ref VARCHAR(100),
  paid_at         TIMESTAMP NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS deliveries (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_id     INT,
  rider_id     INT,
  status       ENUM('assigned','picked_up','delivered','failed') DEFAULT 'assigned',
  picked_up_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  note         TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (rider_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reviews (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT,
  customer_id INT,
  rating      INT CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id)    REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB;

-- ---------- VIEWS ----------
CREATE OR REPLACE VIEW v_daily_sales AS
SELECT DATE(created_at) AS sale_date,
       COUNT(*)          AS total_orders,
       SUM(total_amount) AS revenue,
       ROUND(AVG(total_amount), 2) AS avg_order_value
FROM orders WHERE status = 'completed'
GROUP BY DATE(created_at);

CREATE OR REPLACE VIEW v_low_stock AS
SELECT id, name, stock_quantity, min_required_quantity, unit
FROM ingredients WHERE stock_quantity <= min_required_quantity;

-- =====================================================================
-- ความต่างจาก PostgreSQL
-- 1. SERIAL       -> INT AUTO_INCREMENT
-- 2. CHECK (...)  -> ใช้ ENUM แทนจะเร็วและอ่านง่ายกว่า
-- 3. updated_at   -> ใช้ ON UPDATE CURRENT_TIMESTAMP แทน trigger
-- 4. ILIKE        -> LIKE (collation utf8mb4_unicode_ci ไม่สนตัวพิมพ์อยู่แล้ว)
-- 5. json_agg()   -> JSON_ARRAYAGG() / JSON_OBJECT() (MySQL 8.0 ขึ้นไป)
-- 6. RETURNING *  -> MySQL ไม่มี ต้องใช้ result.insertId แล้ว SELECT ซ้ำ
-- =====================================================================
