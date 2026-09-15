import datetime as dt
import requests
from backend import config
from backend.store import memory_store

CURRENT_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "is_day",
    "precipitation",
    "weather_code",
    "wind_speed_10m",
]

HOURLY_VARIABLES = [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
]

DAILY_VARIABLES = [
    "temperature_2m_max",
    "temperature_2m_min",
    "apparent_temperature_max",
    "apparent_temperature_min",
    "uv_index_max",
    "precipitation_sum",
]

class WeatherUnavailable(RuntimeError):
    """Raised when usable weather data could not be obtained."""

def _num(value):
    """Coerce an API value to float, tolerating the nulls Open-Meteo returns."""
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    # Open-Meteo uses null for gaps, but guard against NaN slipping through.
    if number != number:
        return None
    return number

def _mean(values):
    clean = [v for v in values if v is not None]
    if not clean:
        return None
    return sum(clean) / len(clean)

def _fetch_raw(latitude, longitude):
    """Call Open-Meteo and return the decoded JSON payload."""
    params = {
        "latitude": round(float(latitude), 4),
        "longitude": round(float(longitude), 4),
        "current": ",".join(CURRENT_VARIABLES),
        "hourly": ",".join(HOURLY_VARIABLES),
        "daily": ",".join(DAILY_VARIABLES),
        "timezone": config.TIMEZONE,
        "past_days": config.PAST_DAYS,
        "forecast_days": config.FORECAST_DAYS,
        "wind_speed_unit": "kmh",
    }
    try:
        response = requests.get(
            config.OPEN_METEO_URL,
            params=params,
            timeout=config.WEATHER_TIMEOUT,
            headers={"User-Agent": "SunscapeMetrics/1.0 (student prototype)"}
        )
        response.raise_for_status()
        return response.json()
    except requests.Timeout as exc:
        raise WeatherUnavailable("Open-Meteo did not respond in time.") from exc
    except requests.RequestException as exc:
        raise WeatherUnavailable(f"Could not reach Open-Meteo: {exc}") from exc
    except ValueError as exc:
        raise WeatherUnavailable("Open-Meteo returned an unreadable response.") from exc

def _clean_current(payload):
    current = payload.get("current") or {}
    temperature = _num(current.get("temperature_2m"))
    apparent = _num(current.get("apparent_temperature"))
    humidity = _num(current.get("relative_humidity_2m"))

    if temperature is None:
        raise WeatherUnavailable("Open-Meteo returned no current temperature.")

    # Apparent temperature is the backbone of every heat rule, so if the API
    # omits it we fall back to the plain air temperature rather than failing.
    if apparent is None:
        apparent = temperature

    return {
        "time": current.get("time"),
        "temperature": round(temperature, 1),
        "apparent_temperature": round(apparent, 1),
        "humidity": round(humidity) if humidity is not None else None,
        "wind_speed": _num(current.get("wind_speed_10m")),
        "is_day": bool(current.get("is_day", 1)),
        "weather_code": current.get("weather_code"),
    }

def _clean_hourly(payload):
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    temps = hourly.get("temperature_2m") or []
    apparents = hourly.get("apparent_temperature") or []
    humidities = hourly.get("relative_humidity_2m") or []

    rows = []
    for index, stamp in enumerate(times):
        temperature = _num(temps[index] if index < len(temps) else None)
        if temperature is None:
            continue
        apparent = _num(apparents[index] if index < len(apparents) else None)
        rows.append(
            {
                "time": stamp,
                "date": str(stamp)[:10],
                "temperature": temperature,
                "apparent_temperature": (
                    apparent if apparent is not None else temperature
                ),
                "humidity": _num(
                    humidities[index] if index < len(humidities) else None
                ),
            }
        )
    return rows

def humidity_by_date(hourly_rows):
    """Aggregate the hourly humidity series into per-day mean and max."""
    buckets = {}
    for row in hourly_rows:
        if row["humidity"] is None:
            continue
        buckets.setdefault(row["date"], []).append(row["humidity"])
    summary = {}
    for date, values in buckets.items():
        summary[date] = {
            "humidity_mean": round(_mean(values), 1),
            "humidity_max": round(max(values), 1),
        }
    return summary

def _clean_daily(payload, hourly_rows, today):
    daily = payload.get("daily") or {}
    dates = daily.get("time") or []
    humidity_lookup = humidity_by_date(hourly_rows)

    def column(name):
        return daily.get(name) or []

    rows = []
    for index, date in enumerate(dates):
        def at(name):
            values = column(name)
            return _num(values[index] if index < len(values) else None)

        temp_max = at("temperature_2m_max")
        if temp_max is None:
            # A day without a maximum temperature cannot be classified.
            continue

        apparent_max = at("apparent_temperature_max")
        if apparent_max is None:
            apparent_max = temp_max

        humidity = humidity_lookup.get(date, {})

        try:
            offset = (dt.date.fromisoformat(date) - today).days
        except ValueError:
            offset = index

        rows.append(
            {
                "date": date,
                "offset_days": offset,
                "is_past": offset < 0,
                "temp_max": round(temp_max, 1),
                "temp_min": at("temperature_2m_min"),
                "apparent_max": round(apparent_max, 1),
                "apparent_min": at("apparent_temperature_min"),
                "humidity_mean": humidity.get("humidity_mean"),
                "humidity_max": humidity.get("humidity_max"),
                "uv_index_max": at("uv_index_max"),
                "precipitation": at("precipitation_sum"),
            }
        )

    if not rows:
        raise WeatherUnavailable("Open-Meteo returned no usable daily data.")
    return rows

def get_weather(latitude, longitude, use_cache=True):
    """Fetch and clean weather for a coordinate pair.

    Returns a dictionary with ``current``, ``hourly`` and ``daily`` keys. Each
    daily row carries ``offset_days`` (0 = today, negative = observed past),
    which is what the HeatAlert engine uses to separate the recent baseline
    from the forecast window.
    """
    cache_key = f"weather:{round(float(latitude), 3)}:{round(float(longitude), 3)}"
    if use_cache:
        cached = memory_store.cache_get(cache_key)
        if cached:
            return cached

    payload = _fetch_raw(latitude, longitude)

    current = _clean_current(payload)
    hourly = _clean_hourly(payload)

    # "Today" is taken from the API's own local timestamp so that the day
    # offsets stay correct regardless of the server's clock or timezone.
    today_text = str(current.get("time") or "")[:10]
    try:
        today = dt.date.fromisoformat(today_text)
    except ValueError:
        today = dt.date.today()

    daily = _clean_daily(payload, hourly, today)

    weather = {
        "source": "Open-Meteo",
        "latitude": payload.get("latitude", latitude),
        "longitude": payload.get("longitude", longitude),
        "timezone": payload.get("timezone", config.TIMEZONE),
        "fetched_at": dt.datetime.now().isoformat(timespec="seconds"),
        "current": current,
        "hourly": hourly,
        "daily": daily,
        "units": {
            "temperature": "°C",
            "humidity": "%",
            "wind_speed": "km/h",
        },
    }

    if use_cache:
        memory_store.cache_set(cache_key, weather, config.WEATHER_CACHE_TTL)

    return weather

if __name__ == "__main__":  # manual smoke test: python -m data.open_meteo
    area = config.get_area("navi-mumbai")
    data = get_weather(area["latitude"], area["longitude"])
    print(area["name"], data["current"])
    for day in data["daily"]:
        print(day["date"], day["offset_days"], day["temp_max"], day["apparent_max"])