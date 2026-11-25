import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function signToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new AppError('JWT_SECRET is not set in server/.env', 500);
  }
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

export async function register(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!name) throw new AppError('Name is required');
    if (!EMAIL_RE.test(email)) throw new AppError('Enter a valid email address');
    if (password.length < 8) throw new AppError('Password must be at least 8 characters');

    if (await User.exists({ email })) {
      throw new AppError('An account with this email already exists', 409);
    }

    const user = await User.create({ name, email, password });
    res.status(201).json({ success: true, token: signToken(user._id), user: publicUser(user) });
  } catch (e) {
    if (e.code === 11000) return next(new AppError('An account with this email already exists', 409));
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) throw new AppError('Email and password are required');

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Invalid email or password', 401);
    }

    res.json({ success: true, token: signToken(user._id), user: publicUser(user) });
  } catch (e) {
    next(e);
  }
}

export function me(req, res) {
  res.json({ success: true, user: publicUser(req.user) });
}