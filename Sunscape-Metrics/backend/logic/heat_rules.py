"""
The heat engine.

Weather variables go in, a heat classification comes out. Every threshold in
this file is a *project-defined classification criterion* for Sunscape
Metrics - they are chosen to suit humid coastal conditions in the Mumbai
Metropolitan Region and are documented here so the classification can be
explained and defended, rather than treated as a black box.

Design notes
------------
* Apparent ("feels-like") temperature is the primary variable. It already
  folds in humidity, wind and radiation, which is exactly what makes urban
  heat dangerous in a coastal city - 35 C at 75% humidity is a very different
  experience from 35 C in dry air.
* Air temperature acts as a hard floor: very high dry-bulb readings escalate
  the band even if the feels-like value lags behind.
* Humidity acts as an escalator, but only near the top of a band. Above 70% RH
  the body's evaporative cooling becomes much less effective, so a hot *and*
  humid day is treated as one band worse. The bar is set deliberately high
  (38 C apparent, 32 C air): humid air at 34 C is an ordinary Mumbai monsoon
  afternoon, and an alert system that fires on those is useless.

Bands (based on apparent temperature)
-------------------------------------
NORMAL      apparent < 32 C      Typical conditions for the region.
ELEVATED    32 - 39.9 C          Noticeable heat stress with exertion.
HIGH        40 - 47.9 C          Heat stress likely for most people.
SEVERE      apparent >= 48 C     Dangerous; sustained exposure unsafe.

Escalation rules
----------------
air temperature >= 40 C            -> at least HIGH
air temperature >= 45 C            -> at least SEVERE
humidity >= 70% and apparent >= 38 C and air >= 32 C -> raise one band
"""

# --- Project-defined classification criteria ----------------------------------

APPARENT_ELEVATED = 32.0
APPARENT_HIGH = 40.0
APPARENT_SEVERE = 48.0

AIR_TEMP_HIGH_FLOOR = 40.0
AIR_TEMP_SEVERE_FLOOR = 45.0

HUMID_HEAT_RH = 70.0
HUMID_HEAT_APPARENT = 38.0
HUMID_HEAT_TEMP = 32.0

# Individual factor trigger points, used to explain *why* a band was assigned.
FACTOR_TEMP = 35.0
FACTOR_APPARENT = 38.0
FACTOR_HUMIDITY = 65.0
FACTOR_WARM_NIGHT = 28.0

LEVELS = ["NORMAL", "ELEVATED", "HIGH", "SEVERE"]

LEVEL_DESCRIPTIONS = {
    "NORMAL": "Conditions are within the usual range for the region.",
    "ELEVATED": "Heat is noticeable and outdoor exertion is more taxing than usual.",
    "HIGH": "Heat stress is likely for most people during the hottest hours.",
    "SEVERE": "Dangerous heat; sustained outdoor exposure is unsafe.",
}

LEVEL_COLORS = {
    "NORMAL": "#3fa796",
    "ELEVATED": "#f2b134",
    "HIGH": "#ef6c35",
    "SEVERE": "#d7263d",
}


def level_index(level):
    """Ordinal rank of a band name (NORMAL = 0 ... SEVERE = 3)."""
    try:
        return LEVELS.index(level)
    except ValueError:
        return 0


def _clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def _raise_band(level, steps=1):
    return LEVELS[min(level_index(level) + steps, len(LEVELS) - 1)]


def _at_least(level, floor):
    return level if level_index(level) >= level_index(floor) else floor


def heat_score(temperature, apparent_temperature, humidity):
    """A 0-100 composite used for map colouring and day-to-day comparison.

    The weights mirror the classification logic: apparent temperature carries
    the most weight, air temperature next, and humidity contributes only once
    it is actually hot (humid air at 24 C is not a heat problem).
    """
    apparent_part = _clamp((apparent_temperature - 26.0) / (50.0 - 26.0))
    temperature_part = _clamp((temperature - 24.0) / (46.0 - 24.0))

    if humidity is None:
        humidity_part = temperature_part * 0.5
    else:
        humidity_load = _clamp((humidity - 40.0) / (90.0 - 40.0))
        heat_gate = _clamp((temperature - 30.0) / 10.0)
        humidity_part = humidity_load * heat_gate

    composite = 0.55 * apparent_part + 0.30 * temperature_part + 0.15 * humidity_part
    return round(composite * 100.0, 1)


