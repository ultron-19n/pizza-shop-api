/**
 * ApiError — แทนการเขียน Object.assign(new Error(...), { status: 400 })
 * ทำให้ service ชั้นในโยน error ที่มีความหมายได้ โดยไม่ต้องรู้จัก req/res
 */
export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message, details)  { return new ApiError(400, message, details); }
  static unauthorized(message = 'กรุณาเข้าสู่ระบบ') { return new ApiError(401, message); }
  static forbidden(message = 'ไม่มีสิทธิ์เข้าถึงส่วนนี้') { return new ApiError(403, message); }
  static notFound(message = 'ไม่พบข้อมูลที่ต้องการ') { return new ApiError(404, message); }
  static conflict(message)             { return new ApiError(409, message); }
  static internal(message = 'เกิดข้อผิดพลาดภายในระบบ') { return new ApiError(500, message); }
}
