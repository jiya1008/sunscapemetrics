"""
HeatAlert - the forward-looking intelligence layer.

HeatWatch answers "what is it like right now". This module answers the harder
question: *is a significant heat period developing?*

The deliberate design choice here is that the output is not a single
probability number. A heat event has a shape, and the assessment describes
that shape with four components:

    1. Trend      - is the recent baseline moving up or down?
    2. Intensity  - how hot does it get at the worst point?
    3. Persistence- how many consecutive days stay elevated or worse?
    4. Peak       - when is the worst day expected?

Those four, plus the contributing factors, are what get handed to the LLM. The
LLM never sees raw weather and never does arithmetic.
"""

import copy
import math

from logic import heat_rules

# --- Project-defined alert criteria -----------------------------------------

BASELINE_DAYS = 3           # recent observed days used as the trend baseline
COMPARISON_DAYS = 3         # forecast days compared against that baseline
TREND_THRESHOLD = 1.0       # deg C of change needed to call Rising / Falling
ALERT_MIN_PERSISTENCE = 2   # consecutive elevated days before a run counts
SUSTAINED_RUN_DAYS = 3      # length of an ELEVATED run that counts on its own
SUSTAINED_RISE = 2.0        # deg C rise that makes such a run worth flagging

ASSESSMENTS = {
    "SEVERE_HEAT_EVENT": "SEVERE HEAT EVENT",
    "SIGNIFICANT_HEAT_PERIOD": "SIGNIFICANT HEAT PERIOD",
    "DEVELOPING_HEAT_CONDITIONS": "DEVELOPING HEAT CONDITIONS",
    "NO_SIGNIFICANT_HEAT": "NO SIGNIFICANT HEAT EVENT",
}

# The banner colour tracks the *verdict*, not the peak intensity. A quiet
# verdict must not be painted in alarm colours just because one afternoon in
# the window happens to touch the ELEVATED band.
ASSESSMENT_COLORS = {
    "SEVERE_HEAT_EVENT": heat_rules.LEVEL_COLORS["SEVERE"],
    "SIGNIFICANT_HEAT_PERIOD": heat_rules.LEVEL_COLORS["HIGH"],
    "DEVELOPING_HEAT_CONDITIONS": heat_rules.LEVEL_COLORS["ELEVATED"],
    "NO_SIGNIFICANT_HEAT": heat_rules.LEVEL_COLORS["NORMAL"],
}

def _mean(values):
    clean = [v for v in values if v is not None]
    if not clean:
        return None
    return sum(clean) / len(clean)

def day_label(offset):
    """Human label for a day offset: 0 = Today, 1 = Tomorrow, n = Day n."""
    if offset == 0:
        return "Today"
    if offset == 1:
        return "Tomorrow"
    if offset < 0:
        return f"{row['abs(offset)']day{'s' if abs(offset) > 1 else ''} ago" # handled in display or logic below
    return f"Day {offset}"

def _split_days(daily_rows):
    past = [row for row in daily_rows if row.get("offset_days", 0) < 0]
    upcoming = [row for row in daily_rows if row.get("offset_days", 0) >= 0]
    return past, upcoming

# ---------------------------------------------------------------------------
# # 1. Trend
# ---------------------------------------------------------------------------

def assess_trend(past_days, forecast_days):
    """Compare the recent observed baseline against the coming days.

    Falls back to a within-forecast comparison when Open-Meteo returned no
    past days, so the trend is always defined.
    """
    baseline_rows = past_days[-BASELINE_DAYS:]
    comparison_rows = forecast_days[:COMPARISON_DAYS]

    baseline = _mean([row["apparent_max"] for row in baseline_rows])
    comparison = _mean([row["apparent_max"] for row in comparison_rows])
    basis = "recent observed days vs the coming days"

    if baseline is None or comparison is None:
        # No observed history available - compare the first half of the
        # forecast against the second half instead.
        values = [row["apparent_max"] for row in forecast_days]
        if len(values) < 4:
            return {
                "direction": "Steady",
                "arrow": "->",
                "change": 0.0,
                "baseline": None,
                "comparison": None,
                "basis": "insufficient data",
                "detail": "Not enough data to establish a trend.",
            }
        half = len(values) // 2
        baseline = _mean(values[:half])
        comparison = _mean(values[half:])
        basis = "first half vs second half of the forecast window"

    change = comparison - baseline

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
        "baseline": round(baseline, 1),
        "comparison": round(comparison, 1),
        "basis": basis,
        "detail": (
            f"Average apparent temperature moves from {baseline:.1f} C to "
            f"{comparison:.1f} C ({change:+.1f} C), comparing {basis}."
        ),
    }

