/* =========================================================================
   NOTIFICATIONS ("Notify Me")
   Page-open weather-update notifications, built entirely on the existing
   heat engine (js/data.js's `api`) — no separate/competing calculation and
   no invented weather numbers. Honest about scope: this only checks while
   a Sunscape page is open in the tab; it is NOT a background push system.
   See the "TRUE BACKGROUND NOTIFICATIONS" note near the bottom for what a
   real Service Worker + Web Push + Flask subscription store would add.
   ========================================================================= */
import { api, DEMO, formatTemp } from "./data.js";

const KEYS = {
  enabled: "sunscape_notifications_enabled",
  area: "sunscape_notification_area",
  lastFired: "sunscape_notification_last_fired"
};

/* ---- interval configuration ---------------------------------------------
   PROD_INTERVAL_MS is the real, shipped interval and must stay 1 hour.
   DEV_TEST_INTERVAL_MS is the ONLY thing a developer should touch to test
   the notification loop quickly — set it to e.g. 30 * 1000 locally, then
   set it back to null before committing/shipping. Production behavior
   never changes because of this file alone. */
const PROD_INTERVAL_MS = 60 * 60 * 1000; // 1 hour — do not change for production
const DEV_TEST_INTERVAL_MS = null;       // e.g. 30 * 1000 for local testing only

function activeIntervalMs() {
  return DEV_TEST_INTERVAL_MS || PROD_INTERVAL_MS;
}

let timer = null;

/* ---- support + permission ------------------------------------------------ */
export function isSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function permissionState() {
  if (!isSupported()) return "unsupported";
  return Notification.permission; // "default" | "granted" | "denied"
}

/* ---- preferences (localStorage — prototype only, no database yet) -------- */
export function loadPrefs() {
  return {
    enabled: localStorage.getItem(KEYS.enabled) === "1",
    area: localStorage.getItem(KEYS.area) || "mumbai"
  };
}

function savePrefs(prefs) {
  localStorage.setItem(KEYS.enabled, prefs.enabled ? "1" : "0");
  localStorage.setItem(KEYS.area, prefs.area);
}

export function setArea(areaId) {
  const prefs = loadPrefs();
  prefs.area = areaId;
  savePrefs(prefs);
  if (prefs.enabled) restartLoop(areaId); // future checks use the new area immediately
}

/* ---- enable / disable ----------------------------------------------------
   Never re-prompts once the browser has denied permission — we only call
   requestPermission() when the current state is genuinely "default". */
export async function enable(areaId) {
  if (!isSupported()) return { ok: false, reason: "unsupported" };

  let perm = Notification.permission;
  if (perm === "default") {
    try { perm = await Notification.requestPermission(); }
    catch (err) { console.warn("Notify Me: permission request failed:", err); return { ok: false, reason: "unsupported" }; }
  }

  if (perm !== "granted") {
    savePrefs({ enabled: false, area: areaId });
    return { ok: false, reason: "denied" };
  }

  savePrefs({ enabled: true, area: areaId });
  restartLoop(areaId);
  return { ok: true };
}

export function disable() {
  const prefs = loadPrefs();
  savePrefs({ enabled: false, area: prefs.area });
  stopLoop();
}

/* Called on every page load so the loop resumes while any Sunscape page is
   open, without ever asking for permission again on its own. */
export function resumeIfEnabled() {
  const prefs = loadPrefs();
  if (!prefs.enabled) return;
  if (!isSupported() || Notification.permission !== "granted") {
    // Permission was revoked since the setting was turned on — reflect that
    // instead of silently pretending it still works.
    savePrefs({ enabled: false, area: prefs.area });
    return;
  }
  restartLoop(prefs.area);
}

function restartLoop(areaId) {
  stopLoop();
  checkAndNotify(areaId); // first check runs right away, then every interval
  timer = setInterval(() => checkAndNotify(areaId), activeIntervalMs());
}

function stopLoop() {
  if (timer) { clearInterval(timer); timer = null; }
}

/* ---- the actual check + notification -------------------------------------
   Uses the same `api.getHeatwatch` every HeatWatch/HeatMap call uses — the
   one existing heat engine, not a second calculation. */
async function checkAndNotify(areaId) {
  try {
    const data = await api.getHeatwatch(areaId);
    if (!data) return; // unknown area — skip this cycle rather than guess
    showNotification(data);
  } catch (err) {
    // Skip this cycle and try again next interval; never show fake data.
    console.warn("Notify Me: weather check failed, will retry next interval:", err);
  }
}

function showNotification(data) {
  if (!isSupported() || Notification.permission !== "granted") return;

  // Cross-tab guard: if index.html and settings.html (or two tabs of the
  // same page) are both open, each runs its own timer independently, which
  // would otherwise fire duplicate notifications around the same moment.
  // A shared "last fired" timestamp lets whichever tab checks first claim
  // this cycle; the rest skip it.
  const last = Number(localStorage.getItem(KEYS.lastFired) || 0);
  const guardWindow = activeIntervalMs() - 5000; // small buffer, not the full interval
  if (Date.now() - last < guardWindow) return;
  localStorage.setItem(KEYS.lastFired, String(Date.now()));

  const title = "Sunscape Metrics \u2014 " + data.area;
  const body = data.area + " Weather Update\n" +
    formatTemp(data.temperatureC) + " \u00B7 Feels like " + formatTemp(data.apparentC) + "\n" +
    "Humidity " + data.humidityPct + "%\n" +
    "Heat status: " + data.status;
  try {
    new Notification(title, { body });
  } catch (err) {
    console.warn("Notify Me: could not display notification:", err);
  }
}

/* ---- status text for the Settings UI -------------------------------------- */
export function describeStatus() {
  if (!isSupported()) return { text: "Your browser does not support notifications.", blocked: true };
  const prefs = loadPrefs();
  const areaName = (DEMO.areas.find((a) => a.id === prefs.area) || {}).name || prefs.area;
  if (Notification.permission === "denied") {
    return { text: "Notifications are blocked in your browser. Enable notification permission to receive updates.", blocked: true };
  }
  if (prefs.enabled) {
    return { text: "Hourly weather updates enabled for " + areaName + ".", blocked: false };
  }
  return { text: "Weather updates are disabled.", blocked: false };
}

/* =========================================================================
   WHAT TRUE BACKGROUND NOTIFICATIONS WOULD ADD LATER
   This prototype only checks while a Sunscape page is open in the tab —
   setInterval cannot reliably fire after the browser is fully closed, and
   this module makes no claim otherwise. A real background system would add:
     1. A Service Worker (registered from app.js) to receive push events
        even when no tab is open.
     2. Web Push subscriptions (PushManager.subscribe with VAPID keys),
        sent to a Flask endpoint instead of only localStorage.
     3. Persistent server-side storage of each subscription + its area
        preference (this project intentionally has no database yet).
     4. A server-side hourly job (cron / Flask-APScheduler) that calls the
        same heat engine and pushes to stored subscriptions via Web Push.
   None of that is implemented here — this file only owns steps that can
   run in a normal open tab, kept separate so the above can slot in later
   without touching heatwatch.js, heatalert.js or heatmap.js.
   ========================================================================= */
