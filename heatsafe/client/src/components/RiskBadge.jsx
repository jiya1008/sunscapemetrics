import { riskColor } from '../utils/risk';

export default function RiskBadge({ score, level, compact }) {
  const color = riskColor(level);
  if (compact) {
    return (
      <span className="badge rounded-pill" style={{ backgroundColor: color }}>
        {score ?? '—'}
      </span>
    );
  }
  return (
    <div>
      <span className="badge rounded-pill mb-1" style={{ backgroundColor: color }}>
        {level || 'Not scored'}
      </span>
      {score != null && <div className="fw-bold fs-5">{score}/100</div>}
    </div>
  );
}
