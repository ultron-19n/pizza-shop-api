import { ApiError } from '../utils/ApiError.js';

/**
 * ตัวตรวจข้อมูลขนาดเล็ก ไม่ต้องลง joi/zod เพิ่ม
 *
 * ใช้:  router.post('/', validate(orderSchema), controller.create)
 *
 * schema = { field: { required, type, min, max, enum, minLength } }
 * ตรวจครบทุกฟิลด์ก่อนแล้วค่อยโยน error ทีเดียว
 * ผู้ใช้จะได้เห็นทุกจุดที่ผิดพร้อมกัน ไม่ใช่ทีละจุด
 */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const data = req[source] || {};
  const errors = {};

  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field];
    const isEmpty = value === undefined || value === null || value === '';

    if (rule.required && isEmpty) {
      errors[field] = rule.label ? `กรุณากรอก${rule.label}` : `${field} จำเป็นต้องมี`;
      continue;
    }
    if (isEmpty) continue;

    if (rule.type === 'number' && Number.isNaN(Number(value))) {
      errors[field] = `${rule.label || field} ต้องเป็นตัวเลข`;
    } else if (rule.type === 'array' && !Array.isArray(value)) {
      errors[field] = `${rule.label || field} ต้องเป็นรายการ`;
    } else if (rule.type === 'string' && typeof value !== 'string') {
      errors[field] = `${rule.label || field} ต้องเป็นข้อความ`;
    }

    if (rule.enum && !rule.enum.includes(value)) {
      errors[field] = `${rule.label || field} ต้องเป็นหนึ่งใน: ${rule.enum.join(', ')}`;
    }
    if (rule.minLength && String(value).length < rule.minLength) {
      errors[field] = `${rule.label || field} ต้องยาวอย่างน้อย ${rule.minLength} ตัวอักษร`;
    }
    if (rule.min !== undefined && Number(value) < rule.min) {
      errors[field] = `${rule.label || field} ต้องไม่น้อยกว่า ${rule.min}`;
    }
    if (rule.max !== undefined && Number(value) > rule.max) {
      errors[field] = `${rule.label || field} ต้องไม่เกิน ${rule.max}`;
    }
    if (rule.notEmpty && Array.isArray(value) && value.length === 0) {
      errors[field] = rule.emptyMessage || `${rule.label || field} ต้องมีอย่างน้อย 1 รายการ`;
    }
  }

  if (Object.keys(errors).length) {
    return next(ApiError.badRequest('ข้อมูลที่ส่งมาไม่ถูกต้อง', errors));
  }
  next();
};
