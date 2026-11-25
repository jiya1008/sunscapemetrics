import { Intervention, CATEGORIES } from '../models/Intervention.js';
import { AppError } from '../middleware/errorHandler.js';
import { isValidObjectId, parsePagination } from '../utils/validators.js';

export async function listInterventions(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    const [data, total] = await Promise.all([
      Intervention.find(filter).sort({ category: 1, name: 1 }).skip(skip).limit(limit).lean(),
      Intervention.countDocuments(filter),
    ]);
    res.json({ success: true, data, pagination: { page, limit, total } });
  } catch (e) {
    next(e);
  }
}

export async function getIntervention(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) throw new AppError('Invalid intervention id', 400);
    const doc = await Intervention.findById(req.params.id).lean();
    if (!doc) throw new AppError('Intervention not found', 404);
    res.json({ success: true, data: doc });
  } catch (e) {
    next(e);
  }
}

export async function createIntervention(req, res, next) {
  try {
    const b = req.body;
    if (!b.name?.trim()) throw new AppError('Name is required');
    if (!CATEGORIES.includes(b.category)) throw new AppError('Invalid category');
    const doc = await Intervention.create(b);
    res.status(201).json({ success: true, data: doc });
  } catch (e) {
    next(e);
  }
}

export async function updateIntervention(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) throw new AppError('Invalid intervention id', 400);
    const doc = await Intervention.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!doc) throw new AppError('Intervention not found', 404);
    res.json({ success: true, data: doc });
  } catch (e) {
    next(e);
  }
}

export async function deleteIntervention(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) throw new AppError('Invalid intervention id', 400);
    const doc = await Intervention.findByIdAndDelete(req.params.id);
    if (!doc) throw new AppError('Intervention not found', 404);
    res.json({ success: true, message: 'Intervention deleted' });
  } catch (e) {
    next(e);
  }
}
