import * as customerRepo from '../repositories/customer.repository.js';
import { ApiError } from '../utils/ApiError.js';

export const search = ({ phone, search }) =>
  customerRepo.search({ phone: phone || null, name: search || null });

export async function getById(id) {
  const customer = await customerRepo.findByIdWithAddresses(id);
  if (!customer) throw ApiError.notFound('ไม่พบลูกค้า');
  return customer;
}

export const upsert = (data) => customerRepo.upsertByPhone(data);

export async function addAddress(customerId, address) {
  await getById(customerId);
  if (address.is_default) await customerRepo.clearDefaultAddress(customerId);
  return customerRepo.insertAddress(customerId, address);
}
