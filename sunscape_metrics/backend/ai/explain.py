"""
The interpretation layer.

Google Gemini (free tier) turns the structured result the backend already
computed into plain language. It is called over plain HTTPS with `requests`,
so there is no extra SDK to install.

The single rule this module enforces is that the model **interprets, it does
not decide**. It is given only the finished assessment (trend, intensity,
persistence, peak, factors) and is told explicitly not to introduce numbers,
forecasts or advice that are not in that payload.

If Gemini is not configured, unreachable, or returns something unusable, a
deterministic template explanation built from the same structured fields is
returned instead - so the site always works.

===================================================================
UNFINISHED ON PURPOSE - three small manual steps
===================================================================
The Gemini call is scaffolded but NOT connected. Everything around it (the
prompt, response parsing, validation, caching, error handling and fallback)
is written and tested. Three short edits finish it:

    MANUAL STEP 1    backend/.env            paste your free API key
    MANUAL STEP 2    this file               fill in GEMINI_ENDPOINT     (below)
    MANUAL STEP 3    this file               send the request            (below)

Until then the site runs normally and shows the rule-based summary, and
/api/health says exactly what is still missing.

See the "Finish the Gemini hookup" section of README.md - it has the exact
lines to paste.
===================================================================
"""

import json

import requests

import config
from store import memory_store

SYSTEM_PROMPT = """You are the explanation layer of Sunscape Metrics, a heat \
early-warning tool for the Mumbai Metropolitan Region.

You receive a heat assessment that has ALREADY been calculated from real \
weather data. Your only job is to explain it in plain language.

Hard rules:
- Use ONLY the values in the supplied JSON. Never invent or estimate a number, \
date, temperature or statistic that is not present.
- Never contradict the supplied trend, intensity, persistence or assessment.
- Do not give medical advice. General heat-safety awareness only.
- Write for an ordinary resident, not a meteorologist. No jargon.
- Each answer is 1-2 short sentences. Be specific, not dramatic.

Reply with JSON only, in exactly this shape:
{"what": "...", "why": "...", "expected": "...", "advice": "..."}

"what"   - what is happening with heat right now or in the window.
"why"    - which supplied factors are driving it.
"expected" - what the assessment says comes next.
"advice" - what the reader should keep in mind.
"""

REQUIRED_KEYS = ("what", "why", "expected", "advice")


# ===================================================================
# MANUAL STEP 2 of 3 - the Gemini endpoint
# ===================================================================
# Gemini's "generate a reply" endpoint is built from three pieces:
#
#    /  :generateContent
#
# Both pieces already exist in config.py as config.GEMINI_URL and
# config.GEMINI_MODEL. Replace the None below with an f-string that joins
# them into that shape.
#
# Leave it as None and the app still runs - it just uses the rule-based
# summary instead.
# ===================================================================

GEMINI_ENDPOINT = None


def _is_wired():
    """True once MANUAL STEP 2 has been completed."""
    return bool(GEMINI_ENDPOINT)


# ===================================================================
# Availability - what /api/health and the UI report
# ===================================================================


def ai_status():
    """Report whether Gemini is configured and usable, and if not, why."""
    if not config.AI_ENABLED:
        return {
            "available": False,
            "provider": "none",
            "reason": "AI explanations are disabled (SUNSCAPE_AI_ENABLED=false).",
        }

    if not config.GEMINI_API_KEY:
        return {
            "available": False,
            "provider": "gemini",
            "setup_step": 1,
            "reason": (
                "MANUAL STEP 1 not done: no GEMINI_API_KEY in backend/.env. "
                "Get a free key at https://aistudio.google.com/apikey"
            ),
        }

    if not _is_wired():
        return {
            "available": False,
            "provider": "gemini",
            "setup_step": 2,
            "reason": (
                "MANUAL STEPS 2-3 not done: the Gemini call is not connected "
                "yet. See the TODO blocks in backend/ai/explain.py and the "
                "'Finish the Gemini hookup' section of README.md."
            ),
        }

    # Key present and code wired - check the key and the network actually work.
    # A models listing is the cheapest way to prove both without spending a
    # generation call.
    try:
        response = requests.get(
            config.GEMINI_URL,
            headers={"x-goog-api-key": config.GEMINI_API_KEY},
            timeout=config.GEMINI_TIMEOUT,
        )
    except requests.RequestException as exc:
        return {
            "available": False,
            "provider": "gemini",
            "model": config.GEMINI_MODEL,
            "reason": f"Could not reach the Gemini API ({exc.__class__.__name__}).",
        }

    if response.status_code == 200:
        try:
            names = [
                str(entry.get("name", "")).removeprefix("models/")
                for entry in response.json().get("models") or []
            ]
        except ValueError:
            # A 200 that is not JSON means something intercepted the request -
            # a captive portal or a corporate content filter, typically.
            return {
                "available": False,
                "provider": "gemini",
                "model": config.GEMINI_MODEL,
                "reason": (
                    "The Gemini endpoint returned a non-JSON page. This network "
                    "is intercepting it (corporate proxy or content filter). "
                    "Try a different network."
                ),
            }
        wanted = config.GEMINI_MODEL
        installed = not names or any(name == wanted for name in names)
        return {
            "available": installed,
            "provider": "gemini",
            "model": wanted,
            "reason": None,
        } if installed else (
            f"Model '{wanted}' is not available to this key. "
            "Set GEMINI_MODEL in backend/.env to one that is."
        )

    hints = {
        400: "The request was rejected - check GEMINI_MODEL.",
        401: "The API key was not accepted.",
        403: "The API key was rejected or lacks permission.",
        429: "Free-tier rate limit reached. Wait a minute and retry.",
    }
    return {
        "available": False,
        "provider": "gemini",
        "model": config.GEMINI_MODEL,
        "reason": (
            f"Gemini returned HTTP {response.status_code}. "
            + hints.get(response.status_code, "")
        ).strip(),
    }


