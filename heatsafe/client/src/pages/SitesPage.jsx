import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSites, createSite, updateSite, deleteSite } from '../api/api';
import LoadingState from '../components/LoadingState';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import HeatMap from '../components/HeatMap';

const SITE_TYPES = [
  'College or university',
  'School',
  'Housing society',
  'Office',
  'Public or community facility',
  'Other',
];

const emptyForm = {
  name: '',
  type: 'College or university',
  description: '',
  address: '',
  city: '',
  state: '',
  country: 'India',
  latitude: '',
  longitude: '',
  totalArea: '',
  contactPerson: '',
};

export default function SitesPage() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [pickMap, setPickMap] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getSites({ search: search || undefined, type: typeFilter || undefined, limit: 100 });
      setSites(res.data.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search, typeFilter]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    try {
      const payload = {
        ...form,
        latitude: form.latitude === '' ? undefined : Number(form.latitude),
        longitude: form.longitude === '' ? undefined : Number(form.longitude),
        totalArea: form.totalArea === '' ? undefined : Number(form.totalArea),
      };
      if (editingId) {
        await updateSite(editingId, payload);
        setSuccess('Site updated.');
      } else {
        await createSite(payload);
        setSuccess('Site created.');
      }
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (site) => {
    setEditingId(site._id);
    setForm({
      name: site.name,
      type: site.type,
      description: site.description || '',
      address: site.address || '',
      city: site.city || '',
      state: site.state || '',
      country: site.country || 'India',
      latitude: site.latitude ?? '',
      longitude: site.longitude ?? '',
      totalArea: site.totalArea ?? '',
      contactPerson: site.contactPerson || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmDelete = async () => {
    try {
      await deleteSite(deleteTarget._id);
      setDeleteTarget(null);
      load();
      setSuccess('Site deleted.');
    } catch (err) {
      setError(err.message);
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <h2 className="page-title mb-3">Sites</h2>
      {success && <div className="alert alert-success">{success}</div>}
      {error && <ErrorMessage message={error} onRetry={load} />}

      <div className="row g-4">
        <div className="col-lg-5">
          <div className="card card-soft p-3">
            <h5>{editingId ? 'Edit site' : 'Add site'}</h5>
            <form onSubmit={onSubmit} className="row g-2">
              {[
                ['name', 'Site name', 'text', true],
                ['city', 'City', 'text', false],
                ['state', 'State', 'text', false],
                ['address', 'Address', 'text', false],
                ['latitude', 'Latitude', 'number', false],
                ['longitude', 'Longitude', 'number', false],
                ['totalArea', 'Total area (sq.m)', 'number', false],
                ['contactPerson', 'Contact person', 'text', false],
              ].map(([key, label, type, req]) => (
                <div className="col-12" key={key}>
                  <label className="form-label small mb-0" htmlFor={`site-${key}`}>
                    {label}
                  </label>
                  <input
                    id={`site-${key}`}
                    className="form-control form-control-sm"
                    type={type}
                    required={req}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    step={type === 'number' ? 'any' : undefined}
                  />
                </div>
              ))}
              <div className="col-12">
                <label className="form-label small mb-0" htmlFor="site-type">
                  Site type
                </label>
                <select
                  id="site-type"
                  className="form-select form-select-sm"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  {SITE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label small mb-0" htmlFor="site-desc">
                  Description
                </label>
                <textarea
                  id="site-desc"
                  className="form-control form-control-sm"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="col-12">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary me-2"
                  onClick={() => setPickMap((v) => !v)}
                >
                  {pickMap ? 'Disable map pick' : 'Pick location on map'}
                </button>
              </div>
              {pickMap && (
                <div className="col-12">
                  <HeatMap
                    sites={[]}
                    areas={[]}
                    pickMode
                    onPickLocation={({ lat, lng }) =>
                      setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))
                    }
                    heightClass="map-wrap"
                  />
                </div>
              )}
              <div className="col-12 d-flex gap-2">
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingId ? 'Save changes' : 'Create site'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                    }}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="d-flex flex-wrap gap-2 mb-3">
            <input
              className="form-control form-control-sm"
              style={{ maxWidth: 220 }}
              placeholder="Search name or location"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search sites"
            />
            <select
              className="form-select form-select-sm"
              style={{ maxWidth: 220 }}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by type"
            >
              <option value="">All types</option>
              {SITE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <LoadingState />
          ) : sites.length === 0 ? (
            <EmptyState title="No sites yet" message="Create your first site using the form." />
          ) : (
            <div className="table-responsive card card-soft">
              <table className="table table-hover mb-0 align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Location</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sites.map((s) => (
                    <tr key={s._id}>
                      <td>
                        <Link to={`/sites/${s._id}`}>{s.name}</Link>
                        {s.isDemo && <span className="badge bg-info ms-1">Demo</span>}
                      </td>
                      <td>{s.type}</td>
                      <td className="small">
                        {[s.city, s.state].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="text-end">
                        <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => startEdit(s)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleteTarget(s)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        show={!!deleteTarget}
        title="Delete site?"
        body={`Remove "${deleteTarget?.name}"? Deletion is blocked if assessments or plans exist.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
