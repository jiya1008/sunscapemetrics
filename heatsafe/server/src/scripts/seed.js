import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import { Site } from '../models/Site.js';
import { Assessment } from '../models/Assessment.js';
import { Intervention } from '../models/Intervention.js';
import { ActionPlan } from '../models/ActionPlan.js';
import { calculateRiskScore } from '../services/riskScoringService.js';
import { computeItemTotal } from '../services/budgetService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DEMO_TAG = '[DEMO]';

async function seedInterventions() {
  const count = await Intervention.countDocuments({ isCatalog: true });
  if (count > 0) {
    console.log('Intervention catalog already present, skipping catalog seed.');
    return Intervention.find({ isCatalog: true }).lean();
  }

  const catalog = [
    {
      name: 'Modular shade canopy system',
      category: 'Shade structures',
      description: 'Steel or fabric shade canopies for courtyards and seating.',
      rationale: 'Rapid shade for high-use zones.',
      suitableConditions: 'Low to moderate wind; structural anchors available.',
      limitations: 'Periodic fabric replacement; permits may apply.',
      benefits: 'Immediate usable shade for pedestrians.',
      estimatedMinCost: 800,
      estimatedMaxCost: 2500,
      unit: 'per sq.m',
    },
    {
      name: 'Native tree planting package',
      category: 'Tree planting and vegetation',
      description: 'Mixed native trees with irrigation for first two seasons.',
      rationale: 'Long-term shade and landscape cooling.',
      suitableConditions: 'Adequate soil depth and water access.',
      limitations: 'Years to mature; ongoing maintenance.',
      benefits: 'Progressive shade and biodiversity.',
      estimatedMinCost: 3500,
      estimatedMaxCost: 12000,
      unit: 'per tree',
    },
    {
      name: 'Reflective roof coating',
      category: 'Reflective or lighter-colored roofing',
      description: 'High-albedo coating for accessible flat roofs.',
      rationale: 'Reduce absorbed heat on exposed rooftops.',
      suitableConditions: 'Flat or low-slope roofs in good repair.',
      limitations: 'Recoating cycle every few years.',
      benefits: 'Lower surface temperatures on treated roof areas.',
      estimatedMinCost: 200,
      estimatedMaxCost: 450,
      unit: 'per sq.m',
    },
    {
      name: 'Cool reflective paving overlay',
      category: 'Cool or lighter-colored paving',
      description: 'Light-colored pavers or cool pavement overlay.',
      rationale: 'Replace dark hardscape where overlay is feasible.',
      suitableConditions: 'Stable sub-base; drainage considered.',
      limitations: 'Not all substrates suitable.',
      benefits: 'Reduced surface heat vs. dark asphalt.',
      estimatedMinCost: 600,
      estimatedMaxCost: 1800,
      unit: 'per sq.m',
    },
    {
      name: 'Permeable paver with planting strips',
      category: 'Permeable surfaces or vegetation',
      description: 'Permeable units with integrated planting zones.',
      rationale: 'Stormwater and vegetation combined.',
      suitableConditions: 'Moderate traffic pedestrian areas.',
      limitations: 'Higher upfront cost; clogging risk without maintenance.',
      benefits: 'Infiltration plus greenery pockets.',
      estimatedMinCost: 900,
      estimatedMaxCost: 2200,
      unit: 'per sq.m',
    },
    {
      name: 'Activity relocation to shaded zones',
      category: 'Outdoor seating or activity relocation',
      description: 'Operational plan to shift seating/events to shadier areas.',
      rationale: 'Low-cost operational mitigation.',
      suitableConditions: 'Existing partial shade nearby.',
      limitations: 'Does not add new shade by itself.',
      benefits: 'Immediate reduction in user exposure.',
      estimatedMinCost: 5000,
      estimatedMaxCost: 40000,
      unit: 'lump sum',
    },
    {
      name: 'Walkway pergola and tree plan',
      category: 'Shade improvements for walkways',
      description: 'Segmented pergolas plus row planting along paths.',
      rationale: 'Route-level shade for commuters.',
      suitableConditions: 'Minimum 2m clearance; root zone planning.',
      limitations: 'Construction along active paths.',
      benefits: 'Continuous shade along key routes over time.',
      estimatedMinCost: 1200,
      estimatedMaxCost: 3500,
      unit: 'per linear m',
    },
    {
      name: 'Landscape buffer upgrade',
      category: 'Planting and landscape improvements',
      description: 'Shrubs, groundcover, and mulch to reduce bare soil exposure.',
      rationale: 'Softscape buffers for exposed edges.',
      suitableConditions: 'Irrigation or drought-tolerant species.',
      limitations: 'Water budget in dry seasons.',
      benefits: 'Visual and microclimate comfort at edges.',
      estimatedMinCost: 400,
      estimatedMaxCost: 1200,
      unit: 'per sq.m',
    },
  ];

  await Intervention.insertMany(catalog.map((c) => ({ ...c, isCatalog: true })));
  console.log(`Seeded ${catalog.length} intervention catalog entries.`);
  return Intervention.find({ isCatalog: true }).lean();
}

