import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getAssessments,
  getRecommendations,
  getActionPlans,
  getActionPlan,
  updateActionPlan,
} from '../api/api';
import LoadingState from '../components/LoadingState';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import { formatINR } from '../utils/risk';

const CATEGORIES = [
  'Shade structures',
  'Tree planting and vegetation',
  'Reflective or lighter-colored roofing',
  'Cool or lighter-colored paving',
  'Permeable surfaces or vegetation',
  'Outdoor seating or activity relocation',
  'Shade improvements for walkways',
  'Planting and landscape improvements',
];

export default function RecommendationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const assessmentId = searchParams.get('assessmentId') || '';
  const [assessments, setAssessments] = useState([]);
  const [recs, setRecs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState('priority');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [compare, setCompare] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const aRes = await getAssessments({ limit: 100 });
        setAssessments(aRes.data.data);
        const pRes = await getActionPlans({ limit: 50 });
        setPlans(pRes.data.data);
        if (!assessmentId && aRes.data.data[0]) {
          setSearchParams({ assessmentId: aRes.data.data[0]._id });
        }
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!assessmentId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getRecommendations(assessmentId);
        setRecs(res.data.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [assessmentId]);

  let filtered = recs.filter((r) => !category || r.category === category);
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'cost') {
      return (a.estimatedMinCost + a.estimatedMaxCost) / 2 - (b.estimatedMinCost + b.estimatedMaxCost) / 2;
    }
    return a.priority - b.priority;
  });

  const toggleCompare = (name) => {
    setCompare((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name].slice(0, 3)));
  };

  const addToPlan = async (rec) => {
    if (!selectedPlan) {
      setError('Select an action plan first.');
      return;
    }
    setError('');
    try {
      const fullRes = await getActionPlan(selectedPlan);
      const full = fullRes.data.data;
      const unitCost = Math.round((rec.estimatedMinCost + rec.estimatedMaxCost) / 2);
      const items = [
        ...(full.items || []),
        {
          assessmentId,
          interventionId: rec.interventionId,
          interventionName: rec.name,
          category: rec.category,
          quantity: 1,
          unit: rec.unit,
          estimatedUnitCost: unitCost,
          estimatedTotalCost: unitCost,
          priority: rec.priority,
          status: 'Proposed',
        },
      ];
      await updateActionPlan(selectedPlan, { items });
      setSuccess(`Added "${rec.name}" to plan.`);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2 className="page-title mb-3">Recommendations</h2>
      {success && <div className="alert alert-success">{success}</div>}
      {error && <ErrorMessage message={error} />}

      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <label className="form-label small">Assessment</label>
          <select
            className="form-select form-select-sm"
            value={assessmentId}
            onChange={(e) => setSearchParams({ assessmentId: e.target.value })}
          >
            <option value="">Select assessment</option>
            {assessments.map((a) => (
              <option key={a._id} value={a._id}>
                {a.areaName} ({a.siteId?.name}) — score {a.riskScore}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label small">Category</label>
          <select className="form-select form-select-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-2">
          <label className="form-label small">Sort</label>
          <select className="form-select form-select-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="priority">Priority</option>
            <option value="cost">Est. cost</option>
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label small">Add to action plan</label>
          <select className="form-select form-select-sm" value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}>
            <option value="">Select plan</option>
            {plans.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : !assessmentId ? (
        <EmptyState title="Select an assessment" message="Choose an assessment to generate rule-based recommendations." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matching recommendations" message="Try another assessment or clear category filters." />
      ) : (
        <div className="row g-3">
          {filtered.map((r) => (
            <div className="col-md-6" key={r.name}>
              <div className="card card-soft h-100 p-3">
                <div className="d-flex justify-content-between">
                  <h6>{r.name}</h6>
                  <span className="badge bg-secondary">P{r.priority}</span>
                </div>
                <p className="small text-muted mb-1">{r.category}</p>
                <p className="small">{r.description}</p>
                <p className="small">
                  <strong>Why:</strong> {r.whyRecommended}
                </p>
                <p className="small">
                  <strong>Addresses:</strong> {(r.addresses || []).join(', ')}
                </p>
                <p className="small text-muted">{r.costAssumptionNote}</p>
                <p className="small fw-semibold">
                  Est. {formatINR(r.estimatedMinCost)} – {formatINR(r.estimatedMaxCost)} ({r.unit})
                </p>
                <div className="d-flex gap-2 mt-auto">
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => addToPlan(r)}>
                    Add to plan
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggleCompare(r.name)}>
                    {compare.includes(r.name) ? 'Remove compare' : 'Compare'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {compare.length > 0 && (
        <div className="card card-soft p-3 mt-4">
          <h6>Compare selected ({compare.length}/3)</h6>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Priority</th>
                  <th>Est. cost mid</th>
                </tr>
              </thead>
              <tbody>
                {filtered
                  .filter((r) => compare.includes(r.name))
                  .map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td>{r.priority}</td>
                      <td>{formatINR((r.estimatedMinCost + r.estimatedMaxCost) / 2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="small text-muted mt-3">
        <Link to="/budget">Open Budget Planner</Link> to adjust quantities and costs.
      </p>
    </div>
  );
}
