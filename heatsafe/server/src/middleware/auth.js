import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AppError } from './errorHandler.js';

export async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new AppError('Not authenticated', 401);

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      throw new AppError('Session expired. Please log in again.', 401);
    }

    const user = await User.findById(payload.id);
    if (!user) throw new AppError('Account no longer exists', 401);

    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}