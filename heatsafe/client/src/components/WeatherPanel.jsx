import { useEffect, useState } from 'react';
import { getCurrentWeather, getForecastWeather } from '../api/api';
import LoadingState from './LoadingState';
import ErrorMessage from './ErrorMessage';

export default function WeatherPanel({ lat, lon, siteName }) {
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (lat == null || lon == null) {
      setCurrent(null);
      setForecast(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [cRes, fRes] = await Promise.all([
          getCurrentWeather(lat, lon),
          getForecastWeather(lat, lon),
        ]);
        if (!cancelled) {
          setCurrent(cRes.data.data);
          setForecast(fRes.data.data);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  if (lat == null || lon == null) {
    return (
      <div className="alert alert-light border mb-0">
        Select a site with coordinates to view area-level weather context.
      </div>
    );
  }

  if (loading) return <LoadingState message="Fetching weather context…" />;
  if (error) return <ErrorMessage message={error} />;

  if (current && !current.configured) {
    return (
      <div className="alert alert-warning mb-0">
        {current.message || 'Weather integration is not configured on the server.'}
      </div>
    );
  }

  if (current?.error) {
    return <div className="alert alert-warning mb-0">{current.error}</div>;
  }

  return (
    <div className="card card-soft">
      <div className="card-body">
        <h6 className="text-primary-brand">
          <i className="bi bi-cloud-sun me-2" aria-hidden />
          Weather context {siteName ? `— ${siteName}` : ''}
        </h6>
        {current && (
          <div className="row g-3">
            <div className="col-md-4">
              <div className="display-6">{current.temperatureC?.toFixed(1)}°C</div>
              <div className="text-capitalize text-muted">{current.description}</div>
            </div>
            <div className="col-md-8">
              <ul className="list-unstyled small mb-0">
                <li>Feels like: {current.feelsLikeC?.toFixed(1)}°C</li>
                <li>Humidity: {current.humidity}%</li>
                <li>Wind: {current.windSpeedMs} m/s</li>
                <li>Source: {current.source} ({current.units})</li>
              </ul>
            </div>
          </div>
        )}
        {forecast?.forecast?.length > 0 && (
          <div className="mt-3">
            <div className="small fw-semibold mb-2">Next forecast periods</div>
            <div className="d-flex flex-wrap gap-2">
              {forecast.forecast.slice(0, 4).map((f) => (
                <div key={f.time} className="border rounded px-2 py-1 small bg-light">
                  {new Date(f.time).toLocaleString(undefined, { weekday: 'short', hour: '2-digit' })}
                  : {f.temperatureC?.toFixed(0)}°C
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="small text-muted mt-3 mb-0">{current?.disclaimer}</p>
      </div>
    </div>
  );
}
