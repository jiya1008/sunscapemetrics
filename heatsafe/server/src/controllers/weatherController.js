import { AppError } from '../middleware/errorHandler.js';
import { parseCoord } from '../utils/validators.js';
import { fetchCurrentWeather, fetchForecastWeather } from '../services/weatherService.js';

export async function getCurrent(req, res, next) {
  try {
    const lat = parseCoord(req.query.lat, -90, 90, 'Latitude');
    const lon = parseCoord(req.query.lon, -180, 180, 'Longitude');
    if (!lat.ok || lat.value === undefined) throw new AppError('Valid lat query parameter required', 400);
    if (!lon.ok || lon.value === undefined) throw new AppError('Valid lon query parameter required', 400);

    const data = await fetchCurrentWeather(lat.value, lon.value);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getForecast(req, res, next) {
  try {
    const lat = parseCoord(req.query.lat, -90, 90, 'Latitude');
    const lon = parseCoord(req.query.lon, -180, 180, 'Longitude');
    if (!lat.ok || lat.value === undefined) throw new AppError('Valid lat query parameter required', 400);
    if (!lon.ok || lon.value === undefined) throw new AppError('Valid lon query parameter required', 400);

    const data = await fetchForecastWeather(lat.value, lon.value);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
