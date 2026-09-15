"""
Sunscape Metrics - central configuration.

Everything that might change between machines lives here, and is read from
environment variables (see .env.example) so that nothing sensitive or
machine-specific is hard-coded into the application logic.
"""

import os

from dotenv import load_dotenv

load_dotenv()


def _as_bool(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def _as_int(value, default):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------------------
# Flask server
# ---------------------------------------------------------------------------

HOST = os.getenv("SUNSCAPE_HOST", "127.0.0.1")
PORT = _as_int(os.getenv("SUNSCAPE_PORT"), 5000)
DEBUG = _as_bool(os.getenv("SUNSCAPE_DEBUG"), True)

# Browser origins allowed to call the API. "*" is fine for a local prototype,
# but the value is kept configurable so a deployment can lock it down.
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("SUNSCAPE_CORS_ORIGINS", "*").split(",")
    if origin.strip()
]

# ---------------------------------------------------------------------------
# Upstream data services
# ---------------------------------------------------------------------------

OPEN_METEO_URL = os.getenv(
    "OPEN_METEO_URL", "https://api.open-meteo.com/v1/forecast"
)
OVERPASS_URL = os.getenv(
    "OVERPASS_URL", "https://overpass-api.de/api/interpreter"
)

# Seconds to wait on an upstream call before giving up.
WEATHER_TIMEOUT = _as_int(os.getenv("SUNSCAPE_WEATHER_TIMEOUT"), 15)
OSM_TIMEOUT = _as_int(os.getenv("SUNSCAPE_OSM_TIMEOUT"), 30)

# How long a cached upstream response stays usable (seconds).
WEATHER_CACHE_TTL = _as_int(os.getenv("SUNSCAPE_WEATHER_CACHE_TTL"), 600)
OSM_CACHE_TTL = _as_int(os.getenv("SUNSCAPE_OSM_CACHE_TTL"), 86400)
AI_CACHE_TTL = _as_int(os.getenv("SUNSCAPE_AI_CACHE_TTL"), 900)

TIMEZONE = os.getenv("SUNSCAPE_TIMEZONE", "Asia/Kolkata")

# Days of recent observed weather and days of forecast requested from
# Open-Meteo. Past days give HeatAlert a real trend baseline without needing
# a historical dataset of our own.
PAST_DAYS = _as_int(os.getenv("SUNSCAPE_PAST_DAYS"), 7)
FORECAST_DAYS = _as_int(os.getenv("SUNSCAPE_FORECAST_DAYS"), 7)


# ---------------------------------------------------------------------------
# LLM interpretation layer - Google Gemini (free tier).
#
# The key never appears in source. It is read from backend/.env, which is
# gitignored, and sent as a request header rather than in the URL (a key in a
# URL ends up in server and proxy logs).
#
# If the key is missing or Gemini is unreachable, the app falls back to a
# rule-based summary built from the same structured assessment, so the site
# always works.
# ---------------------------------------------------------------------------

AI_ENABLED = _as_bool(os.getenv("SUNSCAPE_AI_ENABLED"), True)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip()
GEMINI_URL = os.getenv(
    "GEMINI_URL", "https://generativelanguage.googleapis.com/v1beta/models"
)
GEMINI_TIMEOUT = _as_int(os.getenv("SUNSCAPE_GEMINI_TIMEOUT"), 30)

# ---------------------------------------------------------------------------
# Rate limiting (simple in-memory fixed window, per client IP)
# ---------------------------------------------------------------------------

RATE_LIMIT_REQUESTS = _as_int(os.getenv("SUNSCAPE_RATE_LIMIT_REQUESTS"), 60)
RATE_LIMIT_WINDOW = _as_int(os.getenv("SUNSCAPE_RATE_LIMIT_WINDOW"), 60)


# ---------------------------------------------------------------------------
# Study area: Mumbai Metropolitan Region
# ---------------------------------------------------------------------------

AREAS = {
    "mumbai": {
        "id": "mumbai",
        "name": "Mumbai",
        "subtitle": "Greater Mumbai, coastal island city",
        "latitude": 19.0760,
        "longitude": 72.8777,
        "radius_m": 6000,
    },
    "navi-mumbai": {
        "id": "navi-mumbai",
        "name": "Navi Mumbai",
        "subtitle": "Planned township east of Thane Creek",
        "latitude": 19.0330,
        "longitude": 73.0297,
        "radius_m": 6000,
    },
    "thane": {
        "id": "thane",
        "name": "Thane",
        "subtitle": "Inland city at the head of Thane Creek",
        "latitude": 19.2183,
        "longitude": 72.9781,
        "radius_m": 6000,
    },
}

DEFAULT_AREA = os.getenv("SUNSCAPE_DEFAULT_AREA", "navi-mumbai")


def get_area(area_id):
    """Return the area record for ``area_id``, or ``None`` if unknown.

    Lookup is case/format tolerant so that "Navi Mumbai", "navi_mumbai" and
    "navi-mumbai" all resolve to the same area.
    """
    if not area_id or not isinstance(area_id, str):
        return None
    key = area_id.strip().lower().replace(" ", "-").replace("_", "-")
    return AREAS.get(key)


def list_areas():
    """All configured areas, in a stable display order."""
    return [AREAS[key] for key in ("mumbai", "navi-mumbai", "thane")]