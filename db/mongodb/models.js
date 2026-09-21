/**
 * =====================================================================
 * Pizza Shop - MongoDB Schema (Mongoose)
 * =====================================================================
 * ต้องติดตั้งเพิ่ม:  npm install mongoose
 *
 * แนวคิดการออกแบบที่ต่างจาก SQL:
 * - pizza_variants ถูก "ฝัง" (embed) ไว้ใน menu_items เพราะอ่านคู่กันเสมอ
 * - order_items + toppings ฝังไว้ใน orders เพราะเป็นสแนปชอตของราคาตอนสั่ง
 *   (ราคาต้องไม่เปลี่ยนตามเมนูที่แก้ทีหลัง)
 * - customers / ingredients แยก collection เพราะถูกอ้างอิงข้ามหลายที่
 * - แทนที่จะ JOIN เราเก็บชื่อสินค้าซ้ำไว้ในออเดอร์ (denormalize) เพื่อพิมพ์ใบเสร็จได้เร็ว
 */

import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/* ------------------------------ USERS ------------------------------ */
const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password_hash: { type: String, required: true },
    first_name: String,
    last_name: String,
    phone_number: String,
    role: { type: String, enum: ['admin', 'manager', 'staff', 'rider'], default: 'staff' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

/* ---------------------------- CUSTOMERS ---------------------------- */
const addressSchema = new Schema(
  {
    address_line: String,
    sub_district: String,
    district: String,
    province: String,
    postal_code: String,
    is_default: { type: Boolean, default: false },
  },
  { _id: true }
);

const customerSchema = new Schema(
  {
    first_name: String,
    last_name: String,
    phone_number: { type: String, unique: true, index: true },
    email: String,
    points: { type: Number, default: 0 },
    addresses: [addressSchema], // ฝังที่อยู่ไว้เลย ลูกค้า 1 คนมีไม่กี่ที่อยู่
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

/* ------------------------------ MENU ------------------------------- */
const categorySchema = new Schema({
  name: { type: String, required: true },
  description: String,
});

const variantSchema = new Schema(
  {
    size: String, // S | M | L | STD
    crust: String,
    sauce: String,
    price: { type: Number, required: true },
    is_available: { type: Boolean, default: true },
    recipe: [
      {
        ingredient_id: { type: Schema.Types.ObjectId, ref: 'Ingredient' },
        quantity_used: Number,
      },
    ],
  },
  { _id: true }
);

const menuItemSchema = new Schema({
  category_id: { type: Schema.Types.ObjectId, ref: 'Category', index: true },
  name: { type: String, required: true },
  description: String,
  image_url: String,
  is_active: { type: Boolean, default: true },
  variants: [variantSchema], // embed: อ่านเมนูทีเดียวได้ราคาครบทุกขนาด
});

const toppingSchema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  is_available: { type: Boolean, default: true },
});

/* ------------------------------ STOCK ------------------------------ */
const ingredientSchema = new Schema({
  name: { type: String, required: true },
  stock_quantity: { type: Number, default: 0 },
  unit: String,
  min_required_quantity: { type: Number, default: 0 },
});

const inventoryLogSchema = new Schema(
  {
    ingredient_id: { type: Schema.Types.ObjectId, ref: 'Ingredient', index: true },
    change_quantity: Number,
    type: { type: String, enum: ['restock', 'sale', 'waste', 'adjust'] },
    reference_order_id: { type: Schema.Types.ObjectId, ref: 'Order' },
    user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    note: String,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

/* --------------------------- PROMOTIONS ---------------------------- */
const promotionSchema = new Schema({
  code: { type: String, unique: true, uppercase: true },
  name: String,
  discount_type: { type: String, enum: ['percent', 'amount'] },
  discount_value: Number,
  min_order_amount: { type: Number, default: 0 },
  start_date: Date,
  end_date: Date,
  is_active: { type: Boolean, default: true },
});

/* ----------------------------- ORDERS ------------------------------ */
const orderItemSchema = new Schema(
  {
    menu_item_id: { type: Schema.Types.ObjectId, ref: 'MenuItem' },
    variant_id: Schema.Types.ObjectId,
    menu_name: String, // สแนปชอตชื่อ ณ เวลาสั่ง
    size: String,
    crust: String,
    quantity: { type: Number, default: 1, min: 1 },
    unit_price: Number,
    total_price: Number,
    note: String,
    toppings: [
      {
        topping_id: { type: Schema.Types.ObjectId, ref: 'Topping' },
        name: String,
        quantity: { type: Number, default: 1 },
        price: Number,
      },
    ],
  },
  { _id: true }
);

const orderSchema = new Schema(
  {
    order_code: { type: String, unique: true, index: true },
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    customer_snapshot: { name: String, phone: String, address: String },
    promotion_code: String,
    order_type: { type: String, enum: ['delivery', 'pickup', 'dine_in'], default: 'pickup' },
    status: {
      type: String,
      enum: ['pending', 'preparing', 'ready', 'delivering', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    items: [orderItemSchema],
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    delivery_fee: { type: Number, default: 0 },
    total_amount: { type: Number, default: 0 },
    payment: {
      method: { type: String, enum: ['cash', 'promptpay', 'card', 'transfer'] },
      status: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
      transaction_ref: String,
      paid_at: Date,
    },
    delivery: {
      rider_id: { type: Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['assigned', 'picked_up', 'delivered', 'failed'] },
      delivered_at: Date,
    },
    note: String,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

orderSchema.index({ created_at: -1 });

/* ----------------------------- REVIEWS ----------------------------- */
const reviewSchema = new Schema(
  {
    order_id: { type: Schema.Types.ObjectId, ref: 'Order' },
    customer_id: { type: Schema.Types.ObjectId, ref: 'Customer' },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

export const User = model('User', userSchema);
export const Customer = model('Customer', customerSchema);
export const Category = model('Category', categorySchema);
export const MenuItem = model('MenuItem', menuItemSchema);
export const Topping = model('Topping', toppingSchema);
export const Ingredient = model('Ingredient', ingredientSchema);
export const InventoryLog = model('InventoryLog', inventoryLogSchema);
export const Promotion = model('Promotion', promotionSchema);
export const Order = model('Order', orderSchema);
export const Review = model('Review', reviewSchema);

/* ---------------------------------------------------------------------
 * ตัวอย่าง aggregation: ยอดขายรายวัน (เทียบเท่า view v_daily_sales)
 * --------------------------------------------------------------------- */
export const dailySales = () =>
  Order.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
        total_orders: { $sum: 1 },
        revenue: { $sum: '$total_amount' },
        avg_order_value: { $avg: '$total_amount' },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: 30 },
  ]);

/* ตัวอย่าง aggregation: เมนูขายดี */
export const bestSellers = () =>
  Order.aggregate([
    { $match: { status: 'completed' } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.menu_name',
        sold: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.total_price' },
      },
    },
    { $sort: { sold: -1 } },
    { $limit: 10 },
  ]);

/* วัตถุดิบใกล้หมด */
export const lowStock = () =>
  Ingredient.find({ $expr: { $lte: ['$stock_quantity', '$min_required_quantity'] } });
