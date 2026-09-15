"""
Sunscape Metrics - Flask application.

Browser -> Flask -> Open-Meteo / OpenStreetMap
          |
          +-> data cleaning
          +-> heat rules          (logic/heat_rules.py)
          +-> heat assessment     (logic/heat_alert.py)
          +-> local LLM           (ai/explain.py)
          |
JSON -> Browser

The backend owns every number. The LLM only ever sees what the backend has
already calculated.

Run it with: python app.py
"""

import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

import config
from ai import explain
from data import open_meteo, osm
from logic import heat_alert, heat_rules
from store import memory_store

FRONTEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "frontend")
)

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app, resources={r"/api/*": {"origins": config.CORS_ORIGINS}})

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("sunscape")

# ---------------------------------------------------------------------------
# Request plumbing: rate limiting, security headers, timing
# ---------------------------------------------------------------------------


@app.before_request
def _guard_request():
    if not request.path.startswith("/api/"):
        return None

    request.environ["sunscape.start"] = time.time()

    client_id = (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or request.remote_addr
        or "unknown"
    )
    allowed, remaining, retry_after = memory_store.hit_rate_limit(
        client_id, config.RATE_LIMIT_REQUESTS, config.RATE_LIMIT_WINDOW
    )
    request.environ["sunscape.rate_remaining"] = remaining

    if not allowed:
        log.warning("Rate limit hit by %s on %s", client_id, request.path)
        response = jsonify(
            {
                "ok": False,
                "error": "rate_limited",
                "message": "Too many requests. Please wait a moment before trying again.",
            }
        )
        response.status_code = 429
        response.headers["Retry-After"] = str(retry_after)
        return response

    return None


@app.after_request
def _finish_request(response):
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

    if request.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
        remaining = request.environ.get("sunscape.rate_remaining")
        if remaining is not None:
            response.headers["X-RateLimit-Remaining"] = str(remaining)

        started = request.environ.get("sunscape.start")
        if started:
            log.info(
                "%s %s -> %s in %.0f ms",
                request.method,
                request.full_path.rstrip("?"),
                response.status_code,
                (time.time() - started) * 1000,
            )

    return response


def _fail(message, status=400, code="bad_request"):
    response = jsonify({"ok": False, "error": code, "message": message})
    response.status_code = status
    return response


@app.errorhandler(404)
def _not_found(error):
    if request.path.startswith("/api/"):
        return _fail("Unknown endpoint.", 404, "not_found")
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.errorhandler(500)
def _server_error(error):
    log.exception("Unhandled server error: %s", error)
    return _fail("Something went wrong on the server.", 500, "server_error")


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------


def _require_area():
    """Resolve the ``area`` query parameter, or raise ``ValueError``."""
    raw = request.args.get("area") or config.DEFAULT_AREA

    if len(raw) > 40:
        raise ValueError("Area name is too long.")

    area = config.get_area(raw)
    if area is None:
        valid = ", ".join(a["id"] for a in config.list_areas())
        raise ValueError(f"Unknown area '{raw}'. Valid areas: {valid}.")
    return area


def _wants_ai():
    """AI explanation is on unless the caller opts out with ?ai=0."""
    return request.args.get("ai", "1").strip().lower() not in ("0", "false", "no")


def _requested_scenario():
    """Resolve an optional ``scenario`` parameter, or raise ``ValueError``."""
    raw = (request.args.get("scenario") or "").strip().lower()
    if not raw or raw == "live":
        return None
    if raw not in heat_alert.SCENARIOS:
        valid = ", ".join(heat_alert.SCENARIOS)
        raise ValueError(f"Unknown scenario '{raw}'. Valid scenarios: {valid}.")
    return raw


# ---------------------------------------------------------------------------
# HeatWatch assembly
# ---------------------------------------------------------------------------


