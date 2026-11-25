import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSite } from '../api/api';
import LoadingState from '../components/LoadingState';
import ErrorMessage from '../components/ErrorMessage';
import HeatMap from '../components/HeatMap';
import WeatherPanel from '../components/WeatherPanel';
import RiskBadge from '../components/RiskBadge';
import { formatINR } from '../utils/risk';

export default function SiteDetailsPage() {
  const { id } = useParams();
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await getSite(id);
        setSite(res.data.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorMessage message={error} />;
  if (!site) return null;

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
        <div>
          <h2 className="page-title mb-0">{site.name}</h2>
          <p className="text-muted mb-0">
            {site.type} · {[site.city, site.state, site.country].filter(Boolean).join(', ')}
          </p>
          {site.isDemo && <span className="badge bg-info">Demonstration data</span>}
        </div>
        <Link to={`/assessment?siteId=${site._id}`} className="btn btn-primary btn-sm">
          New assessment
        </Link>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card card-soft p-3 mb-3">
            <p>{site.description || 'No description.'}</p>
            <dl className="row small mb-0">
              <dt className="col-sm-3">Address</dt>
              <dd className="col-sm-9">{site.address || '—'}</dd>
              <dt className="col-sm-3">Coordinates</dt>
              <dd className="col-sm-9">
                {site.latitude != null ? `${site.latitude}, ${site.longitude}` : 'Not set'}
              </dd>
              <dt className="col-sm-3">Total area</dt>
              <dd className="col-sm-9">{site.totalArea ? `${site.totalArea} sq.m` : '—'}</dd>
              <dt className="col-sm-3">Contact</dt>
              <dd className="col-sm-9">{site.contactPerson || '—'}</dd>
            </dl>
          </div>
          <HeatMap sites={[site]} areas={site.assessments || []} />
        </div>
        <div className="col-lg-4">
          <WeatherPanel lat={site.latitude} lon={site.longitude} siteName={site.name} />
        </div>
      </div>

      <div className="row g-4 mt-1">
        <div className="col-lg-7">
          <div className="card card-soft p-3">
            <h5>Assessments</h5>
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
                  {(site.assessments || []).map((a) => (
                    <tr key={a._id}>
                      <td>{a.areaName}</td>
                      <td>
                        <RiskBadge score={a.riskScore} level={a.riskLevel} compact />
                      </td>
                      <td>
                        <Link to={`/assessment/${a._id}`}>View</Link>
                      </td>
                    </tr>
                  ))}
                  {!site.assessments?.length && (
                    <tr>
                      <td colSpan={3} className="text-muted">
                        No assessments yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card card-soft p-3">
            <h5>Action plans</h5>
            <ul className="list-group list-group-flush">
              {(site.actionPlans || []).map((p) => (
                <li key={p._id} className="list-group-item px-0">
                  <Link to={`/budget/${p._id}`}>{p.name}</Link>
                  <div className="small text-muted">
                    Budget {formatINR(p.budget)} · {p.items?.length || 0} items
                  </div>
                </li>
              ))}
              {!site.actionPlans?.length && <li className="list-group-item px-0 text-muted">None yet.</li>}
            </ul>
            <Link to={`/budget?siteId=${site._id}`} className="btn btn-sm btn-outline-primary mt-2">
              Create plan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
