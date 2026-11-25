const ALGORITHM_VERSION = '1.0';

const SURFACE_CONCERN = {
  Asphalt: 100,
  'Dark paving': 90,
  Concrete: 75,
  'Mixed surface': 60,
  Other: 50,
  'Light or reflective paving': 40,
  Soil: 40,
  Grass: 20,
  'Vegetated surface': 15,
};

const LEVEL_SCORE = { Low: 25, Medium: 60, High: 100 };

export function surfaceConcernScore(material) {
  return SURFACE_CONCERN[material] ?? 50;
}

export function exposureScore(level) {
  return LEVEL_SCORE[level] ?? 60;
}

export function usageScore(intensity) {
  return LEVEL_SCORE[intensity] ?? 60;
}

export function severityFromScore(score) {
  if (score <= 29) return 'Lower relative concern';
  if (score <= 49) return 'Moderate relative concern';
  if (score <= 69) return 'High relative concern';
  return 'Very high relative concern';
}

/**
 * Transparent weighted scoring — relative planning priority only.
 * Does not use weather data.
 */
export function calculateRiskScore(assessmentInput) {
  const shadeDeficiency = 100 - Number(assessmentInput.shadeCoverage);
  const vegetationDeficiency = 100 - Number(assessmentInput.vegetationCoverage);
  const surfaceConcern = surfaceConcernScore(assessmentInput.surfaceMaterial);
  const expScore = exposureScore(assessmentInput.exposureLevel);
  const useScore = usageScore(assessmentInput.usageIntensity);

  const weighted = {
    shade: shadeDeficiency * 0.3,
    surface: surfaceConcern * 0.25,
    exposure: expScore * 0.2,
    usage: useScore * 0.15,
    vegetation: vegetationDeficiency * 0.1,
  };

  const raw =
    weighted.shade + weighted.surface + weighted.exposure + weighted.usage + weighted.vegetation;
  const riskScore = Math.round(Math.min(100, Math.max(0, raw)));

  return {
    riskScore,
    riskLevel: severityFromScore(riskScore),
    scoreFactors: {
      shadeDeficiency,
      vegetationDeficiency,
      surfaceConcern,
      exposureScore: expScore,
      usageScore: useScore,
      weighted,
    },
    algorithmVersion: ALGORITHM_VERSION,
    explanation:
      'Score combines observed shade, surface type, exposure, usage, and vegetation using fixed weights (v1.0). Weather is shown separately and is not part of this score.',
  };
}

export { ALGORITHM_VERSION };