async function seed() {
  await connectDB(process.env.MONGODB_URI);

  // Clear prior demo records only
  const demoSites = await Site.find({ isDemo: true }).select('_id');
  const demoSiteIds = demoSites.map((s) => s._id);
  if (demoSiteIds.length) {
    await Assessment.deleteMany({ siteId: { $in: demoSiteIds } });
    await ActionPlan.deleteMany({ siteId: { $in: demoSiteIds } });
    await Site.deleteMany({ _id: { $in: demoSiteIds } });
    console.log('Removed previous demo site data.');
  }

  const catalog = await seedInterventions();

  const site = await Site.create({
    name: `${DEMO_TAG} Greenview Demo College Campus`,
    type: 'College or university',
    description: `${DEMO_TAG} Fictional campus for demonstration only — not a real institution.`,
    address: 'Demo Avenue, Sector 12',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    latitude: 18.5204,
    longitude: 73.8567,
    totalArea: 85000,
    contactPerson: 'Demo Facilities Office',
    isDemo: true,
  });

  const areas = [
    {
      areaName: 'Main asphalt parking lot',
      areaType: 'Parking area',
      surfaceMaterial: 'Asphalt',
      shadeCoverage: 5,
      vegetationCoverage: 2,
      usageIntensity: 'High',
      exposureLevel: 'High',
      areaSize: 4200,
      lat: 18.521,
      lon: 73.857,
    },
    {
      areaName: 'Central open courtyard',
      areaType: 'Open courtyard',
      surfaceMaterial: 'Concrete',
      shadeCoverage: 15,
      vegetationCoverage: 10,
      usageIntensity: 'High',
      exposureLevel: 'High',
      areaSize: 1800,
      lat: 18.5208,
      lon: 73.8565,
    },
    {
      areaName: 'Playground',
      areaType: 'Playground',
      surfaceMaterial: 'Mixed surface',
      shadeCoverage: 25,
      vegetationCoverage: 20,
      usageIntensity: 'Medium',
      exposureLevel: 'Medium',
      areaSize: 900,
      lat: 18.5199,
      lon: 73.8562,
    },
    {
      areaName: 'Shaded garden walk',
      areaType: 'Pedestrian walkway',
      surfaceMaterial: 'Light or reflective paving',
      shadeCoverage: 55,
      vegetationCoverage: 45,
      usageIntensity: 'Medium',
      exposureLevel: 'Low',
      areaSize: 600,
      lat: 18.5202,
      lon: 73.8572,
    },
  ];

  const assessments = [];
  for (const a of areas) {
    const scored = calculateRiskScore(a);
    const doc = await Assessment.create({
      siteId: site._id,
      areaName: a.areaName,
      areaType: a.areaType,
      description: `${DEMO_TAG} Sample assessment record.`,
      areaSize: a.areaSize,
      surfaceMaterial: a.surfaceMaterial,
      shadeCoverage: a.shadeCoverage,
      vegetationCoverage: a.vegetationCoverage,
      usageIntensity: a.usageIntensity,
      exposureLevel: a.exposureLevel,
      latitude: a.lat,
      longitude: a.lon,
      isDemo: true,
      ...scored,
    });
    assessments.push(doc);
  }

  const canopy = catalog.find((c) => c.name.includes('canopy'));
  const trees = catalog.find((c) => c.name.includes('tree planting'));
  const paving = catalog.find((c) => c.name.includes('reflective paving'));

  const items = [
    {
      assessmentId: assessments[0]._id,
      interventionId: canopy?._id,
      interventionName: canopy?.name || 'Modular shade canopy system',
      category: canopy?.category || 'Shade structures',
      quantity: 500,
      unit: 'per sq.m',
      estimatedUnitCost: 1500,
      estimatedTotalCost: computeItemTotal(500, 1500),
      priority: 1,
      status: 'Planned',
    },
    {
      assessmentId: assessments[1]._id,
      interventionId: trees?._id,
      interventionName: trees?.name || 'Native tree planting package',
      category: trees?.category || 'Tree planting and vegetation',
      quantity: 25,
      unit: 'per tree',
      estimatedUnitCost: 8000,
      estimatedTotalCost: computeItemTotal(25, 8000),
      priority: 2,
      status: 'Proposed',
    },
    {
      assessmentId: assessments[1]._id,
      interventionId: paving?._id,
      interventionName: paving?.name || 'Cool reflective paving overlay',
      category: paving?.category || 'Cool or lighter-colored paving',
      quantity: 400,
      unit: 'per sq.m',
      estimatedUnitCost: 1100,
      estimatedTotalCost: computeItemTotal(400, 1100),
      priority: 3,
      status: 'In progress',
    },
  ];

  await ActionPlan.create({
    siteId: site._id,
    name: `${DEMO_TAG} FY26 Heat Mitigation Plan`,
    description: `${DEMO_TAG} Example action plan with illustrative costs in INR.`,
    budget: 2500000,
    currency: 'INR',
    items,
    status: 'Active',
    isDemo: true,
  });

  console.log('Demo seed complete.');
  console.log(`Site: ${site.name}`);
  console.log(`Assessments: ${assessments.length}`);
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
