import { Intervention } from '../models/Intervention.js';

function avgCost(min, max) {
  return Math.round((min + max) / 2);
}

/**
 * Rule-based recommendations from assessment fields.
 */
export function generateRecommendationsForAssessment(assessment, catalog = []) {
  const recs = [];
  const shade = assessment.shadeCoverage;
  const veg = assessment.vegetationCoverage;
  const surface = assessment.surfaceMaterial;
  const usage = assessment.usageIntensity;
  const exposure = assessment.exposureLevel;
  const areaType = (assessment.areaType || '').toLowerCase();

  const findCatalog = (namePart) =>
    catalog.find((c) => c.name.toLowerCase().includes(namePart.toLowerCase()));

  const push = (opts) => {
    const cat = findCatalog(opts.catalogMatch || opts.name);
    recs.push({
      interventionId: cat?._id,
      name: opts.name,
      category: opts.category,
      description: opts.description,
      whyRecommended: opts.why,
      addresses: opts.addresses,
      suitabilityNotes: opts.suitability || '',
      benefits: opts.benefits || '',
      limitations: opts.limitations || '',
      estimatedMinCost: cat?.estimatedMinCost ?? opts.minCost ?? 5000,
      estimatedMaxCost: cat?.estimatedMaxCost ?? opts.maxCost ?? 50000,
      unit: cat?.unit ?? opts.unit ?? 'per sq.m',
      costAssumptionNote: cat?.costAssumptions ?? 'Illustrative planning estimate; verify locally.',
      priority: opts.priority,
    });
  };

  if (shade < 40 && (usage === 'High' || usage === 'Medium')) {
    push({
      name: 'Modular shade canopy (high-use area)',
      category: 'Shade structures',
      catalogMatch: 'shade canopy',
      description: 'Install adjustable or fixed shade structures over frequently used outdoor space.',
      why: `Shade coverage is ${shade}% with ${usage.toLowerCase()} usage — users may lack relief during peak sun.`,
      addresses: ['Low shade coverage', `${usage} usage intensity`],
      priority: shade < 20 ? 1 : 2,
      suitability: 'Requires structural assessment and local building codes.',
    });
  }

  if (shade < 50 && (areaType.includes('walk') || areaType.includes('path'))) {
    push({
      name: 'Walkway shade trees and pergola segments',
      category: 'Shade improvements for walkways',
      catalogMatch: 'walkway',
      description: 'Combine targeted tree planting with short pergola sections along pedestrian routes.',
      why: 'Walkways with limited shade increase exposure during transit.',
      addresses: ['Walkway exposure', 'Shade deficiency'],
      priority: 2,
    });
  }

  if (veg < 35) {
    push({
      name: 'Native tree and shrub planting plan',
      category: 'Tree planting and vegetation',
      catalogMatch: 'tree planting',
      description: 'Phased planting of drought-tolerant native species for shade and evapotranspiration.',
      why: `Vegetation coverage is ${veg}%, limiting natural cooling and shade over time.`,
      addresses: ['Low vegetation', 'Long-term shade'],
      priority: veg < 15 ? 1 : 3,
      limitations: 'Requires irrigation plan, soil testing, and maintenance budget.',
    });
  }

  if (['Asphalt', 'Dark paving', 'Concrete'].includes(surface)) {
    push({
      name: 'Cool / reflective paving retrofit (where feasible)',
      category: 'Cool or lighter-colored paving',
      catalogMatch: 'reflective paving',
      description: 'Replace or overlay dark surfaces with lighter, reflective, or cool pavement materials.',
      why: `${surface} surfaces typically retain more heat than vegetated or light paving.`,
      addresses: ['Surface heat concern', surface],
      priority: surface === 'Asphalt' ? 1 : 2,
    });
  }

  if (areaType.includes('roof') && ['Asphalt', 'Concrete', 'Dark paving'].includes(surface)) {
    push({
      name: 'Reflective roof coating or green roof pilot',
      category: 'Reflective or lighter-colored roofing',
      catalogMatch: 'roof coating',
      description: 'Apply reflective coating or a small green-roof section to reduce absorbed heat.',
      why: 'Rooftop areas with dark surfaces contribute to local heat buildup.',
      addresses: ['Rooftop exposure', 'Surface material'],
      priority: 2,
    });
  }

  if (['Asphalt', 'Concrete'].includes(surface) && veg < 50) {
    push({
      name: 'Permeable pavers with planting strips',
      category: 'Permeable surfaces or vegetation',
      catalogMatch: 'permeable',
      description: 'Use permeable paving with integrated planting where drainage and load allow.',
      why: 'Combines reduced runoff with pockets of vegetation on hardscape.',
      addresses: ['Hard surface', 'Vegetation deficiency'],
      priority: 4,
    });
  }

  if (usage === 'High' && shade < 60) {
    push({
      name: 'Relocate seating and activities to shaded zones',
      category: 'Outdoor seating or activity relocation',
      catalogMatch: 'relocate',
      description: 'Reorganize furniture, events, and break areas toward existing or planned shaded zones.',
      why: 'High occupancy during low-shade periods increases discomfort risk.',
      addresses: ['High usage', 'Shade deficiency'],
      priority: 3,
      minCost: 2000,
      maxCost: 25000,
      unit: 'lump sum',
    });
  }

  if (exposure === 'High' && veg < 60) {
    push({
      name: 'Landscape buffer and groundcover upgrade',
      category: 'Planting and landscape improvements',
      catalogMatch: 'landscape',
      description: 'Add groundcover, bioswales, or landscape buffers to reduce exposed soil and hard edge heating.',
      why: 'High exposure with limited vegetation increases radiant heat near users.',
      addresses: ['High exposure', 'Vegetation deficiency'],
      priority: 3,
    });
  }

  // Deduplicate by name
  const seen = new Set();
  const unique = recs.filter((r) => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });

  unique.sort((a, b) => a.priority - b.priority);
  return unique;
}

export async function getRecommendationsForAssessmentId(assessment) {
  const catalog = await Intervention.find({ isCatalog: true }).lean();
  return generateRecommendationsForAssessment(assessment, catalog);
}
