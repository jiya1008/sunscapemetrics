import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRiskScore,
  severityFromScore,
  surfaceConcernScore,
} from '../services/riskScoringService.js';

describe('riskScoringService', () => {
  it('computes asphalt high-use low shade score in very high band', () => {
    const result = calculateRiskScore({
      shadeCoverage: 5,
      vegetationCoverage: 2,
      surfaceMaterial: 'Asphalt',
      exposureLevel: 'High',
      usageIntensity: 'High',
    });
    assert.ok(result.riskScore >= 70);
    assert.equal(result.riskLevel, 'Very high relative concern');
    assert.equal(result.algorithmVersion, '1.0');
  });

  it('classifies severity bands', () => {
    assert.equal(severityFromScore(10), 'Lower relative concern');
    assert.equal(severityFromScore(40), 'Moderate relative concern');
    assert.equal(severityFromScore(55), 'High relative concern');
    assert.equal(severityFromScore(80), 'Very high relative concern');
  });

  it('uses neutral default for unknown surface', () => {
    assert.equal(surfaceConcernScore('Other'), 50);
  });
});
