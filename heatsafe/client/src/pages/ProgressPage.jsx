import { useEffect, useState } from 'react';
import { getActionPlans, getSites, updateActionPlan } from '../api/api';
import LoadingState from '../components/LoadingState';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import { formatINR } from '../utils/risk';

const STATUSES = ['Proposed', 'Planned', 'In progress', 'Completed', 'On hold'];

export default function ProgressPage() {
  const [plans, setPlans] = useState([]);
  const [sites, setSites] = useState([]);
  const [filterSite, setFilterSite] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [pRes, sRes] = await Promise.all([
        getActionPlans({ siteId: filterSite || undefined, limit: 100 }),
        getSites({ limit: 100 }),
      ]);
      setPlans(pRes.data.data);
      setSites(sRes.data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterSite]);

  const rows = [];
  for (const plan of plans) {
    for (const item of plan.items || []) {
      if (filterStatus && item.status !== filterStatus) continue;
      if (filterPriority && String(item.priority) !== filterPriority) continue;
      const itemIndex = (plan.items || []).indexOf(item);
      rows.push({ plan, item, itemIndex });
    }
  }

  const allItems = plans.flatMap((p) => p.items || []);
  const progressPct = allItems.length
    ? Math.round((allItems.filter((i) => i.status === 'Completed').length / allItems.length) * 100)
    : 0;
  const plannedSpend = allItems.reduce((s, i) => s + (Number(i.estimatedTotalCost) || 0), 0);
  const completedSpend = allItems
    .filter((i) => i.status === 'Completed')
    .reduce((s, i) => s + (Number(i.estimatedTotalCost) || 0), 0);

  const updateStatus = async (plan, itemIndex, updates) => {
    try {
      const fullPlan = { ...plan, items: [...plan.items] };
      fullPlan.items[itemIndex] = { ...fullPlan.items[itemIndex], ...updates };
      if (updates.status === 'Completed' && !fullPlan.items[itemIndex].completedAt) {
        fullPlan.items[itemIndex].completedAt = new Date().toISOString();
      }
      await updateActionPlan(plan._id, { items: fullPlan.items });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) return <LoadingState message="Loading progress…" />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div>
      <h2 className="page-title mb-3">Progress tracker</h2>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card card-soft p-3">
            <div className="text-muted small">Overall completion</div>
            <div className="fs-3 fw-bold text-primary-brand">{progressPct}%</div>
            <div className="progress mt-2" style={{ height: 8 }}>
              <div className="progress-bar bg-success" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card card-soft p-3">
            <div className="text-muted small">Planned spend (all items)</div>
            <div className="fs-5 fw-semibold">{formatINR(plannedSpend)}</div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card card-soft p-3">
            <div className="text-muted small">Completed spend</div>
            <div className="fs-5 fw-semibold">{formatINR(completedSpend)}</div>
          </div>
        </div>
      </div>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <select className="form-select form-select-sm" style={{ maxWidth: 200 }} value={filterSite} onChange={(e) => setFilterSite(e.target.value)}>
          <option value="">All sites</option>
          {sites.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="form-select form-select-sm" style={{ maxWidth: 160 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="form-select form-select-sm" style={{ maxWidth: 140 }} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
          <option value="">All priorities</option>
          {[1, 2, 3, 4, 5].map((p) => (
            <option key={p} value={String(p)}>
              P{p}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No items to track" message="Create an action plan and add interventions first." />
      ) : (
        <div className="table-responsive card card-soft">
          <table className="table table-hover mb-0 align-middle">
            <thead>
              <tr>
                <th>Intervention</th>
                <th>Plan / Site</th>
                <th>Priority</th>
                <th>Est. cost</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Target date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ plan, item, itemIndex }) => {
                const idx = itemIndex >= 0 ? itemIndex : plan.items.findIndex((i) => i._id === item._id);
                return (
                  <tr key={`${plan._id}-${item._id || idx}`}>
                    <td>{item.interventionName}</td>
                    <td className="small">
                      {plan.name}
                      <br />
                      <span className="text-muted">{plan.siteId?.name}</span>
                    </td>
                    <td>{item.priority}</td>
                    <td>{formatINR(item.estimatedTotalCost)}</td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={item.status}
                        onChange={(e) => updateStatus(plan, idx, { status: e.target.value })}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        defaultValue={item.notes || ''}
                        onBlur={(e) => updateStatus(plan, idx, { notes: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        defaultValue={item.targetDate ? item.targetDate.slice(0, 10) : ''}
                        onBlur={(e) =>
                          updateStatus(plan, idx, { targetDate: e.target.value ? new Date(e.target.value) : null })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
