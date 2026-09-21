/** ห่อ async handler ให้ error เด้งเข้า errorHandler เอง */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
