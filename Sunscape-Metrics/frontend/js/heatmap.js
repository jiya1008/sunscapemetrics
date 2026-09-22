/* =========================================================================
   HEATMAP
   "How does my area compare" — Leaflet + the official OpenStreetMap tile
   endpoint, with status-colored markers synced to a ranked list. Guarded at
   two levels: if Leaflet itself fails to load, the ranked list still works;
   if the map initializes but the tile service fails, the map area swaps to
   a plain fallback message without touching HeatWatch/HeatAlert.
   ========================================================================= */
import { DEMO, CONFIG, formatTemp, statusClass, api } from "./data.js";

let map = null;
let mapReady = false;
const markers = {};
let sharedPopup = null;

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors";

export async function initMap(selectedAreaId, onSelect) {
  const rows = await api.getHeatmap();
  const mapEl = document.getElementById("mmr-map");

  if (typeof window.L === "undefined") {
    console.warn("Leaflet failed to load — HeatMap shows the ranked list only.");
    showMapFallback(mapEl);
  } else {
    try {
      map = window.L.map("mmr-map", { scrollWheelZoom: false, attributionControl: true }).setView([19.12, 72.95], 11);
      const tiles = window.L.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 19
      }).addTo(map);

      watchTileHealth(tiles, mapEl);

      rows.forEach((row) => {
        const marker = window.L.circleMarker([row.lat, row.lng], markerStyle(row.status, row.id === selectedAreaId)).addTo(map);
        marker.on("click", () => onSelect(row.id));
        markers[row.id] = marker;
      });
      map.fitBounds(window.L.featureGroup(Object.values(markers)).getBounds().pad(0.45));
      sharedPopup = window.L.popup({ closeButton: true, autoPan: true, autoPanPadding: [24, 48] });
      mapReady = true;
    } catch (err) {
      console.warn("Map init failed:", err);
      showMapFallback(mapEl);
    }
  }

  renderRanks(rows, selectedAreaId, onSelect);
}

/* If the tile service itself fails (network down, host blocked, etc.) after
   the map has otherwise initialized, fall back gracefully instead of
   leaving a half-broken grey grid on screen. HeatWatch/HeatAlert are
   untouched either way. */
function watchTileHealth(tiles, mapEl) {
  let loaded = 0;
  let failed = 0;
  tiles.on("tileload", () => { loaded += 1; });
  tiles.on("tileerror", () => { failed += 1; });
  setTimeout(() => {
    if (loaded === 0 && failed > 0) {
      console.warn("HeatMap: tile service unreachable — showing fallback.");
      mapReady = false;
      try { map.remove(); } catch (err) { /* noop */ }
      showMapFallback(mapEl);
    }
  }, 6000);
}

function showMapFallback(mapEl) {
  if (!mapEl) return;
  mapEl.innerHTML = '<p class="tele" style="padding:1rem;">Map temporarily unavailable. Heat intelligence is still available below.</p>';
}

function markerStyle(status, active) {
  const color = CONFIG.statusColor[status] || "#9BA2AD";
  return { radius: active ? 16 : 12, color: "#F3F1E9", weight: active ? 2 : 1, fillColor: color, fillOpacity: 0.82 };
}

export function highlightMap(areaId) {
  if (!mapReady) return;
  try {
    Object.entries(markers).forEach(([id, marker]) => marker.setStyle(markerStyle(DEMO.heatwatch[id].status, id === areaId)));
    const active = markers[areaId];
    const row = DEMO.heatwatch[areaId];
    if (active && row) {
      sharedPopup.setLatLng(active.getLatLng())
        .setContent("<strong>" + row.area + "</strong><br>" + row.status + " \u00B7 " + formatTemp(row.apparentC) + " apparent")
        .openOn(map);
    }
  } catch (err) {
    console.warn("Map highlight failed:", err);
  }
}

function renderRanks(rows, areaId, onSelect) {
  const ranked = [...rows].sort((a, b) => b.apparentC - a.apparentC);
  const list = document.getElementById("rank-list");
  if (!list) return;
  list.innerHTML = ranked.map((row, i) => (
    '<button type="button" class="rank-item' + (row.id === areaId ? " active" : "") + '" data-area="' + row.id + '">' +
      '<span class="rank-num mono">' + String(i + 1).padStart(2, "0") + '</span>' +
      '<span><span class="rank-name">' + row.area + '</span><span class="rank-meta mono">' + formatTemp(row.apparentC) + ' apparent</span></span>' +
      '<span class="badge ' + statusClass(row.status) + '">' + row.status + '</span>' +
    '</button>'
  )).join("");
  list.querySelectorAll("[data-area]").forEach((btn) => btn.addEventListener("click", () => onSelect(btn.dataset.area)));
}

export function syncRanks(areaId) {
  document.querySelectorAll("#rank-list .rank-item").forEach((btn) => btn.classList.toggle("active", btn.dataset.area === areaId));
}

export function invalidateMapSize() {
  if (mapReady && map) { try { map.invalidateSize(); } catch (err) { /* noop */ } }
}
