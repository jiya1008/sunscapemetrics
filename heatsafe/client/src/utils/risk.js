export function riskColor(level) {
  if (!level) return '#6c757d';
  if (level.includes('Very high')) return 'var(--hs-risk-vhigh)';
  if (level.includes('High relative')) return 'var(--hs-risk-high)';
  if (level.includes('Moderate')) return 'var(--hs-risk-mod)';
  return 'var(--hs-risk-low)';
}

export function riskBadgeClass(level) {
  if (!level) return 'bg-secondary';
  if (level.includes('Very high')) return 'bg-danger';
  if (level.includes('High relative')) return 'bg-warning text-dark';
  if (level.includes('Moderate')) return 'bg-orange text-dark';
  return 'bg-success';
}

export function formatINR(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