# ---------------------------------------------------------------------------
# # 2. Intensity and 4. Peak
# ---------------------------------------------------------------------------

def assess_intensity(classified_days):
    """Highest band reached anywhere in the forecast window."""
    peak = max(classified_days, key=lambda day: (day["level_index"], day["score"]))
    return {
        "level": peak["level"],
        "level_index": peak["level_index"],
        "color": peak["color"],
        "description": heat_rules.LEVEL_DESCRIPTIONS[peak["level"]],
        "peak_apparent": peak["apparent_temperature"],
        "peak_temperature": peak["temperature"],
        "peak_score": peak["score"],
    }

def find_peak(classified_days):
    peak = max(classified_days, key=lambda day: (day["score"], day["apparent_temperature"]))
    return {
        "date": peak["date"],
        "offset_days": peak["offset_days"],
        "label": day_label(peak["offset_days"]),
        "level": peak["level"],
        "temperature": peak["temperature"],
        "apparent_temperature": peak["apparent_temperature"],
        "humidity": peak["humidity"],
    }

# ---------------------------------------------------------------------------
# # 3. Persistence
# ---------------------------------------------------------------------------

def assess_persistence(classified_days):
    """Longest unbroken run of ELEVATED-or-worse days in the window."""
    best = {"length": 0, "start": None, "end": None, "peak_level": "NORMAL"}
    current = None

    for day in classified_days:
        if day["level_index"] >= 1:
            if current is None:
                current = {
                    "length": 0,
                    "start": day,
                    "end": day,
                    "peak_index": 0,
                }
            current["length"] += 1
            current["end"] = day
            current["peak_index"] = max(current["peak_index"], day["level_index"])
            if current["length"] > best["length"]:
                best = {
                    "length": current["length"],
                    "start": current["start"],
                    "end": current["end"],
                    "peak_level": heat_rules.LEVELS[current["peak_index"]],
                }
        else:
            current = None

    elevated_total = sum(1 for day in classified_days if day["level_index"] >= 1)

    if best["length"] == 0:
        return {
            "days": 0,
            "start_date": None,
            "end_date": None,
            "start_label": None,
            "end_label": None,
            "peak_level": "NORMAL",
            "elevated_day_count": elevated_total,
            "detail": "No consecutive elevated days in the forecast window.",
        }

    start, end = best["start"], best["end"]
    return {
        "days": best["length"],
        "start_date": start["date"],
        "end_date": end["date"],
        "start_label": day_label(start["offset_days"]),
        "end_label": day_label(end["offset_days"]),
        "peak_level": best["peak_level"],
        "elevated_day_count": elevated_total,
        "detail": (
            f"{best['length']} consecutive day"
            f"{'s' if best['length'] > 1 else ''} at {heat_rules.LEVELS[1]} or "
            f"above, from {day_label(start['offset_days'])} to "
            f"{day_label(end['offset_days'])}."
        ),
    }

# ---------------------------------------------------------------------------
# # Contributing factors across the whole window
# ---------------------------------------------------------------------------

def window_factors(classified_days, trend, persistence, intensity):
    factors = []

    if trend["direction"] == "Rising":
        factors.append(
            {
                "code": "trend",
                "label": "Rising temperature",
                "detail": trend["detail"],
            }
        )

    if intensity["peak_apparent"] >= heat_rules.FACTOR_APPARENT:
        factors.append(
            {
                "code": "apparent_temperature",
                "label": "High apparent temperature",
                "detail": (
                    f"Apparent temperature peaks at "
                    f"{intensity['peak_apparent']:.0f} C during the window."
                ),
            }
        )

    humid_days = [
        day
        for day in classified_days
        if day["humidity"] is not None and day["humidity"] >= heat_rules.FACTOR_HUMIDITY
    ]
    if humid_days:
        mean_rh = _mean([day["humidity"] for day in humid_days])
        factors.append(
            {
                "code": "humidity",
                "label": "High humidity",
                "detail": (
                    f"{len(humid_days)} of {len(classified_days)} days average "
                    f"around {mean_rh:.0f}% relative humidity, which suppresses "
                    "cooling by sweating."
                ),
            }
        )

    if persistence["days"] >= ALERT_MIN_PERSISTENCE:
        factors.append(
            {
                "code": "persistence",
                "label": "Persistent elevated conditions",
                "detail": persistence["detail"],
            }
        )

    warm_nights = [
        day
        for day in classified_days
        if day.get("temp_min") is not None
        and day["temp_min"] >= heat_rules.FACTOR_WARM_NIGHT
    ]
    if warm_nights:
        factors.append(
            {
                "code": "warm_night",
                "label": "Warm nights",
                "detail": (
                    f"{len(warm_nights)} night(s) stay at or above "
                    f"{heat_rules.FACTOR_WARM_NIGHT:.0f} C, limiting overnight "
                    "recovery."
                ),
            }
        )

    if not factors:
        factors.append(
            {
                "code": "none",
                "label": "No significant heat drivers",
                "detail": "No variable in the forecast window meets an alert criterion.",
            }
        )

    return factors

