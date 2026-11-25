import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  getSites,
  getAssessment,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  getAssessments,
} from '../api/api';
import LoadingState from '../components/LoadingState';
import ErrorMessage from '../components/ErrorMessage';
import RiskBadge from '../components/RiskBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import HeatMap from '../components/HeatMap';
import { riskColor } from '../utils/risk';

const SURFACES = [
  'Asphalt',
  'Concrete',
  'Dark paving',
  'Light or reflective paving',
  'Grass',
  'Soil',
  'Vegetated surface',
  'Mixed surface',
  'Other',
];
const LEVELS = ['Low', 'Medium', 'High'];

const defaultForm = {
  siteId: '',
  areaName: '',
  areaType: 'Open courtyard',
  description: '',
  areaSize: '',
  surfaceMaterial: 'Concrete',
  shadeCoverage: 30,
  vegetationCoverage: 20,
  usageIntensity: 'Medium',
  exposureLevel: 'Medium',
  occupancy: '',
  observations: '',
  latitude: '',
  longitude: '',
};

export default function AssessmentPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sites, setSites] = useState([]);
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ ...defaultForm, siteId: searchParams.get('siteId') || '' });
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterRisk, setFilterRisk] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pickMap, setPickMap] = useState(false);

  const loadMeta = async () => {
    const [siteRes, listRes] = await Promise.all([
      getSites({ limit: 100 }),
      getAssessments({
        siteId: filterSite || undefined,
        riskLevel: filterRisk || undefined,
        limit: 50,
      }),
    ]);
    setSites(siteRes.data.data);
    setList(listRes.data.data);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        await loadMeta();
        if (id) {
          const res = await getAssessment(id);
          const a = res.data.data;
          setDetail(a);
          setForm({
            siteId: a.siteId?._id || a.siteId,
            areaName: a.areaName,
            areaType: a.areaType,
            description: a.description || '',
            areaSize: a.areaSize ?? '',
            surfaceMaterial: a.surfaceMaterial,
            shadeCoverage: a.shadeCoverage,
            vegetationCoverage: a.vegetationCoverage,
            usageIntensity: a.usageIntensity,
            exposureLevel: a.exposureLevel,
            occupancy: a.occupancy ?? '',
            observations: a.observations || '',
            latitude: a.latitude ?? '',
            longitude: a.longitude ?? '',
          });
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, filterSite, filterRisk]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const payload = {
      ...form,
      shadeCoverage: Number(form.shadeCoverage),
      vegetationCoverage: Number(form.vegetationCoverage),
      areaSize: form.areaSize === '' ? undefined : Number(form.areaSize),
      occupancy: form.occupancy === '' ? undefined : Number(form.occupancy),
      latitude: form.latitude === '' ? undefined : Number(form.latitude),
      longitude: form.longitude === '' ? undefined : Number(form.longitude),
    };
    try {
      if (id) {
        const res = await updateAssessment(id, payload);
        setDetail(res.data.data);
        setSuccess('Assessment updated and rescored.');
      } else {
        const res = await createAssessment(payload);
        setSuccess('Assessment created.');
        navigate(`/assessment/${res.data.data._id}`);
      }
      loadMeta();
    } catch (err) {
      setError(err.message);
    }
  };

  const onDelete = async () => {
    try {
      await deleteAssessment(id);
      navigate('/assessment');
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteOpen(false);
    }
  };

  if (loading) return <LoadingState message="Loading assessment workspace…" />;

  const factors = detail?.scoreFactors;

  return (
    <div>
      <h2 className="page-title mb-3">{id ? 'Assessment details' : 'New assessment'}</h2>
      {success && <div className="alert alert-success">{success}</div>}
      {error && <ErrorMessage message={error} />}

      {!sites.length && (
        <div className="alert alert-warning">
          No sites found. <Link to="/sites">Create a site</Link> before assessing outdoor areas.
        </div>
      )}

      <div className="row g-4">
        <div className="col-lg-6">
          <form className="card card-soft p-3" onSubmit={onSubmit}>
            <div className="mb-2">
              <label className="form-label small" htmlFor="assess-site">
                Site *
              </label>
              <select
                id="assess-site"
                className="form-select form-select-sm"
                required
                value={form.siteId}
                onChange={(e) => setForm({ ...form, siteId: e.target.value })}
              >
                <option value="">Select site</option>
                {sites.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {[
              ['areaName', 'Area name *', 'text'],
              ['areaType', 'Area type *', 'text'],
              ['areaSize', 'Area size (sq.m)', 'number'],
            ].map(([key, label, type]) => (
              <div className="mb-2" key={key}>
                <label className="form-label small" htmlFor={`a-${key}`}>
                  {label}
                </label>
                <input
                  id={`a-${key}`}
                  type={type}
                  className="form-control form-control-sm"
                  required={label.includes('*')}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="mb-2">
              <label className="form-label small">Surface material *</label>
              <select
                className="form-select form-select-sm"
                value={form.surfaceMaterial}
                onChange={(e) => setForm({ ...form, surfaceMaterial: e.target.value })}
              >
                {SURFACES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="row g-2 mb-2">
              <div className="col-6">
                <label className="form-label small">Shade coverage % *</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="form-control form-control-sm"
                  value={form.shadeCoverage}
                  onChange={(e) => setForm({ ...form, shadeCoverage: e.target.value })}
                  required
                />
              </div>
              <div className="col-6">
                <label className="form-label small">Vegetation coverage % *</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="form-control form-control-sm"
                  value={form.vegetationCoverage}
                  onChange={(e) => setForm({ ...form, vegetationCoverage: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="row g-2 mb-2">
              <div className="col-6">
                <label className="form-label small">Usage intensity *</label>
                <select
                  className="form-select form-select-sm"
                  value={form.usageIntensity}
                  onChange={(e) => setForm({ ...form, usageIntensity: e.target.value })}
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label small">Exposure level *</label>
                <select
                  className="form-select form-select-sm"
                  value={form.exposureLevel}
                  onChange={(e) => setForm({ ...form, exposureLevel: e.target.value })}
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-2">
              <label className="form-label small">Observations</label>
              <textarea
                className="form-control form-control-sm"
                rows={2}
                value={form.observations}
                onChange={(e) => setForm({ ...form, observations: e.target.value })}
              />
            </div>
            <div className="row g-2 mb-2">
              <div className="col-6">
                <label className="form-label small">Latitude</label>
                <input
                  type="number"
                  step="any"
                  className="form-control form-control-sm"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                />
              </div>
              <div className="col-6">
                <label className="form-label small">Longitude</label>
                <input
                  type="number"
                  step="any"
                  className="form-control form-control-sm"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                />
              </div>
            </div>
            <button type="button" className="btn btn-sm btn-outline-secondary mb-2" onClick={() => setPickMap((v) => !v)}>
              {pickMap ? 'Hide map picker' : 'Pick on map'}
            </button>
            {pickMap && (
              <HeatMap
                pickMode
                sites={sites.filter((s) => s._id === form.siteId)}
                areas={[]}
                onPickLocation={({ lat, lng }) =>
                  setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))
                }
              />
            )}
            <div className="d-flex gap-2 mt-2">
              <button type="submit" className="btn btn-primary btn-sm" disabled={!sites.length}>
                {id ? 'Save & rescore' : 'Create assessment'}
              </button>
              {id && (
                <>
                  <Link to={`/recommendations?assessmentId=${id}`} className="btn btn-outline-success btn-sm">
                    Recommendations
                  </Link>
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setDeleteOpen(true)}>
                    Delete
                  </button>
                </>
              )}
            </div>
          </form>
        </div>

        <div className="col-lg-6">
          {detail && (
            <div className="card card-soft p-3 mb-3">
              <h5>Heat concern score</h5>
              <RiskBadge score={detail.riskScore} level={detail.riskLevel} />
              <div className="risk-bar mt-2">
                <div
                  className="risk-bar-fill"
                  style={{ width: `${detail.riskScore}%`, background: riskColor(detail.riskLevel) }}
                />
              </div>
              <p className="small text-muted mt-2 mb-3">
                Relative planning priority based on site observations only (algorithm {detail.algorithmVersion}).
                Not an official heat index or medical risk score.
              </p>
              {factors && (
                <ul className="list-unstyled small">
                  <li>Shade deficiency: {factors.shadeDeficiency?.toFixed(0)} (weight 30%)</li>
                  <li>Surface concern: {factors.surfaceConcern} (weight 25%)</li>
                  <li>Exposure: {factors.exposureScore} (weight 20%)</li>
                  <li>Usage: {factors.usageScore} (weight 15%)</li>
                  <li>Vegetation deficiency: {factors.vegetationDeficiency?.toFixed(0)} (weight 10%)</li>
                </ul>
              )}
              <p className="small mb-0">
                <strong>Suggested next steps:</strong> Review tailored recommendations, add interventions to a budget
                plan, and track implementation in Progress Tracker.
              </p>
            </div>
          )}

          <div className="card card-soft p-3">
            <div className="d-flex flex-wrap gap-2 mb-2">
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: 180 }}
                value={filterSite}
                onChange={(e) => setFilterSite(e.target.value)}
              >
                <option value="">All sites</option>
                {sites.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: 200 }}
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value)}
              >
                <option value="">All severity</option>
                <option value="Very high relative concern">Very high</option>
                <option value="High relative concern">High</option>
                <option value="Moderate relative concern">Moderate</option>
                <option value="Lower relative concern">Lower</option>
              </select>
            </div>
            <h6>Assessments (highest score first)</h6>
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Area</th>
                    <th>Score</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a._id}>
                      <td>
                        {a.areaName}
                        <div className="text-muted small">{a.siteId?.name}</div>
                      </td>
                      <td>{a.riskScore}</td>
                      <td>
                        <Link to={`/assessment/${a._id}`}>Open</Link>
                      </td>
                    </tr>
                  ))}
                  {!list.length && (
                    <tr>
                      <td colSpan={3} className="text-muted">
                        No assessments match filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        show={deleteOpen}
        title="Delete assessment?"
        body="This cannot be undone if referenced by action plans."
        confirmLabel="Delete"
        onConfirm={onDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