def build_heatwatch(weather):
    """Current-conditions view: classify now, and read the short-term trend."""
    current = weather["current"]

    today = next(
        (day for day in weather["daily"] if day.get("offset_days") == 0), None
    )

    watch = heat_rules.classify(
        temperature=current["temperature"],
        apparent_temperature=current["apparent_temperature"],
        humidity=current["humidity"],
        night_min=today.get("temp_min") if today else None,
    )
    watch["trend"] = heat_rules.hourly_trend(
        weather["hourly"], reference_time=current.get("time")
    )
    watch["observed_at"] = current.get("time")
    watch["wind_speed"] = current.get("wind_speed")
    watch["is_day"] = current.get("is_day")
    watch["today"] = (
        {
            "temp_max": today["temp_max"],
            "temp_min": today["temp_min"],
            "apparent_max": today["apparent_max"],
            "humidity_mean": today.get("humidity_mean"),
            "uv_index_max": today.get("uv_index_max"),
        }
        if today
        else None
    )
    return watch


def _hourly_series(weather, hours=24):
    """The next ``hours`` of apparent temperature, for the page's mini chart."""
    now = str(weather["current"].get("time") or "")
    upcoming = [row for row in weather["hourly"] if str(row["time"]) >= now]
    return [
        {
            "time": row["time"],
            "hour": str(row["time"])[11:16],
            "temperature": round(row["temperature"], 1),
            "apparent_temperature": round(row["apparent_temperature"], 1),
            "humidity": row["humidity"],
        }
        for row in upcoming[:hours]
    ]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/api/health")
def api_health():
    return jsonify(
        {
            "ok": True,
            "service": "Sunscape Metrics",
            "areas": len(config.AREAS),
            "ai": explain.ai_status(),
            "cache": memory_store.cache_stats(),
            "selected_area": memory_store.get_value("selected_area"),
        }
    )


@app.get("/api/areas")
def api_areas():
    return jsonify(
        {
            "ok": True,
            "default": config.DEFAULT_AREA,
            "areas": config.list_areas(),
        }
    )


@app.get("/api/criteria")
def api_criteria():
    """The classification thresholds, exposed so the UI can show its working."""
    return jsonify({"ok": True, "criteria": heat_rules.criteria_reference()})


@app.post("/api/area")
def api_select_area():
    """Remember the user's chosen area in the in-memory store."""
    payload = request.get_json(silent=True) or {}
    area = config.get_area(payload.get("area"))
    if area is None:
        return _fail("Unknown area.", 400, "unknown_area")

    memory_store.set_value("selected_area", area["id"])
    return jsonify({"ok": True, "selected_area": area["id"]})


@app.get("/api/heatwatch")
def api_heatwatch():
    try:
        area = _require_area()
    except ValueError as exc:
        return _fail(str(exc), 400, "invalid_area")

    try:
        weather = open_meteo.get_weather(area["latitude"], area["longitude"])
    except open_meteo.WeatherUnavailable as exc:
        return _fail(str(exc), 503, "weather_unavailable")

    memory_store.set_value("selected_area", area["id"])
    watch = build_heatwatch(weather)

    payload = {
        "ok": True,
        "area": area,
        "observed_at": weather["current"].get("time"),
        "fetched_at": weather["fetched_at"],
        "source": weather["source"],
        "units": weather["units"],
        "watch": watch,
        "hourly": _hourly_series(weather),
    }

    if _wants_ai():
        payload["ai"] = explain.explain_heatwatch(area["name"], watch)

    return jsonify(payload)