# ---------------------------------------------------------------------------
# # Overall assessment
# ---------------------------------------------------------------------------

def overall_assessment(trend, intensity, persistence):
    """Combine the four components into one verdict.

    These combinations are project-defined alert criteria and are shown to the
    user alongside the result.

    Note the deliberate asymmetry: reaching HIGH matters on its own, but a run
    of merely ELEVATED days does not raise an alert unless it is *also* long
    and clearly rising. ELEVATED is a normal state for much of the year in the
    MMR, and an early-warning system that fires every humid week trains people
    to ignore it.
    """
    level = intensity["level_index"]
    days = persistence["days"]
    rising = trend["direction"] == "Rising"

    if level >= 3 and days >= ALERT_MIN_PERSISTENCE:
        key = "SEVERE_HEAT_EVENT"
        reason = f"SEVERE intensity sustained across {days} consecutive days."
    elif level >= 3:
        key = "SIGNIFICANT_HEAT_PERIOD"
        reason = "SEVERE intensity reached, though not yet sustained."
    elif level >= 2 and days >= SUSTAINED_RUN_DAYS:
        key = "SIGNIFICANT_HEAT_PERIOD"
        reason = f"HIGH intensity sustained across {days} consecutive days."
    elif level >= 2:
        key = "DEVELOPING_HEAT_CONDITIONS"
        reason = (
            f"HIGH intensity expected in the window, over {days} consecutive "
            f"elevated day(s)."
            if days
            else "HIGH intensity expected in the window."
        )
    elif days >= SUSTAINED_RUN_DAYS and rising and trend["change"] >= SUSTAINED_RISE:
        key = "DEVELOPING_HEAT_CONDITIONS"
        reason = (
            f"Elevated conditions persist {days} consecutive days on a rising "
            f"trend ({trend['change']:+.1f} C)."
        )
    else:
        key = "NO_SIGNIFICANT_HEAT"
        reason = (
            f"Conditions reach {intensity['level']} at most"
            + (
                f", across {days} consecutive elevated day(s), "
                "which does not meet the alert criteria."
                if days
                else ", which does not meet the alert criteria."
            )
        )

    alert_active = key in ("SEVERE_HEAT_EVENT", "SIGNIFICANT_HEAT_PERIOD")
    return {
        "key": key,
        "label": ASSESSMENTS[key],
        "reason": reason,
        "alert_active": alert_active,
        "color": ASSESSMENT_COLORS[key],
    }

def rule_confidence(intensity, persistence, trend):
    """A 0-1 confidence in the assessment.

    This is a logistic transform of the same rule signals shown to the user -
    it is *not* a trained machine-learning model, and is labelled as
    rule-based wherever it is displayed. It exists so that borderline cases
    read as borderline instead of as hard verdicts.
    """
    z = (
        0.07 * (intensity["peak_score"] - 52.0)
        + 0.45 * (persistence["days"] - 2)
        + 0.30 * trend["change"]
        + 0.55 * (intensity["level_index"] - 1)
    )
    value = 1.0 / (1.0 + math.exp(-max(-20.0, min(20.0, z))))
    return round(value, 2)

# ---------------------------------------------------------------------------
# # Entry point
# ---------------------------------------------------------------------------

# Demonstration scenarios
#
# The MMR is only at genuine heat-wave risk for part of the year, and the
# assessment above is deliberately quiet outside that window. These scenarios
# replace the temperature series with a pre-monsoon pattern so the alert path
# can be demonstrated at any time of year.
#
# They are SYNTHETIC. Every response built from one carries a ``scenario`` block,
# and the UI shows a standing banner, so a simulated run can never be mistaken
# for a live reading.

