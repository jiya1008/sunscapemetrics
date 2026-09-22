/* =========================================================================
   DATA
   Demo payloads shaped like future API responses, plus a thin API layer.
   Replace the bodies in `api` with fetch() calls once Flask endpoints exist:
     GET /api/areas
     GET /api/weather?area=Mumbai
     GET /api/heatwatch?area=Mumbai
     GET /api/heatalert?area=Mumbai
     GET /api/heatmap?area=Mumbai
   Nothing outside this file should read DEMO directly — go through `api`.
   ========================================================================= */

export const DEMO = {
  analystNote: {
    time: "19:24",
    text: "Navi Mumbai is currently experiencing higher apparent heat than Mumbai and Thane. Elevated humidity is contributing to the increased perceived heat."
  },
  areas: [
    { id: "mumbai", name: "Mumbai", lat: 19.0760, lng: 72.8777 },
    { id: "navi-mumbai", name: "Navi Mumbai", lat: 19.0330, lng: 73.0297 },
    { id: "thane", name: "Thane", lat: 19.2183, lng: 72.9781 }
  ],
  heatwatch: {
    mumbai: { area: "Mumbai", temperatureC: 34.2, apparentC: 39.1, humidityPct: 68, status: "ELEVATED",
      reason: "High apparent heat combined with elevated humidity.", updatedMinutesAgo: 6 },
    "navi-mumbai": { area: "Navi Mumbai", temperatureC: 34.8, apparentC: 40.2, humidityPct: 72, status: "HIGH",
      reason: "Apparent temperature above 40\u00B0C with humidity over 70% is driving high heat stress.", updatedMinutesAgo: 5 },
    thane: { area: "Thane", temperatureC: 33.4, apparentC: 36.4, humidityPct: 65, status: "ELEVATED",
      reason: "Moderate-to-high apparent heat with humidity still in an uncomfortable range.", updatedMinutesAgo: 7 }
  },
  heatalert: {
    mumbai: [
      { day: "Today", status: "ELEVATED", apparentC: 39.1, trend: "up" },
      { day: "Tomorrow", status: "HIGH", apparentC: 41.0, trend: "up" },
      { day: "Day 2", status: "HIGH", apparentC: 41.4, trend: "up" },
      { day: "Day 3", status: "ELEVATED", apparentC: 38.2, trend: "down" },
      { day: "Day 4", status: "IMPROVING", apparentC: 35.6, trend: "down" }
    ],
    "navi-mumbai": [
      { day: "Today", status: "HIGH", apparentC: 40.2, trend: "up" },
      { day: "Tomorrow", status: "HIGH", apparentC: 41.8, trend: "up" },
      { day: "Day 2", status: "HIGH", apparentC: 40.9, trend: "down" },
      { day: "Day 3", status: "ELEVATED", apparentC: 38.4, trend: "down" },
      { day: "Day 4", status: "IMPROVING", apparentC: 36.1, trend: "down" }
    ],
    thane: [
      { day: "Today", status: "ELEVATED", apparentC: 36.4, trend: "flat" },
      { day: "Tomorrow", status: "ELEVATED", apparentC: 37.8, trend: "up" },
      { day: "Day 2", status: "HIGH", apparentC: 40.1, trend: "up" },
      { day: "Day 3", status: "ELEVATED", apparentC: 37.0, trend: "down" },
      { day: "Day 4", status: "IMPROVING", apparentC: 34.8, trend: "down" }
    ]
  },
  // Per-area weather condition, currently demo-controlled; will come from
  // GET /api/weather?area=... later. Kept separate from heat status.
  weather: {
    mumbai: { condition: "clear" },
    "navi-mumbai": { condition: "clear" },
    thane: { condition: "clear" }
  }
};

export const CONFIG = {
  statusColor: { NORMAL: "#33A468", ELEVATED: "#E2A339", HIGH: "#E15A3C", IMPROVING: "#33A468" },
  storageKeys: {
    theme: "sunscape_theme",
    highContrast: "sunscape_high_contrast",
    sidebarPosition: "sunscape_sidebar_position",
    soundEnabled: "sunscape_sound_enabled",
    demoUser: "sunscape_demo_user"
  }
};

/* Thin API abstraction — swap bodies for fetch() calls, keep the shape. */
export const api = {
  getAreas() {
    return Promise.resolve(DEMO.areas);
  },
  getWeather(areaId) {
    return Promise.resolve(DEMO.weather[areaId] || { condition: "clear" });
  },
  getHeatwatch(areaId) {
    return Promise.resolve(DEMO.heatwatch[areaId]);
  },
  getHeatalert(areaId) {
    return Promise.resolve(DEMO.heatalert[areaId]);
  },
  getHeatmap() {
    return Promise.resolve(DEMO.areas.map((area) => ({ ...area, ...DEMO.heatwatch[area.id] })));
  }
};

export function formatTemp(n) { return n.toFixed(1) + "\u00B0C"; }
export function statusClass(status) { return String(status).toLowerCase(); }
export function trendMark(trend) {
  if (trend === "up") return "\u2191 rising";
  if (trend === "down") return "\u2193 easing";
  return "\u2192 steady";
}
