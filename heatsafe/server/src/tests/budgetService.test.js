import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeItemTotal, suggestWithinBudget, summarizePlan } from '../services/budgetService.js';

describe('budgetService', () => {
  it('computes item totals', () => {
    assert.equal(computeItemTotal(10, 100), 1000);
  });

  it('summarizes plan budget', () => {
    const s = summarizePlan({
      budget: 100000,
      items: [{ estimatedTotalCost: 40000 }, { estimatedTotalCost: 30000 }],
    });
    assert.equal(s.totalEstimatedCost, 70000);
    assert.equal(s.remainingBudget, 30000);
    assert.equal(s.budgetAllocatedPercent, 70);
  });

  it('suggestWithinBudget does not exceed budget', () => {
    const items = [
      { name: 'a', priority: 1, estimatedTotalCost: 50000 },
      { name: 'b', priority: 2, estimatedTotalCost: 40000 },
      { name: 'c', priority: 3, estimatedTotalCost: 30000 },
    ];
    const result = suggestWithinBudget(items, 90000);
    assert.ok(result.totalSelectedCost <= 90000);
    assert.equal(result.selected.length, 2);
  });
});