def classify(temperature, apparent_temperature=None, humidity=None, night_min=None):
    """Classify a single set of readings into a heat band.

    ``night_min`` is optional; when supplied it is used only to flag warm
    nights as a contributing factor, since a night that does not cool below
    ~28 C removes the body's recovery window.
    """
    if temperature is None:
        raise ValueError("temperature is required to classify heat conditions")

    temperature = float(temperature)
    apparent = (
        float(apparent_temperature)
        if apparent_temperature is not None
        else temperature
    )
    rh = float(humidity) if humidity is not None else None

    # 1. Base band from apparent temperature.
    if apparent >= APPARENT_SEVERE:
        level = "SEVERE"
    elif apparent >= APPARENT_HIGH:
        level = "HIGH"
    elif apparent >= APPARENT_ELEVATED:
        level = "ELEVATED"
    else:
        level = "NORMAL"

    applied_rules = [f"Apparent temperature {apparent:.1f} C -> {level}"]

    # 2. Air-temperature floors.
    if temperature >= AIR_TEMP_SEVERE_FLOOR and level_index(level) < 3:
        level = _at_least(level, "SEVERE")
        applied_rules.append(
            f"Air temperature {temperature:.1f} C is at or above "
            f"{AIR_TEMP_SEVERE_FLOOR:.0f} C -> raised to SEVERE"
        )
    elif temperature >= AIR_TEMP_HIGH_FLOOR and level_index(level) < 2:
        level = _at_least(level, "HIGH")
        applied_rules.append(
            f"Air temperature {temperature:.1f} C is at or above "
            f"{AIR_TEMP_HIGH_FLOOR:.0f} C -> raised to HIGH"
        )

    # 3. Humid-heat escalation.
    humid_heat = (
        rh is not None
        and rh >= HUMID_HEAT_RH
        and apparent >= HUMID_HEAT_APPARENT
        and temperature >= HUMID_HEAT_TEMP
    )
    if humid_heat and level_index(level) < 3:
        level = _raise_band(level)
        applied_rules.append(
            f"Humidity {rh:.0f}% with apparent temperature {apparent:.1f} C "
            f"and air temperature {temperature:.1f} C "
            f"-> raised one band (reduced evaporative cooling)"
        )

    return {
        "level": level,
        "level_index": level_index(level),
        "description": LEVEL_DESCRIPTIONS[level],
        "color": LEVEL_COLORS[level],
        "score": heat_score(temperature, apparent, rh),
        "temperature": round(temperature, 1),
        "apparent_temperature": round(apparent, 1),
        "humidity": round(rh) if rh is not None else None,
        "factors": contributing_factors(temperature, apparent, rh, night_min),
        "applied_rules": applied_rules,
        "humid_heat": humid_heat,
    }


def contributing_factors(
    temperature, apparent_temperature, humidity, night_min=None
):
    """Which variables are actually pushing this reading up.

    Returned in descending importance so the UI and the LLM see the same
    ordering.
    """
    factors = []

    if apparent_temperature >= FACTOR_APPARENT:
        factors.append(
            {
                "code": "apparent_temperature",
                "label": "High apparent temperature",
                "detail": (
                    f"Feels like {apparent_temperature:.0f} C, "
                    f"{apparent_temperature - temperature:+.0f} C against the air "
                    "temperature."
                ),
            }
        )

    if temperature >= FACTOR_TEMP:
        factors.append(
            {
                "code": "temperature",
                "label": "High air temperature",
                "detail": f"Air temperature is {temperature:.0f} C.",
            }
        )

    if humidity is not None and humidity >= FACTOR_HUMIDITY:
        factors.append(
            {
                "code": "humidity",
                "label": "High humidity",
                "detail": (
                    f"Relative humidity is {humidity:.0f}%, which limits cooling "
                    "by sweating."
                ),
            }
        )

    if night_min is not None and night_min >= FACTOR_WARM_NIGHT:
        factors.append(
            {
                "code": "warm_night",
                "label": "Warm overnight minimum",
                "detail": (
                    f"Overnight low of {night_min:.0f} C leaves little recovery "
                    "time before the next hot day."
                ),
            }
        )

    if not factors:
        factors.append(
            {
                "code": "none",
                "label": "No dominant heat factor",
                "detail": "No single variable is currently driving heat stress.",
            }
        )

    return factors


