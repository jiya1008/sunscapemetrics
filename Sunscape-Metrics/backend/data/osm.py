"""
OpenStreetMap client (Overpass API).

Single responsibility: geographic/urban context. HeatMap uses this to show
*where the shade is* - parks, gardens, forests, water bodies and other open
public space near each area centre.

This is deliberately supporting context, not a feature of its own. Overpass is
a shared community service that can be slow or busy, so every failure path
degrades to "no urban context available" instead of breaking the page.
"""

import requests

import config
from store import memory_store

# OSM tags treated as cooling/open urban space, mapped to a display category.
GREEN_TAGS = [
    ("leisure", "park", "Park"),
    ("leisure", "garden", "Garden"),
    ("leisure", "nature_reserve", "Nature reserve"),
    ("leisure", "pitch", "Sports ground"),
    ("landuse", "forest", "Forest"),
    ("landuse", "grass", "Open grassland"),
    ("landuse", "recreation_ground", "Recreation ground"),
    ("natural", "wood", "Woodland"),
    ("natural", "water", "Water body"),
]

MAX_FEATURES = 120

class OSMUnavailable(RuntimeError):
    """Raised when Overpass could not be queried."""

def _build_query(latitude, longitude, radius_m):
    """Compose an Overpass QL query for green/open space around a point."""
    clauses = []
    for key, value, _label in GREEN_TAGS:
        selector = f'"{key}"="{value}"'
        around = f"(around:{radius_m},{latitude},{longitude})"
        clauses.append(f" way{selector}{around};")
        clauses.append(f" relation{selector}{around};")

    body = "\n".join(clauses)
    return f"[out:json][timeout:{config.OSM_TIMEOUT}];\n(\n{body}\n);\nout center tags;"

def _categorise(tags):
    for key, value, label in GREEN_TAGS:
        if tags.get(key) == value:
            return label
    return "Open space"

def _clean_elements(elements):
    features = []
    seen = set()

    for element in elements:
        tags = element.get("tags") or {}
        centre = element.get("center") or {}
        latitude = centre.get("lat")
        longitude = centre.get("lon")
        if latitude is None or longitude is None:
            continue

        name = tags.get("name") or tags.get("official_name")
        category = _categorise(tags)

        # Unnamed fragments are common in OSM; keep them out of the list so
        # the panel stays readable, but still count them in the totals.
        key = (name or "", round(latitude, 4), round(longitude, 4))
        if key in seen:
            continue
        seen.add(key)

        features.append(
            {
                "name": name,
                "category": category,
                "latitude": round(float(latitude), 5),
                "longitude": round(float(longitude), 5),
                "named": bool(name),
            }
        )

        if len(features) >= MAX_FEATURES:
            break

    return features

def _summarise(features):
    by_category = {}
    for feature in features:
        by_category[feature["category"]] = by_category.get(feature["category"], 0) + 1

    named = [f for f in features if f["named"]]
    return {
        "total": len(features),
        "named_total": len(named),
        "by_category": dict(
            sorted(by_category.items(), key=lambda item: -item[1])
        ),
    }

def get_green_spaces(latitude, longitude, radius_m=None, use_cache=True):
    """Return open/green public space near a coordinate pair.

    The result always has the same shape. When Overpass is unreachable the
    ``available`` flag is ``False`` and ``features`` is empty, so callers never
    have to special-case a missing upstream service.
    """
    radius_m = int(radius_m or 6000)
    cache_key = (
        f"osm:{round(float(latitude), 3)}:{round(float(longitude), 3)}:{radius_m}"
    )

    if use_cache:
        cached = memory_store.cache_get(cache_key)
        if cached:
            return cached

    query = _build_query(round(float(latitude), 4), round(float(longitude), 4), radius_m)

    try:
        response = requests.post(
            config.OVERPASS_URL,
            data={"data": query},
            timeout=config.OSM_TIMEOUT,
            headers={"User-Agent": "SunscapeMetrics/1.0 (student prototype)"},
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        # Degrade quietly: urban context is a nice-to-have on the map.
        return {
            "available": False,
            "source": "OpenStreetMap / Overpass",
            "radius_m": radius_m,
            "features": [],
            "summary": {"total": 0, "named_total": 0, "by_category": {}},
            "note": f"Urban context unavailable ({exc.__class__.__name__}).",
        }

    features = _clean_elements(payload.get("elements") or [])
    result = {
        "available": True,
        "source": "OpenStreetMap / Overpass",
        "radius_m": radius_m,
        "features": features,
        "summary": _summarise(features),
        "note": None,
    }

    return memory_store.cache_set(cache_key, result, config.OSM_CACHE_TTL)

if __name__ == "__main__":  # manual smoke test: python -m data.osm
    area = config.get_area("thane")
    data = get_green_spaces(area["latitude"], area["longitude"], area["radius_m"])
    print(area["name"], data["summary"])
    for feature in data["features"][:10]:
        print(" -", feature["category"], "|", feature["name"])