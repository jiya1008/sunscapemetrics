import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  getDashboardSummary,
  getRiskDistribution,
  getRecentActivity,
  getSites,
} from '../api/api';
import StatCard from '../components/StatCard';
import LoadingState from '../components/LoadingState';
import ErrorMessage from '../components/ErrorMessage';
import HeatMap from '../components/HeatMap';
import WeatherPanel from '../components/WeatherPanel';
import RiskBadge from '../components/RiskBadge';
import { formatINR } from '../utils/risk';

const PIE_COLORS = ['#52b788', '#f4a261', '#e76f51', '#c1121f'];

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [riskDist, setRiskDist] = useState([]);
  const [activity, setActivity] = useState(null);
  const [sites, setSites] = useState([]);
  const [weatherSiteId, setWeatherSiteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [s, r, a, siteRes] = await Promise.all([
        getDashboardSummary(),
        getRiskDistribution(),
        getRecentActivity(),
        getSites({ limit: 50 }),
      ]);
      setSummary(s.data.data);
      setRiskDist(r.data.data);
      setActivity(a.data.data);
      setSites(siteRes.data.data);
      if (siteRes.data.data[0]) setWeatherSiteId(siteRes.data.data[0]._id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const weatherSite = sites.find((s) => s._id === weatherSiteId);

  if (loading) return <LoadingState message="Loading dashboard…" />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h2 className="page-title mb-0">Dashboard</h2>
          <p className="text-muted mb-0">Overview from your HeatSafe workspace data</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/sites" className="btn btn-outline-primary btn-sm">
            Add Site
          </Link>
          <Link to="/assessment" className="btn btn-primary btn-sm">
            Create Assessment
          </Link>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-4 col-xl-2">
          <StatCard icon="bi-buildings" label="Sites" value={summary?.totalSites} />
        </div>
        <div className="col-6 col-lg-4 col-xl-2">
          <StatCard icon="bi-clipboard-check" label="Assessments" value={summary?.totalAssessments} />
        </div>
        <div className="col-6 col-lg-4 col-xl-2">
          <StatCard icon="bi-exclamation-triangle" label="High concern" value={summary?.highConcernAreas} />
        </div>
        <div className="col-6 col-lg-4 col-xl-2">
          <StatCard icon="bi-tools" label="Proposed items" value={summary?.proposedInterventions} />
        </div>
        <div className="col-6 col-lg-4 col-xl-2">
          <StatCard icon="bi-kanban" label="Active plans" value={summary?.activeActionPlans} />
        </div>
        <div className="col-6 col-lg-4 col-xl-2">
          <StatCard icon="bi-cash" label="Budget allocated" value={formatINR(summary?.budgetAllocated)} />
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-6">
          <div className="card card-soft p-3 h-100">
            <h6 className="text-primary-brand">Assessment priority (top scores)</h6>
            {activity?.priorityChart?.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={activity.priorityChart}>
                  <XAxis dataKey="name" hide />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted small mb-0">No assessments yet.</p>
            )}
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card card-soft p-3 h-100">
            <h6 className="text-primary-brand">Risk distribution</h6>
            {riskDist.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={riskDist} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {riskDist.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted small mb-0">No risk data yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-7">
          <div className="card card-soft p-3">
            <h6 className="text-primary-brand mb-3">Site & assessment map</h6>
            <HeatMap sites={activity?.mapSites || []} areas={activity?.mapAreas || []} />
          </div>
        </div>
        <div className="col-lg-5">
          <label className="form-label small fw-semibold" htmlFor="weather-site">
            Weather context site
          </label>
          <select
            id="weather-site"
            className="form-select mb-3"
            value={weatherSiteId}
            onChange={(e) => setWeatherSiteId(e.target.value)}
          >
            {sites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
          <WeatherPanel lat={weatherSite?.latitude} lon={weatherSite?.longitude} siteName={weatherSite?.name} />
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card card-soft p-3">
            <h6 className="text-primary-brand">Highest-priority areas</h6>
            <ul className="list-group list-group-flush">
              {(activity?.topPriority || []).map((a) => (
                <li key={a._id} className="list-group-item px-0 d-flex justify-content-between align-items-center">
                  <div>
                    <Link to={`/assessment/${a._id}`}>{a.areaName}</Link>
                    <div className="small text-muted">{a.siteId?.name}</div>
                  </div>
                  <RiskBadge score={a.riskScore} level={a.riskLevel} compact />
                </li>
              ))}
              {!activity?.topPriority?.length && <li className="list-group-item px-0 text-muted">No data</li>}
            </ul>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card card-soft p-3">
            <h6 className="text-primary-brand">Intervention status</h6>
            {activity?.interventionStatusChart?.length ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={activity.interventionStatusChart} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#40916c" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted small">No action plan items yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
