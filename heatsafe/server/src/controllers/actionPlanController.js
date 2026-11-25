import { ActionPlan, ITEM_STATUSES } from '../models/ActionPlan.js';
import { Site } from '../models/Site.js';
import { AppError } from '../middleware/errorHandler.js';
import { computeItemTotal, summarizePlan, suggestWithinBudget } from '../services/budgetService.js';
import { isValidObjectId, parsePagination } from '../utils/validators.js';

function normalizeItems(items) {
  return (items || []).map((item, idx) => {
    const quantity = Number(item.quantity) || 1;
    const estimatedUnitCost = Number(item.estimatedUnitCost) || 0;
    const estimatedTotalCost = computeItemTotal(quantity, estimatedUnitCost);
    return {
      ...item,
      quantity,
      estimatedUnitCost,
      estimatedTotalCost,
      priority: item.priority ?? idx + 1,
      status: ITEM_STATUSES.includes(item.status) ? item.status : 'Proposed',
    };
  });
}

export async function listActionPlans(req, res, next) {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {};
    if (req.query.siteId) {
      if (!isValidObjectId(req.query.siteId)) throw new AppError('Invalid siteId', 400);
      filter.siteId = req.query.siteId;
    }
    if (req.query.status) filter.status = req.query.status;

    const [data, total] = await Promise.all([
      ActionPlan.find(filter).populate('siteId', 'name city').sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      ActionPlan.countDocuments(filter),
    ]);
    const withSummary = data.map((p) => ({ ...p, summary: summarizePlan(p) }));
    res.json({ success: true, data: withSummary, pagination: { page, limit, total } });
  } catch (e) {
    next(e);
  }
}

export async function getActionPlan(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) throw new AppError('Invalid action plan id', 400);
    const plan = await ActionPlan.findById(req.params.id).populate('siteId').lean();
    if (!plan) throw new AppError('Action plan not found', 404);
    res.json({ success: true, data: { ...plan, summary: summarizePlan(plan) } });
  } catch (e) {
    next(e);
  }
}

export async function createActionPlan(req, res, next) {
  try {
    const b = req.body;
    if (!isValidObjectId(b.siteId)) throw new AppError('Valid siteId is required', 400);
    const site = await Site.findById(b.siteId);
    if (!site) throw new AppError('Site not found', 404);
    if (!b.name?.trim()) throw new AppError('Plan name is required', 400);
    if (b.budget == null || Number(b.budget) < 0) throw new AppError('Valid budget is required', 400);

    const items = normalizeItems(b.items);
    const plan = await ActionPlan.create({
      siteId: b.siteId,
      name: b.name.trim(),
      description: b.description || '',
      budget: Number(b.budget),
      currency: b.currency || 'INR',
      items,
      status: b.status || 'Draft',
    });
    res.status(201).json({ success: true, data: { ...plan.toObject(), summary: summarizePlan(plan) } });
  } catch (e) {
    next(e);
  }
}

export async function updateActionPlan(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) throw new AppError('Invalid action plan id', 400);
    const plan = await ActionPlan.findById(req.params.id);
    if (!plan) throw new AppError('Action plan not found', 404);

    if (req.body.siteId) {
      if (!isValidObjectId(req.body.siteId)) throw new AppError('Invalid siteId', 400);
    }
    if (req.body.budget != null && Number(req.body.budget) < 0) throw new AppError('Budget cannot be negative', 400);

    Object.assign(plan, req.body);
    if (req.body.items) plan.items = normalizeItems(req.body.items);
    await plan.save();
    res.json({ success: true, data: { ...plan.toObject(), summary: summarizePlan(plan) } });
  } catch (e) {
    next(e);
  }
}

export async function deleteActionPlan(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) throw new AppError('Invalid action plan id', 400);
    const plan = await ActionPlan.findByIdAndDelete(req.params.id);
    if (!plan) throw new AppError('Action plan not found', 404);
    res.json({ success: true, message: 'Action plan deleted' });
  } catch (e) {
    next(e);
  }
}

export async function suggestBudget(req, res, next) {
  try {
    if (!isValidObjectId(req.params.id)) throw new AppError('Invalid action plan id', 400);
    const plan = await ActionPlan.findById(req.params.id).lean();
    if (!plan) throw new AppError('Action plan not found', 404);
    const budget = Number(req.body.budget ?? plan.budget);
    const suggestion = suggestWithinBudget(plan.items || [], budget);
    res.json({ success: true, data: suggestion });
  } catch (e) {
    next(e);
  }
}