# ===================================================================
# Prompt payloads - the only data the model ever sees
# ===================================================================


def _watch_payload(area_name, watch):
    return {
        "view": "current conditions",
        "area": area_name,
        "temperature_c": watch["temperature"],
        "feels_like_c": watch["apparent_temperature"],
        "humidity percent": watch["humidity"],
        "heat_condition": watch["level"],
        "trend": watch["trend"]["direction"],
        "factors": [factor["label"] for factor in watch["factors"]],
        "factor_details": [factor["detail"] for factor in watch["factors"]],
    }


def _alert_payload(area_name, alert):
    return {
        "view": "developing heat period",
        "area": area_name,
        "trend": alert["trend"]["direction"],
        "trend_change_c": alert["trend"]["change"],
        "intensity": alert["intensity"]["level"],
        "peak_feels_like_c": alert["intensity"]["peak_apparent"],
        "persistence_days": alert["persistence"]["days"],
        "peak_day": alert["peak"]["label"],
        "overall_assessment": alert["assessment"]["label"],
        "assessment_reason": alert["assessment"]["reason"],
        "factors": [factor["label"] for factor in alert["factors"]],
        "factor_details": [factor["detail"] for factor in alert["factors"]],
        "daily_outlook": [
            {
                "day": day["label"],
                "condition": day["level"],
                "feels_like_c": day["apparent_max"],
            }
            for day in alert["timeline"]
        ],
    }


def _user_prompt(payload):
    return "Explain this heat assessment.\n\n" + json.dumps(payload, indent=2)


# ===================================================================
# Reading the model's reply
# ===================================================================


def _parse(content):
    """Pull the JSON object out of a model reply and validate its shape."""
    if not content:
        return None
    text = content.strip()

    # Models occasionally wrap JSON in prose or a code fence.
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return None

    try:
        parsed = json.loads(text[start : end + 1])
    except ValueError:
        return None

    if not isinstance(parsed, dict):
        return None

    result = {}
    for key in REQUIRED_KEYS:
        value = parsed.get(key)
        if not isinstance(value, str) or not value.strip():
            return None
        result[key] = " ".join(value.split())[:400]
    return result


def _read_reply(data):
    """Extract the generated text from a Gemini generateContent response."""
    candidates = data.get("candidates") or []
    if not candidates:
        # Usually means the reply was blocked by a safety filter.
        return None
    parts = ((candidates[0].get("content") or {}).get("parts")) or []
    return "".join(str(part.get("text", "")) for part in parts)


# ===================================================================
# The Gemini call
# ===================================================================


def _ask_gemini(payload):
    """Send the assessment to Gemini and return the parsed explanation.

    Returns None on any problem at all; the caller then uses the rule-based
    fallback. Never raises - a broken AI layer must not break the site.
    """
    if not config.AI_ENABLED or not config.GEMINI_API_KEY or not _is_wired():
        return None

    url = GEMINI_ENDPOINT
    headers = {
        "x-goog-api-key": config.GEMINI_API_KEY,
        "Content-Type": "application/json",
    }
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": _user_prompt(payload)}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 600,
            # Ask Gemini for JSON rather than prose, so _parse has an easy job.
            "responseMimeType": "application/json",
        },
    }

    try:
        # ===================================================================
        # MANUAL STEP 3 of 3 - actually send the request
        # ===================================================================
        # Everything needed is prepared above: `url`, `headers` and `body`.
        # Replace the None below with a requests.post(...) call that sends
        # `body` as JSON to `url` with those `headers`, timing out after
        # config.GEMINI_TIMEOUT seconds.
        #
        # requests can serialise a dict for you - look up its `json=`
        # argument rather than using json.dumps.
        #
        # Leave it as None and the app still runs on the rule-based summary.
        # ===================================================================

        response = requests.post(
            url,
            headers=headers,
            json=body,
            timeout=config.GEMINI_TIMEOUT
        )
    except (requests.RequestException, ValueError):
        return None

    if response is None:
        return None
    if response.status_code != 200:
        return None
    try:
        data = response.json()
    except (requests.RequestException, ValueError):
        return None

    return _parse(_read_reply(data))


