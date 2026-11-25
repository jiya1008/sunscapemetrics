import { Site } from '../models/Site.js';
import { Assessment } from '../models/Assessment.js';
import { ActionPlan } from '../models/ActionPlan.js';
import { summarizePlan, progressFromItems } from '../services/budgetService.js';

const HIGH_LEVELS = ['High relative concern', 'Very high relative concern'];

export async function getSummary(req, res, next) {
  try {
    const [sites, assessments, highConcern, plans] = await Promise.all([
      Site.countDocuments(),
      Assessment.countDocuments(),
      Assessment.countDocuments({ riskLevel: { $in: HIGH_LEVELS } }),
      ActionPlan.find().lean(),
    ]);

    let proposedInterventions = 0;
    let budgetAllocated = 0;
    let activePlans = 0;
    for (const p of plans) {
      if (p.status === 'Active' || p.status === 'Draft') activePlans++;
      proposedInterventions += (p.items || []).length;
      budgetAllocated += summarizePlan(p).totalEstimatedCost;
    }

    res.json({
      success: true,
      data: {
        totalSites: sites,
        totalAssessments: assessments,
        highConcernAreas: highConcern,
        proposedInterventions,
        activeActionPlans: activePlans,
        budgetAllocated,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function getRiskDistribution(req, res, next) {
  try {
    const levels = [
      'Lower relative concern',
      'Moderate relative concern',
      'High relative concern',
      'Very high relative concern',
    ];
    const counts = await Promise.all(
      levels.map((level) => Assessment.countDocuments({ riskLevel: level }))
    );
    const data = levels.map((name, i) => ({ name, count: counts[i] }));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getRecentActivity(req, res, next) {
  try {
    const [recentAssessments, topPriority, recentPlans, mapSites, mapAreas] = await Promise.all([
      Assessment.find()
        .populate('siteId', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Assessment.find()
        .populate('siteId', 'name city')
        .sort({ riskScore: -1 })
        .limit(5)
        .lean(),
      ActionPlan.find().populate('siteId', 'name').sort({ updatedAt: -1 }).limit(5).lean(),
      Site.find({
        latitude: { $exists: true, $ne: null },
        longitude: { $exists: true, $ne: null },
      })
        .select('name type latitude longitude city isDemo')
        .lean(),
      Assessment.find({
        latitude: { $exists: true, $ne: null },
        longitude: { $exists: true, $ne: null },
      })
        .select('areaName riskScore riskLevel latitude longitude siteId')
        .populate('siteId', 'name')
        .lean(),
    ]);

    const statusBreakdown = {};
    const plans = await ActionPlan.find().lean();
    for (const p of plans) {
      for (const item of p.items || []) {
        statusBreakdown[item.status] = (statusBreakdown[item.status] || 0) + 1;
      }
    }
    const interventionStatusChart = Object.entries(statusBreakdown).map(([name, count]) => ({
      name,
      count,
    }));

    const priorityChart = topPriority.map((a) => ({
      name: a.areaName,
      score: a.riskScore,
    }));

    res.json({
      success: true,
      data: {
        recentAssessments,
        topPriority,
        recentPlans: recentPlans.map((p) => ({
          ...p,
          summary: summarizePlan(p),
          progressPercent: progressFromItems(p.items),
        })),
        mapSites,
        mapAreas,
        priorityChart,
        interventionStatusChart,
      },
    });
  } catch (e) {
    next(e);
  }
}
