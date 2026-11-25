/**
 * Budget calculations for action plans (INR).
 */

export function computeItemTotal(quantity, unitCost) {
  const q = Number(quantity) || 0;
  const u = Number(unitCost) || 0;
  return Math.round(q * u * 100) / 100;
}

export function summarizePlan(plan) {
  const items = plan.items || [];
  const totalEstimated = items.reduce((sum, i) => sum + (Number(i.estimatedTotalCost) || 0), 0);
  const budget = Number(plan.budget) || 0;
  const remaining = budget - totalEstimated;
  const allocatedPct = budget > 0 ? Math.min(100, Math.round((totalEstimated / budget) * 100)) : 0;
  const completedSpend = items
    .filter((i) => i.status === 'Completed')
    .reduce((sum, i) => sum + (Number(i.estimatedTotalCost) || 0), 0);

  return {
    totalBudget: budget,
    totalEstimatedCost: totalEstimated,
    remainingBudget: remaining,
    budgetAllocatedPercent: allocatedPct,
    interventionCount: items.length,
    completedSpend,
    isOverBudget: remaining < 0,
  };
}

/**
 * Greedy heuristic: sort by priority (asc), then cost (asc), pack until budget exhausted.
 */
export function suggestWithinBudget(items, budget) {
  const sorted = [...items].sort((a, b) => {
    const pa = a.priority ?? 99;
    const pb = b.priority ?? 99;
    if (pa !== pb) return pa - pb;
    return (a.estimatedTotalCost || 0) - (b.estimatedTotalCost || 0);
  });

  let spent = 0;
  const selected = [];
  const skipped = [];

  for (const item of sorted) {
    const cost = Number(item.estimatedTotalCost) || 0;
    if (spent + cost <= budget) {
      selected.push(item);
      spent += cost;
    } else {
      skipped.push(item);
    }
  }

  return {
    selected,
    skipped,
    totalSelectedCost: spent,
    remainingBudget: budget - spent,
    note: 'Heuristic suggestion ranked by priority then cost. Cheapest is not always best — review suitability.',
  };
}

export function progressFromItems(items) {
  if (!items?.length) return 0;
  const completed = items.filter((i) => i.status === 'Completed').length;
  return Math.round((completed / items.length) * 100);
}