# ===================================================================
# Deterministic fallback - same facts, no model
# ===================================================================


def _join(labels):
    labels = [label.lower() for label in labels if label]
    if not labels:
        return "no single dominant factor"
    if len(labels) == 1:
        return labels[0]
    return ", ".join(labels[:-1]) + " and " + labels[-1]


def _fallback_watch(area_name, watch):
    trend = watch["trend"]["direction"].lower()
    return {
        "what": (
            f"Heat conditions in {area_name} are currently {watch['level'].lower()}, "
            f"with a {trend} short-term trend."
        ),
        "why": (
            f"It is {watch['temperature']:.0f} C but feels like "
            f"{watch['apparent_temperature']:.0f} C"
            + (
                f" at {watch['humidity']:.0f}% humidity."
                if watch["humidity"] is not None
                else "."
            )
            + f" The main contributors are {_join([f['label'] for f in watch['factors']])}."
        ),
        "expected": (
            f"Apparent temperature has been "
            f"{trend} over the last few hours"
            + (
                f" ({watch['trend']['change']:+.1f} C)."
                if watch["trend"].get("change") is not None
                else "."
            )
        ),
        "advice": (
            "Nothing unusual to plan around right now."
            if watch["level_index"] == 0
            else (
                "Limit strenuous activity during the hottest hours, stay hydrated, "
                "and check on anyone more exposed to heat."
            )
        ),
    }


def _fallback_alert(area_name, alert):
    persistence = alert["persistence"]["days"]
    return {
        "what": (
            f"{area_name}: {alert['assessment']['label'].lower().capitalize()}. "
            f"The heat trend is {alert['trend']['direction'].lower()} and expected "
            f"intensity is {alert['intensity']['level'].lower()}."
        ),
        "why": (
            f"{alert['trend']['detail']} The contributing factors are "
            f"{_join([f['label'] for f in alert['factors']])}."
        ),
        "expected": (
            f"Elevated or worse conditions are expected to hold for about "
            f"{persistence} day{'s' if persistence > 1 else ''}, peaking "
            f"{alert['peak']['label'].lower()} at around "
            f"{alert['peak']['apparent_temperature']:.0f} C feels-like."
            if persistence
            else "No sustained elevated period is expected in the coming days."
        ),
        "advice": (
            "No particular heat precautions are needed beyond the usual."
            if not alert["assessment"]["alert_active"]
            else (
                "Plan outdoor work and travel for the early morning or evening "
                "across this period, keep water available, and follow local "
                "heat-safety guidance."
            )
        ),
    }


# ===================================================================
# Public API
# ===================================================================


def _explain(payload, fallback, cache_key):
    cached = memory_store.cache_get(cache_key)
    if cached:
        return cached

    result = _ask_gemini(payload)

    if result:
        explanation = {
            **result,
            "generated_by": f"Google Gemini ({config.GEMINI_MODEL})",
            "provider": "gemini",
            "is_fallback": False,
        }
    else:
        explanation = {
            **fallback,
            "generated_by": "Sunscape rule-based summary",
            "provider": "rules",
            "is_fallback": True,
            # User-facing: plain and undramatic. The diagnostic detail (which
            # setup step is outstanding, which HTTP error came back) belongs in
            # /api/health, not on the page a visitor is reading.
            "note": (
                "Generated directly from the computed assessment. "
                "See /api/health for the AI layer's status."
            ),
        }

    return memory_store.cache_set(cache_key, explanation, config.AI_CACHE_TTL)


def explain_heatwatch(area_name, watch):
    """Interpret a HeatWatch result."""
    payload = _watch_payload(area_name, watch)
    cache_key = (
        f"ai:watch:{area_name}:{watch['level']}:{watch['temperature']}:"
        f"{watch['trend']['direction']}:{_is_wired()}"
    )
    return _explain(payload, _fallback_watch(area_name, watch), cache_key)


def explain_heatalert(area_name, alert):
    """Interpret a HeatAlert assessment."""
    payload = _alert_payload(area_name, alert)
    cache_key = (
        f"ai:alert:{area_name}:{alert['assessment']['key']}:"
        f"{alert['intensity']['level']}:{alert['persistence']['days']}:"
        f"{alert['trend']['direction']}:{alert['peak']['date']}:{_is_wired()}"
    )
    return _explain(payload, _fallback_alert(area_name, alert), cache_key)