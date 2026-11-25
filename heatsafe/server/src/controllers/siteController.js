import { Site, SITE_TYPES } from '../models/Site.js';
import { Assessment } from '../models/Assessment.js';
import { ActionPlan } from '../models/ActionPlan.js';
import { AppError } from '../middleware/errorHandler.js';
import { isValidObjectId, parseCoord, parsePagination } from '../utils/validators.js';

export async function listSites(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.search) {
      const q = req.query.search.trim();
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { city: new RegExp(q, 'i') },
        { state: new RegExp(q, 'i') },
      ];
    }
    const [data, total] = await Promise.all([
      Site.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Site.countDocuments(filter),
    ]);
    res.json({ success: true, data, pagination: { page, limit, total } });
  } catch (e) {
    next(e);
  }
}

export async function getSite(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) throw new AppError('Invalid site id', 400);
    const site = await Site.findById(req.params.id).lean();
    if (!site) throw new AppError('Site not found', 404);
    const [assessments, actionPlans] = await Promise.all([
      Assessment.find({ siteId: site._id }).sort({ riskScore: -1 }).lean(),
      ActionPlan.find({ siteId: site._id }).sort({ updatedAt: -1 }).lean(),
    ]);
    res.json({ success: true, data: { ...site, assessments, actionPlans } });
  } catch (e) {
    next(e);
  }
}

export async function createSite(req, res, next) {
  try {
    const body = req.body;
    if (!body.name?.trim()) throw new AppError('Site name is required');
    if (!SITE_TYPES.includes(body.type)) throw new AppError('Invalid site type');

    const lat = parseCoord(body.latitude, -90, 90, 'Latitude');
    const lon = parseCoord(body.longitude, -180, 180, 'Longitude');
    if (!lat.ok) throw new AppError(lat.error);
    if (!lon.ok) throw new AppError(lon.error);

    const site = await Site.create({
      name: body.name.trim(),
      type: body.type,
      description: body.description || '',
      address: body.address || '',
      city: body.city || '',
      state: body.state || '',
      country: body.country || 'India',
      latitude: lat.value,
      longitude: lon.value,
      totalArea: body.totalArea != null && body.totalArea !== '' ? Number(body.totalArea) : undefined,
      contactPerson: body.contactPerson || '',
    });
    res.status(201).json({ success: true, data: site });
  } catch (e) {
    next(e);
  }
}

export async function updateSite(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) throw new AppError('Invalid site id', 400);
    const body = req.body;
    const updates = { ...body };
    if (body.latitude !== undefined) {
      const lat = parseCoord(body.latitude, -90, 90, 'Latitude');
      if (!lat.ok) throw new AppError(lat.error);
      updates.latitude = lat.value;
    }
    if (body.longitude !== undefined) {
      const lon = parseCoord(body.longitude, -180, 180, 'Longitude');
      if (!lon.ok) throw new AppError(lon.error);
      updates.longitude = lon.value;
    }
    if (body.type && !SITE_TYPES.includes(body.type)) throw new AppError('Invalid site type');

    const site = await Site.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!site) throw new AppError('Site not found', 404);
    res.json({ success: true, data: site });
  } catch (e) {
    next(e);
  }
}

export async function deleteSite(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) throw new AppError('Invalid site id', 400);
    const hasAssessments = await Assessment.exists({ siteId: req.params.id });
    const hasPlans = await ActionPlan.exists({ siteId: req.params.id });
    if (hasAssessments || hasPlans) {
      throw new AppError(
        'Cannot delete site with linked assessments or action plans. Remove those first.',
        409
      );
    }
    const site = await Site.findByIdAndDelete(req.params.id);
    if (!site) throw new AppError('Site not found', 404);
    res.json({ success: true, message: 'Site deleted' });
  } catch (e) {
    next(e);
  }
}

export function getSiteTypes(req, res) {
  res.json({ success: true, data: SITE_TYPES });
}
