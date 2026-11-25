import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  getSites,
  getActionPlans,
  getActionPlan,
  createActionPlan,
  updateActionPlan,
  deleteActionPlan,
  suggestBudget,
} from '../api/api';
import LoadingState from '../components/LoadingState';
import ErrorMessage from '../components/ErrorMessage';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatINR } from '../utils/risk';

export default function BudgetPlannerPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [sites, setSites] = useState([]);
  const [plans, setPlans] = useState([]);
  const [plan, setPlan] = useState(null);
  const [form, setForm] = useState({
    siteId: searchParams.get('siteId') || '',
    name: '',
    description: '',
    budget: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const loadPlans = async () => {
    const res = await getActionPlans({ limit: 50 });
    setPlans(res.data.data);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const sRes = await getSites({ limit: 100 });
        setSites(sRes.data.data);
        await loadPlans();
        if (id) {
          const pRes = await getActionPlan(id);
          setPlan(pRes.data.data);
          setForm({
            siteId: pRes.data.data.siteId?._id || pRes.data.data.siteId,
            name: pRes.data.data.name,
            description: pRes.data.data.description || '',
            budget: pRes.data.data.budget,
          });
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const summary = plan?.summary;

  const savePlan = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload = {
        siteId: form.siteId,
        name: form.name,
        description: form.description,
        budget: Number(form.budget),
        items: plan?.items || [],
        status: plan?.status || 'Draft',
      };
      if (id) {
        const res = await updateActionPlan(id, payload);
        setPlan(res.data.data);
        setSuccess('Plan saved.');
      } else {
        const res = await createActionPlan(payload);
        setPlan(res.data.data);
        setSuccess('Plan created.');
        navigate(`/budget/${res.data.data._id}`, { replace: true });
      }
      loadPlans();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateItem = (index, field, value) => {
    const items = [...(plan.items || [])];
    items[index] = { ...items[index], [field]: value };
    if (field === 'quantity' || field === 'estimatedUnitCost') {
      const q = Number(items[index].quantity) || 0;
      const u = Number(items[index].estimatedUnitCost) || 0;
      items[index].estimatedTotalCost = Math.round(q * u * 100) / 100;
    }
    setPlan({ ...plan, items, summary: recalcSummary(plan.budget, items) });
  };

  const recalcSummary = (budget, items) => {
    const totalEstimated = items.reduce((s, i) => s + (Number(i.estimatedTotalCost) || 0), 0);
    const b = Number(budget) || 0;
    return {
      totalBudget: b,
      totalEstimatedCost: totalEstimated,
      remainingBudget: b - totalEstimated,
      budgetAllocatedPercent: b > 0 ? Math.min(100, Math.round((totalEstimated / b) * 100)) : 0,
      interventionCount: items.length,
      isOverBudget: b - totalEstimated < 0,
    };
  };

  const persistItems = async () => {
    try {
      const res = await updateActionPlan(plan._id, { items: plan.items, budget: plan.budget });
      setPlan(res.data.data);
      setSuccess('Line items updated.');
      loadPlans();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeItem = (index) => {
    const items = plan.items.filter((_, i) => i !== index);
    setPlan({ ...plan, items, summary: recalcSummary(plan.budget, items) });
  };

  const runSuggest = async () => {
    try {
      const res = await suggestBudget(plan._id, plan.budget);
      setSuggestion(res.data.data);
    } catch (err) {
      setError(err.message);
    }
  };

  const applySuggestion = () => {
    if (!suggestion?.selected) return;
    const selectedNames = new Set(suggestion.selected.map((s) => s.interventionName));
    const items = plan.items.map((item) => ({
      ...item,
      status: selectedNames.has(item.interventionName) ? 'Planned' : 'On hold',
    }));
    setPlan({ ...plan, items, summary: recalcSummary(plan.budget, items) });
    setSuccess('Applied heuristic selection statuses (Planned vs On hold). Save line items to persist.');
  };

  const onDelete = async () => {
    try {
      await deleteActionPlan(plan._id);
      setPlan(null);
      setDeleteOpen(false);
      loadPlans();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <LoadingState message="Loading budget planner…" />;

  const displaySummary = summary || recalcSummary(form.budget, plan?.items || []);

  return (
    <div>
      <h2 className="page-title mb-3">Budget planner (INR)</h2>
      {success && <div className="alert alert-success">{success}</div>}
      {error && <ErrorMessage message={error} />}

      <div className="row g-4">
        <div className="col-lg-4">
          <form className="card card-soft p-3" onSubmit={savePlan}>
            <h6>{plan ? 'Edit plan' : 'New action plan'}</h6>
            <div className="mb-2">
              <label className="form-label small">Site *</label>
              <select
                className="form-select form-select-sm"
                required
                value={form.siteId}
                onChange={(e) => setForm({ ...form, siteId: e.target.value })}
              >
                <option value="">Select</option>
                {sites.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-2">
              <label className="form-label small">Plan name *</label>
              <input
                className="form-control form-control-sm"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="mb-2">
              <label className="form-label small">Total budget (INR) *</label>
              <input
                type="number"
                min={0}
                className="form-control form-control-sm"
                required
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
              />
            </div>
            <div className="mb-2">
              <label className="form-label small">Description</label>
              <textarea
                className="form-control form-control-sm"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm">
              {plan ? 'Save plan header' : 'Create plan'}
            </button>
            {plan && (
              <button type="button" className="btn btn-outline-danger btn-sm ms-2" onClick={() => setDeleteOpen(true)}>
                Delete plan
              </button>
            )}
          </form>

          <div className="card card-soft p-3 mt-3">
            <h6>Saved plans</h6>
            <ul className="list-group list-group-flush small">
              {plans.map((p) => (
                <li key={p._id} className="list-group-item px-0">
                  <Link to={`/budget/${p._id}`}>{p.name}</Link>
                  <div className="text-muted">{formatINR(p.summary?.totalEstimatedCost)} / {formatINR(p.budget)}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="col-lg-8">
          {plan && (
            <>
              <div className="row g-2 mb-3">
                <div className="col-md-3">
                  <div className="card card-soft p-2 small">
                    <div className="text-muted">Budget</div>
                    <strong>{formatINR(displaySummary.totalBudget)}</strong>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card card-soft p-2 small">
                    <div className="text-muted">Estimated total</div>
                    <strong>{formatINR(displaySummary.totalEstimatedCost)}</strong>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className={`card card-soft p-2 small ${displaySummary.isOverBudget ? 'border-danger' : ''}`}>
                    <div className="text-muted">Remaining</div>
                    <strong>{formatINR(displaySummary.remainingBudget)}</strong>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card card-soft p-2 small">
                    <div className="text-muted">Allocated</div>
                    <strong>{displaySummary.budgetAllocatedPercent}%</strong>
                  </div>
                </div>
              </div>

              <div className="d-flex gap-2 mb-2">
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={runSuggest}>
                  Suggest within budget
                </button>
                <button type="button" className="btn btn-sm btn-primary" onClick={persistItems}>
                  Save line items
                </button>
              </div>
              {suggestion && (
                <div className="alert alert-info small">
                  {suggestion.note} Selected cost: {formatINR(suggestion.totalSelectedCost)} (
                  {suggestion.selected.length} items).
                  <button type="button" className="btn btn-link btn-sm" onClick={applySuggestion}>
                    Apply as Planned / On hold
                  </button>
                </div>
              )}

              <div className="table-responsive card card-soft">
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th>Intervention</th>
                      <th>Qty</th>
                      <th>Unit cost</th>
                      <th>Total</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(plan.items || []).map((item, idx) => (
                      <tr key={item._id || idx}>
                        <td>{item.interventionName}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="form-control form-control-sm"
                            style={{ width: 70 }}
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="form-control form-control-sm"
                            style={{ width: 90 }}
                            value={item.estimatedUnitCost}
                            onChange={(e) => updateItem(idx, 'estimatedUnitCost', e.target.value)}
                          />
                        </td>
                        <td>{formatINR(item.estimatedTotalCost)}</td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            className="form-control form-control-sm"
                            style={{ width: 60 }}
                            value={item.priority}
                            onChange={(e) => updateItem(idx, 'priority', Number(e.target.value))}
                          />
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={item.status}
                            onChange={(e) => updateItem(idx, 'status', e.target.value)}
                          >
                            {['Proposed', 'Planned', 'In progress', 'Completed', 'On hold'].map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeItem(idx)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!plan.items?.length && (
                      <tr>
                        <td colSpan={7} className="text-muted p-3">
                          Add interventions from the Recommendations page.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!plan && <p className="text-muted">Create or open a plan to manage interventions and costs.</p>}
        </div>
      </div>

      <ConfirmDialog
        show={deleteOpen}
        title="Delete action plan?"
        body="This removes the plan and all line items."
        confirmLabel="Delete"
        onConfirm={onDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
