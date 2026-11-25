export default function StatCard({ icon, label, value, hint }) {
  return (
    <div className="card card-soft h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div className="text-muted small text-uppercase fw-semibold">{label}</div>
            <div className="fs-3 fw-bold text-primary-brand">{value ?? '—'}</div>
            {hint && <div className="small text-muted mt-1">{hint}</div>}
          </div>
          {icon && <i className={`bi ${icon} fs-3 text-primary-brand opacity-75`} aria-hidden />}
        </div>
      </div>
    </div>
  );
}
