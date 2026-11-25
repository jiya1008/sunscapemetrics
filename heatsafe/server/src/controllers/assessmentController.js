import { Assessment, SURFACE_MATERIALS, LEVELS } from '../models/Assessment.js';
import { Site } from '../models/Site.js';
import { ActionPlan } from '../models/ActionPlan.js';
import { AppError } from '../middleware/errorHandler.js';
import { calculateRiskScore } from '../services/riskScoringService.js';
import { getRecommendationsForAssessmentId } from '../services/recommendationService.js';
import { isValidObjectId, parseCoord, parsePercent, parsePagination } from '../utils/validators.js';

function validateAssessmentBody(body, isUpdate = false) {
  const errors = [];
  if (!isUpdate && !body.siteId) errors.push('siteId is required');
  if (!isUpdate && !body.areaName?.trim()) errors.push('areaName is required');
  if (!isUpdate && !body.areaType?.trim()) errors.push('areaType is required');
  if (body.surfaceMaterial && !SURFACE_MATERIALS.includes(body.surfaceMaterial)) {
    errors.push('Invalid surface material');
  }
  if (body.usageIntensity && !LEVELS.includes(body.usageIntensity)) errors.push('Invalid usage intensity');
  if (body.exposureLevel && !LEVELS.includes(body.exposureLevel)) errors.push('Invalid exposure level');

  const shade = parsePercent(body.shadeCoverage, 'Shade coverage');
  const veg = parsePercent(body.vegetationCoverage, 'Vegetation coverage');
  if (!shade.ok) errors.push(shade.error);
  if (!veg.ok) errors.push(veg.error);

  if (body.areaSize != null && body.areaSize !== '' && Number(body.areaSize) < 0) {
    errors.push('Area size cannot be negative');
  }

  return { errors, shade: shade.ok ? shade.value : undefined, veg: veg.ok ? veg.value : undefined };
}

export async function listAssessments(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.siteId) {
      if (!isValidObjectId(req.query.siteId)) throw new AppError('Invalid siteId filter', 400);
      filter.siteId = req.query.siteId;
    }
    if (req.query.riskLevel) filter.riskLevel = req.query.riskLevel;

    const [data, total] = await Promise.all([
      Assessment.find(filter)
        .populate('siteId', 'name city type')
        .sort({ riskScore: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Assessment.countDocuments(filter),
    ]);
    res.json({ success: true, data, pagination: { page, limit, total } });
  } catch (e) {
    next(e);
  }
}

export async function getAssessment(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) throw new AppError('Invalid assessment id', 400);
    const doc = await Assessment.findById(req.params.id).populate('siteId').lean();
    if (!doc) throw new AppError('Assessment not found', 404);
    res.json({ success: true, data: doc });
  } catch (e) {
    next(e);
  }
}

export async function createAssessment(req, res, next) {
  try {
    const { errors, shade, veg } = validateAssessmentBody(req.body);
    if (errors.length) throw new AppError(errors.join('; '), 400);

    if (!isValidObjectId(req.body.siteId)) throw new AppError('Invalid siteId', 400);
    const site = await Site.findById(req.body.siteId);
    if (!site) throw new AppError('Site not found', 404);

    const lat = parseCoord(req.body.latitude, -90, 90, 'Latitude');
    const lon = parseCoord(req.body.longitude, -180, 180, 'Longitude');
    if (!lat.ok) throw new AppError(lat.error);
    if (!lon.ok) throw new AppError(lon.error);

    const scoringInput = {
      shadeCoverage: shade,
      vegetationCoverage: veg,
      surfaceMaterial: req.body.surfaceMaterial,
      exposureLevel: req.body.exposureLevel,
      usageIntensity: req.body.usageIntensity,
    };
    const scored = calculateRiskScore(scoringInput);
    const { explanation: _e, ...scoreFields } = scored;

    const assessment = await Assessment.create({
      siteId: req.body.siteId,
      areaName: req.body.areaName.trim(),
      areaType: req.body.areaType.trim(),
      description: req.body.description || '',
      areaSize: req.body.areaSize != null && req.body.areaSize !== '' ? Number(req.body.areaSize) : undefined,
      surfaceMaterial: req.body.surfaceMaterial,
      shadeCoverage: shade,
      vegetationCoverage: veg,
      usageIntensity: req.body.usageIntensity,
      exposureLevel: req.body.exposureLevel,
      occupancy: req.body.occupancy != null && req.body.occupancy !== '' ? Number(req.body.occupancy) : undefined,
      observations: req.body.observations || '',
      latitude: lat.value ?? site.latitude,
      longitude: lon.value ?? site.longitude,
      ...scoreFields,
      assessedAt: req.body.assessedAt || new Date(),
    });

    res.status(201).json({ success: true, data: assessment });
  } catch (e) {
    next(e);
  }
}

export async function updateAssessment(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) throw new AppError('Invalid assessment id', 400);
    const existing = await Assessment.findById(req.params.id);
    if (!existing) throw new AppError('Assessment not found', 404);

    const merged = { ...existing.toObject(), ...req.body };
    const { errors, shade, veg } = validateAssessmentBody(merged, true);
    if (errors.length) throw new AppError(errors.join('; '), 400);

    const lat = parseCoord(req.body.latitude ?? existing.latitude, -90, 90, 'Latitude');
    const lon = parseCoord(req.body.longitude ?? existing.longitude, -180, 180, 'Longitude');
    if (!lat.ok) throw new AppError(lat.error);
    if (!lon.ok) throw new AppError(lon.error);

    const scoringInput = {
      shadeCoverage: shade ?? existing.shadeCoverage,
      vegetationCoverage: veg ?? existing.vegetationCoverage,
      surfaceMaterial: req.body.surfaceMaterial ?? existing.surfaceMaterial,
      exposureLevel: req.body.exposureLevel ?? existing.exposureLevel,
      usageIntensity: req.body.usageIntensity ?? existing.usageIntensity,
    };
    const scored = calculateRiskScore(scoringInput);
    const { explanation: _e, ...scoreFields } = scored;

    Object.assign(existing, req.body, scoreFields, {
      shadeCoverage: scoringInput.shadeCoverage,
      vegetationCoverage: scoringInput.vegetationCoverage,
      latitude: lat.value,
      longitude: lon.value,
    });
    await existing.save();
    res.json({ success: true, data: existing });
  } catch (e) {
    next(e);
  }
}

export async function deleteAssessment(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) throw new AppError('Invalid assessment id', 400);
    const inPlans = await ActionPlan.findOne({ 'items.assessmentId': req.params.id });
    if (inPlans) {
      throw new AppError('Cannot delete assessment referenced in an action plan. Remove plan items first.', 409);
    }
    const doc = await Assessment.findByIdAndDelete(req.params.id);
    if (!doc) throw new AppError('Assessment not found', 404);
    res.json({ success: true, message: 'Assessment deleted' });
  } catch (e) {
    next(e);
  }
}

export async function getAssessmentRecommendations(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) throw new AppError('Invalid assessment id', 400);
    const doc = await Assessment.findById(req.params.id).lean();
    if (!doc) throw new AppError('Assessment not found', 404);
    const recommendations = await getRecommendationsForAssessmentId(doc);
    res.json({ success: true, data: recommendations });
  } catch (e) {
    next(e);
  }
}
