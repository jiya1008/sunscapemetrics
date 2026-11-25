const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function cacheKey(type, lat, lon) {
  return `${type}:${lat.toFixed(3)}:${lon.toFixed(3)}`;
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { at: Date.now(), data });
}

export function isWeatherConfigured() {
  return Boolean(process.env.OPENWEATHER_API_KEY?.trim());
}

export async function fetchCurrentWeather(lat, lon) {
  const key = process.env.OPENWEATHER_API_KEY?.trim();
  if (!key) {
    return {
      configured: false,
      message: 'OpenWeather API key not configured. Set OPENWEATHER_API_KEY in server/.env',
    };
  }

  const ck = cacheKey('current', lat, lon);
  const cached = getCached(ck);
  if (cached) return { ...cached, cached: true };

  const url = new URL('https://api.openweathermap.org/data/2.5/weather');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('appid', key);
  url.searchParams.set('units', 'metric');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.status === 401) {
      return { configured: true, error: 'Invalid OpenWeather API key' };
    }
    if (res.status === 429) {
      return { configured: true, error: 'OpenWeather rate limit exceeded. Try again later.' };
    }
    if (!res.ok) {
      return { configured: true, error: `Weather service error (${res.status})` };
    }
    const data = await res.json();
    const normalized = {
      configured: true,
      source: 'OpenWeather',
      units: 'metric',
      timestamp: new Date(data.dt * 1000).toISOString(),
      location: { lat, lon, name: data.name },
      temperatureC: data.main?.temp,
      feelsLikeC: data.main?.feels_like,
      humidity: data.main?.humidity,
      windSpeedMs: data.wind?.speed,
      description: data.weather?.[0]?.description ?? '',
      disclaimer:
        'Area-level weather context only; not the temperature at a specific courtyard or micro-location.',
    };
    setCache(ck, normalized);
    return normalized;
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      return { configured: true, error: 'Weather request timed out' };
    }
    return { configured: true, error: 'Unable to reach weather service' };
  }
}

export async function fetchForecastWeather(lat, lon) {
  const key = process.env.OPENWEATHER_API_KEY?.trim();
  if (!key) {
    return {
      configured: false,
      message: 'OpenWeather API key not configured. Set OPENWEATHER_API_KEY in server/.env',
    };
  }

  const ck = cacheKey('forecast', lat, lon);
  const cached = getCached(ck);
  if (cached) return { ...cached, cached: true };

  const url = new URL('https://api.openweathermap.org/data/2.5/forecast');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('appid', key);
  url.searchParams.set('units', 'metric');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      return { configured: true, error: `Forecast service error (${res.status})` };
    }
    const data = await res.json();
    const daily = (data.list || []).slice(0, 8).map((item) => ({
      time: new Date(item.dt * 1000).toISOString(),
      temperatureC: item.main?.temp,
      feelsLikeC: item.main?.feels_like,
      humidity: item.main?.humidity,
      windSpeedMs: item.wind?.speed,
      description: item.weather?.[0]?.description ?? '',
    }));

    const normalized = {
      configured: true,
      source: 'OpenWeather',
      units: 'metric',
      location: { lat, lon, name: data.city?.name },
      forecast: daily,
      disclaimer:
        'Grid-level forecast for general context; not a prediction for individual outdoor microclimates.',
    };
    setCache(ck, normalized);
    return normalized;
  } catch (e) {
    clearTimeout(timeout);
    return { configured: true, error: 'Unable to fetch forecast' };
  }
}
