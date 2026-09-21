import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcDiscount,
  calcTotals,
  calcLoyaltyPoints,
  normalizeQuantity,
} from '../src/services/pricing.rules.js';
import { toSatang, toBaht, toDecimal, generateOrderCode } from '../src/utils/money.js';

/**
 * รันด้วย:  npm test
 *
 * เทสชุดนี้ไม่ต้องต่อฐานข้อมูลเลย เพราะกฎการคิดเงินถูกแยกออกมา
 * เป็นฟังก์ชันบริสุทธิ์แล้ว — นี่คือเหตุผลหลักของการ refactor
 */

const item = (baht, qty = 1) => ({ total_satang: toSatang(baht) * qty });

describe('การคิดส่วนลด', () => {
  test('ลดเป็นเปอร์เซ็นต์', () => {
    const promo = { discount_type: 'percent', discount_value: 10, min_order_amount: 200 };
    assert.equal(calcDiscount(toSatang(500), promo), toSatang(50));
  });

  test('ลดเป็นจำนวนเงิน', () => {
    const promo = { discount_type: 'amount', discount_value: 50, min_order_amount: 500 };
    assert.equal(calcDiscount(toSatang(600), promo), toSatang(50));
  });

  test('ไม่มีโค้ด = ไม่ลด', () => {
    assert.equal(calcDiscount(toSatang(500), null), 0);
  });

  test('ยอดไม่ถึงขั้นต่ำ ต้องโยน error พร้อมบอกว่าขาดอีกเท่าไร', () => {
    const promo = { discount_type: 'amount', discount_value: 50, min_order_amount: 500 };
    assert.throws(
      () => calcDiscount(toSatang(416), promo),
      (err) => err.status === 400 && err.message.includes('84')
    );
  });

  test('ส่วนลดต้องไม่เกินยอดสินค้า', () => {
    const promo = { discount_type: 'amount', discount_value: 1000, min_order_amount: 0 };
    assert.equal(calcDiscount(toSatang(200), promo), toSatang(200));
  });
});

describe('การรวมยอดบิล', () => {
  test('รับที่ร้าน ไม่มีค่าส่ง', () => {
    const r = calcTotals({ items: [item(289), item(379, 2)], promotion: null, orderType: 'pickup' });
    assert.equal(toBaht(r.subtotal_satang), 1047);
    assert.equal(r.delivery_fee_satang, 0);
    assert.equal(toBaht(r.total_satang), 1047);
  });

  test('ส่งถึงบ้าน บวกค่าส่ง 39 บาท', () => {
    const r = calcTotals({ items: [item(289)], promotion: null, orderType: 'delivery' });
    assert.equal(toBaht(r.total_satang), 328);
  });

  test('มีทั้งส่วนลดและค่าส่ง', () => {
    const promo = { discount_type: 'percent', discount_value: 10, min_order_amount: 200 };
    const r = calcTotals({ items: [item(500)], promotion: promo, orderType: 'delivery' });
    assert.equal(toBaht(r.discount_satang), 50);
    assert.equal(toBaht(r.total_satang), 489); // 500 - 50 + 39
  });

  test('ตะกร้าว่าง ยอดเป็นศูนย์', () => {
    const r = calcTotals({ items: [], promotion: null, orderType: 'pickup' });
    assert.equal(r.total_satang, 0);
  });
});

describe('จำนวนสินค้า', () => {
  test('ค่าติดลบหรือศูนย์ ถูกปรับเป็น 1', () => {
    assert.equal(normalizeQuantity(-5), 1);
    assert.equal(normalizeQuantity(0), 1);
  });

  test('ค่าที่ไม่ใช่ตัวเลข ถูกปรับเป็น 1', () => {
    assert.equal(normalizeQuantity('abc'), 1);
    assert.equal(normalizeQuantity(undefined), 1);
  });

  test('ทศนิยมถูกตัดเป็นจำนวนเต็ม', () => {
    assert.equal(normalizeQuantity(2.9), 2);
  });
});

describe('แต้มสะสม', () => {
  test('25 บาท = 1 แต้ม ปัดลง', () => {
    assert.equal(calcLoyaltyPoints(toSatang(100)), 4);
    assert.equal(calcLoyaltyPoints(toSatang(124)), 4);
    assert.equal(calcLoyaltyPoints(toSatang(24)), 0);
  });
});

describe('การคิดเงินแบบสตางค์', () => {
  test('ไม่มีปัญหาทศนิยมสะสมแบบ 0.1 + 0.2', () => {
    const r = calcTotals({
      items: [item(0.1), item(0.2)],
      promotion: null,
      orderType: 'pickup',
    });
    assert.equal(toBaht(r.subtotal_satang), 0.3); // ถ้าใช้ float ตรง ๆ จะได้ 0.30000000000000004
  });

  test('แปลงเป็นรูปแบบที่บันทึกลง NUMERIC(10,2) ได้', () => {
    assert.equal(toDecimal(1047.005), '1047.01');
    assert.equal(toDecimal(289), '289.00');
  });
});

describe('รหัสออเดอร์', () => {
  test('รูปแบบ PZyymmdd-nnnn', () => {
    const code = generateOrderCode(new Date('2026-09-11T10:00:00Z'));
    assert.match(code, /^PZ260911-\d{4}$/);
  });

  test('ใช้วันที่เวลาไทย: ตี 1 ของวันที่ 12 (เวลาไทย) ต้องไม่ได้รหัสวันที่ 11', () => {
    // 2026-09-11T18:00:00Z = 2026-09-12 01:00 น. ที่กรุงเทพ
    assert.match(generateOrderCode(new Date('2026-09-11T18:00:00Z')), /^PZ260912-\d{4}$/);
    // 2026-09-11T16:59:59Z = 2026-09-11 23:59:59 น. ที่กรุงเทพ ยังเป็นวันที่ 11
    assert.match(generateOrderCode(new Date('2026-09-11T16:59:59Z')), /^PZ260911-\d{4}$/);
  });

  test('เลขท้ายอยู่ในช่วง 1000–9999 เสมอ', () => {
    for (let i = 0; i < 2000; i++) {
      const n = Number(generateOrderCode().split('-')[1]);
      assert.ok(n >= 1000 && n <= 9999, `ได้ ${n}`);
    }
  });
});