def classify_day(day):
    """Classify one daily record produced by ``data.open_meteo``."""
    result = classify(
        temperature=day["temp_max"],
        apparent_temperature=day.get("apparent_max"),
        humidity=day.get("humidity_mean"),
        night_min=day.get("temp_min"),
    )
    result.update(
        {
            "date": day["date"],
            "offset_days": day.get("offset_days"),
            "is_past": day.get("is_past", False),
            "temp_min": day.get("temp_min"),
        }
    )
    return result


# ---------------------------------------------------------------------------
# Short-term trend from the hourly series
# ---------------------------------------------------------------------------

TREND_THRESHOLD = 0.8  # degrees C of change needed to call a direction


def hourly_trend(hourly_rows, reference_time=None, window_hours=6):
    """Compare the last ``window_hours`` against the ``window_hours`` before.

    Returns a direction plus the numbers behind it, so the UI can show the
    reasoning rather than just an arrow.
    """
    if not hourly_rows:
        return {"direction": "Steady", "arrow": "->", "change": 0.0, "detail": None}

    # Find where "now" sits in the hourly series.
    cutoff = len(hourly_rows)
    if reference_time:
        for index, row in enumerate(hourly_rows):
            if str(row["time"]) > str(reference_time):
                cutoff = index
                break

    recent = hourly_rows[max(0, cutoff - window_hours) : cutoff]
    earlier = hourly_rows[
        max(0, cutoff - 2 * window_hours) : max(0, cutoff - window_hours)
    ]

    if not recent or not earlier:
        return {"direction": "Steady", "arrow": "->", "change": 0.0, "detail": None}

    recent_mean = sum(r["apparent_temperature"] for r in recent) / len(recent)
    earlier_mean = sum(r["apparent_temperature"] for r in earlier) / len(earlier)

    change = recent_mean - earlier_mean

    if change >= TREND_THRESHOLD:
        direction, arrow = "Rising", "^"
    elif change <= -TREND_THRESHOLD:
        direction, arrow = "Falling", "v"
    else:
        direction, arrow = "Steady", "->"

    return {
        "direction": direction,
        "arrow": arrow,
        "change": round(change, 1),
        "detail": (
            f"Apparent temperature averaged {recent_mean:.1f} C over the last "
            f"{len(recent)} hours against {earlier_mean:.1f} C in the "
            f"{len(earlier)} hours before that."
        ),
    }


def criteria_reference():
    """The thresholds, in a form the frontend can display for transparency."""
    return {
        "note": (
            "Project-defined classification criteria for Sunscape Metrics, "
            "tuned for humid coastal conditions in the Mumbai Metropolitan "
            "Region."
        ),
        "bands": [
            {
                "level": "NORMAL",
                "apparent_range": f"below {APPARENT_ELEVATED:.0f} C",
                "color": LEVEL_COLORS["NORMAL"],
                "description": LEVEL_DESCRIPTIONS["NORMAL"],
            },
            {
                "level": "ELEVATED",
                "apparent_range": f"{APPARENT_ELEVATED:.0f} - {APPARENT_HIGH - 0.1:.1f} C",
                "color": LEVEL_COLORS["ELEVATED"],
                "description": LEVEL_DESCRIPTIONS["ELEVATED"],
            },
            {
                "level": "HIGH",
                "apparent_range": f"{APPARENT_HIGH:.0f} - {APPARENT_SEVERE - 0.1:.1f} C",
                "color": LEVEL_COLORS["HIGH"],
                "description": LEVEL_DESCRIPTIONS["HIGH"],
            },
            {
                "level": "SEVERE",
                "apparent_range": f"{APPARENT_SEVERE:.0f} C and above",
                "color": LEVEL_COLORS["SEVERE"],
                "description": LEVEL_DESCRIPTIONS["SEVERE"],
            },
        ],
        "escalations": [
            f"Air temperature >= {AIR_TEMP_HIGH_FLOOR:.0f} C is classified at least HIGH.",
            f"Air temperature >= {AIR_TEMP_SEVERE_FLOOR:.0f} C is classified SEVERE.",
            (
                f"Humidity >= {HUMID_HEAT_RH:.0f}% with apparent temperature >= "
                f"{HUMID_HEAT_APPARENT:.0f} C and air temperature >= "
                f"{HUMID_HEAT_TEMP:.0f} C raises the band by one step."
            ),
        ],
    }