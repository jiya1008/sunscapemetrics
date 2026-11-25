import mongoose from 'mongoose';

export function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

export function parseCoord(value, min, max, fieldName) {
  if (value === undefined || value === null || value === '') return { ok: true, value: undefined };
  const n = Number(value);
  if (Number.isNaN(n) || n < min || n > max) {
    return { ok: false, error: `${fieldName} must be between ${min} and ${max}` };
  }
  return { ok: true, value: n };
}

export function parsePercent(value, fieldName) {
  const n = Number(value);
  if (Number.isNaN(n) || n < 0 || n > 100) {
    return { ok: false, error: `${fieldName} must be between 0 and 100` };
  }
  return { ok: true, value: n };
}

export function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