SCENARIOS = {
    "building": {
        "label": "Building heat period",
        "description": (
            "A typical pre-monsoon build-up: temperatures climbing steadily "
            "into the HIGH band and holding there for several days."
        ),
        # (temp_max, apparent_max, mean_humidity)
        "past": [(33, 35, 52), (34, 37, 55), (35, 38, 58)],
        "forecast": [(37, 41, 58), (38, 42, 60), (39, 43, 62), (37, 41, 60), (35, 38, 58)],
    },
    "severe": {
        "label": "Severe heat event",
        "description": (
            "An extreme pre-monsoon event: apparent temperature crossing the "
            "SEVERE threshold at the peak of a sustained hot spell."
        ),
        "past": [(36, 39, 52), (37, 41, 55), (38, 43, 58)],
        "forecast": [(39, 44, 60), (41, 47, 63), (42, 49, 66), (41, 47, 64), (39, 44, 60)],
    },
}

def list_scenarios():
    return [
        {"id": key, "label": value["label"], "description": value["description"]}
        for key, value in SCENARIOS.items()
    ]

def apply_scenario(weather, scenario_id):
    """Return a copy of ``weather`` with a synthetic temperature series.

    Dates, day offsets and every other field are left untouched, so the
    scenario runs through exactly the same code path as live data.
    """
    scenario = SCENARIOS.get(scenario_id)
    if scenario is None:
        raise ValueError(f"Unknown scenario '{scenario_id}'.")

    simulated = copy.deepcopy(weather)
    past, upcoming = _split_days(simulated["daily"])

    def overwrite(rows, ramp):
        for row, (temp_max, apparent_max, humidity) in zip(rows, ramp):
            row["temp_max"] = float(temp_max)
            row["temp_min"] = float(temp_max) - 8.0
            row["apparent_max"] = float(apparent_max)
            row["apparent_min"] = float(apparent_max) - 9.0
            row["humidity_mean"] = float(humidity)
            row["humidity_max"] = float(humidity) + 8.0
            row["precipitation"] = 0.0

    overwrite(past[-len(scenario["past"]):], scenario["past"])
    overwrite(upcoming, scenario["forecast"])

    # Only the days the scenario actually defines can be assessed.
    keep = {row["date"] for row in past + upcoming[: len(scenario["forecast"])]}
    simulated["daily"] = [row for row in simulated["daily"] if row["date"] in keep]

    return simulated

def build_assessment(weather, window_days=5):
    """Produce the full heat event assessment from cleaned weather data."""
    past_days, upcoming = _split_days(weather["daily"])
    forecast_window = upcoming[:window_days]

    if not forecast_window:
        raise ValueError("No forecast days available to assess.")

    classified_days = [heat_rules.classify_day(day) for day in forecast_window]
    for day in classified_days:
        day["label"] = day_label(day["offset_days"])

    trend = assess_trend(past_days, forecast_window)
    intensity = assess_intensity(classified_days)
    persistence = assess_persistence(classified_days)
    peak = find_peak(classified_days)
    factors = window_factors(classified_days, trend, persistence, intensity)
    assessment = overall_assessment(trend, intensity, persistence)

    timeline = [
        {
            "date": day["date"],
            "label": day["label"],
            "offset_days": day["offset_days"],
            "level": day["level"],
            "level_index": day["level_index"],
            "color": day["color"],
            "score": day["score"],
            "temp_max": day["temperature"],
            "temp_min": day["temp_min"],
            "apparent_max": day["apparent_temperature"],
            "humidity": day["humidity"],
            "is_peak": day["date"] == peak["date"],
        }
        for day in classified_days
    ]

    recent = [
        {
            "date": day["date"],
            "label": day_label(day["offset_days"]),
            "temp_max": day["temp_max"],
            "apparent_max": day["apparent_max"],
            "humidity": day.get("humidity_mean"),
        }
        for day in past_days[-BASELINE_DAYS:]
    ]

    return {
        "window_days": len(forecast_window),
        "trend": trend,
        "intensity": intensity,
        "persistence": persistence,
        "peak": peak,
        "factors": factors,
        "assessment": assessment,
        "confidence": rule_confidence(intensity, persistence, trend),
        "confidence_basis": "rule-based (logistic transform of the rule signals)",
        "timeline": timeline,
        "recent_baseline": recent,
        "criteria": {
            "trend_threshold_c": TREND_THRESHOLD,
            "min_persistence_days": ALERT_MIN_PERSISTENCE,
            "baseline_days": BASELINE_DAYS,
        },
    }