@app.get("/api/heatalert")
def api_heatalert():
    try:
        area = _require_area()
        scenario_id = _requested_scenario()
    except ValueError as exc:
        return _fail(str(exc), 400, "invalid_request")

    try:
        weather = open_meteo.get_weather(area["latitude"], area["longitude"])
    except open_meteo.WeatherUnavailable as exc:
        return _fail(str(exc), 503, "weather_unavailable")

    scenario = None
    if scenario_id:
        weather = heat_alert.apply_scenario(weather, scenario_id)
        scenario = {
            "id": scenario_id,
            **{
                key: heat_alert.SCENARIOS[scenario_id][key]
                for key in ("label", "description")
            },
            "simulated": True,
            "warning": (
                "Simulated scenario. The temperature series below is synthetic, "
                "not a live forecast."
            ),
        }

    try:
        assessment = heat_alert.build_assessment(weather)
    except ValueError as exc:
        return _fail(str(exc), 503, "assessment_unavailable")

    memory_store.set_value("selected_area", area["id"])

    payload = {
        "ok": True,
        "area": area,
        "fetched_at": weather["fetched_at"],
        "source": weather["source"],
        "scenario": scenario,
        "scenarios": heat_alert.list_scenarios(),
        "alert": assessment,
    }

    if _wants_ai():
        name = area["name"] if not scenario else f"{area['name']} (simulated)"
        payload["ai"] = explain.explain_heatalert(name, assessment)

    return jsonify(payload)


def _area_summary(area):
    """Compact per-area record used by the map and the comparison table."""
    try:
        weather = open_meteo.get_weather(area["latitude"], area["longitude"])
    except open_meteo.WeatherUnavailable as exc:
        return {"area": area, "ok": False, "message": str(exc)}

    watch = build_heatwatch(weather)
    try:
        assessment = heat_alert.build_assessment(weather)
    except ValueError:
        assessment = None

    summary = {
        "ok": True,
        "area": area,
        "current": {
            "temperature": watch["temperature"],
            "apparent_temperature": watch["apparent_temperature"],
            "humidity": watch["humidity"],
            "level": watch["level"],
            "level_index": watch["level_index"],
            "color": watch["color"],
            "score": watch["score"],
            "trend": watch["trend"]["direction"],
            "trend_arrow": watch["trend"]["arrow"],
        },
    }

    if assessment:
        summary["outlook"] = {
            "trend": assessment["trend"]["direction"],
            "intensity": assessment["intensity"]["level"],
            "persistence_days": assessment["persistence"]["days"],
            "peak_label": assessment["peak"]["label"],
            "peak_apparent": assessment["peak"]["apparent_temperature"],
            "assessment": assessment["assessment"]["label"],
            "alert_active": assessment["alert_active"],
            "confidence": assessment["confidence"],
            "timeline": [
                {"label": day["label"], "level": day["level"], "color": day["color"]}
                for day in assessment["timeline"]
            ],
        }

    return summary


@app.get("/api/heatmap")
def api_heatmap():
    """Every area at once, so the map can be drawn in a single request."""
    areas = config.list_areas()

    # Three independent upstream calls; run them together so the map loads at
    # the speed of the slowest one rather than the sum of all three.
    with ThreadPoolExecutor(max_workers=len(areas)) as pool:
        summaries = list(pool.map(_area_summary, areas))

    ranked = sorted(
        [s for s in summaries if s.get("ok")],
        key=lambda s: -s["current"]["score"],
    )
    for position, summary in enumerate(ranked, start=1):
        summary["rank"] = position

    hottest = ranked[0]["area"]["name"] if ranked else None
    return jsonify(
        {
            "ok": True,
            "areas": summaries,
            "hottest": hottest,
            "legend": heat_rules.criteria_reference()["bands"],
        }
    )


@app.get("/api/context")
def api_context():
    """Urban context for an area: parks, gardens, water and open space."""
    try:
        area = _require_area()
    except ValueError as exc:
        return _fail(str(exc), 400, "invalid_area")

    green = osm.get_green_spaces(
        area["latitude"], area["longitude"], area.get("radius_m")
    )
    return jsonify({"ok": True, "area": area, "green_spaces": green})


# ---------------------------------------------------------------------------
# Development server entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    log.info("Sunscape Metrics starting on http://%s:%s", config.HOST, config.PORT)
    status = explain.ai_status()
    if status.get("available"):
        log.info("AI explanations: Gemini model '%s' ready.", status.get("model"))
    else:
        log.info("AI explanations: using rule-based summaries.")
        log.info("why: %s", status.get("reason"))

    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)