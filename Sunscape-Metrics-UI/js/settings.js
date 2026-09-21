/* =========================================================================
   SETTINGS
   settings.html only. Demo-only sign-in (no real backend yet — structured
   so Flask auth can replace the localStorage stand-in later), high-contrast
   toggle, sidebar-position control, sound toggle. All persisted via the
   storage keys defined in data.js.
   ========================================================================= */
import { CONFIG } from "./data.js";
import { initSoundControl } from "./atmosphere.js";
import { applySidebarPosition } from "./navigation.js";
import * as notify from "./notifications.js";

function applyTheme() {
  const theme = localStorage.getItem(CONFIG.storageKeys.theme) || "light";
  document.body.setAttribute("data-theme", theme);
}

function initHighContrastToggle() {
  const toggle = document.getElementById("hc-toggle");
  if (!toggle) return;
  const on = localStorage.getItem(CONFIG.storageKeys.highContrast) === "1";
  toggle.setAttribute("aria-pressed", String(on));
  document.body.classList.toggle("high-contrast", on);
  toggle.addEventListener("click", () => {
    const now = toggle.getAttribute("aria-pressed") !== "true";
    toggle.setAttribute("aria-pressed", String(now));
    document.body.classList.toggle("high-contrast", now);
    localStorage.setItem(CONFIG.storageKeys.highContrast, now ? "1" : "0");
  });
}

function initSidebarPositionControl() {
  const buttons = document.querySelectorAll("#sidebar-position-control [data-position]");
  if (!buttons.length) return;
  const current = localStorage.getItem(CONFIG.storageKeys.sidebarPosition) || "left";
  buttons.forEach((b) => b.classList.toggle("active", b.dataset.position === current));
  buttons.forEach((b) => b.addEventListener("click", () => {
    localStorage.setItem(CONFIG.storageKeys.sidebarPosition, b.dataset.position);
    buttons.forEach((x) => x.classList.toggle("active", x === b));
    applySidebarPosition(b.dataset.position); // reflected immediately if a sidebar exists on this page
  }));
}

/* ---- demo sign-in / dashboard (no real auth yet) ------------------------ */
function readDemoUser() {
  try { return JSON.parse(localStorage.getItem(CONFIG.storageKeys.demoUser) || "null"); }
  catch (err) { return null; }
}

function initAccount() {
  const signedOutView = document.getElementById("account-signed-out");
  const signedInView = document.getElementById("account-signed-in");
  const form = document.getElementById("signin-form");
  const signOutBtn = document.getElementById("sign-out-btn");

  function paintDashboard(user) {
    document.getElementById("dash-name").textContent = user.name;
    document.getElementById("dash-email").textContent = user.email;
    document.getElementById("dash-area").textContent = user.preferredArea;
    signedOutView.hidden = true;
    signedInView.hidden = false;
  }

  const existing = readDemoUser();
  if (existing) paintDashboard(existing);

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("signin-email").value.trim();
      // Demo-only: no password is ever stored, hashed, or displayed.
      const name = email.split("@")[0] || "Guest";
      const preferredArea = document.getElementById("signin-area").value;
      const user = { name, email, preferredArea };
      localStorage.setItem(CONFIG.storageKeys.demoUser, JSON.stringify(user));
      paintDashboard(user);
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener("click", () => {
      localStorage.removeItem(CONFIG.storageKeys.demoUser);
      signedInView.hidden = true;
      signedOutView.hidden = false;
      form.reset();
    });
  }
}

/* ---- Notify Me ------------------------------------------------------------ */
function paintNotifyStatus() {
  const status = notify.describeStatus();
  const statusEl = document.getElementById("notify-status");
  if (statusEl) statusEl.textContent = status.text;
  return status;
}

function initNotifyMe() {
  const toggle = document.getElementById("notify-toggle");
  const areaSelect = document.getElementById("notify-area");
  if (!toggle || !areaSelect) return;

  const prefs = notify.loadPrefs();
  areaSelect.value = prefs.area;
  toggle.setAttribute("aria-pressed", String(prefs.enabled && notify.permissionState() === "granted"));
  paintNotifyStatus();

  toggle.addEventListener("click", async () => {
    const turningOn = toggle.getAttribute("aria-pressed") !== "true";
    if (turningOn) {
      const result = await notify.enable(areaSelect.value);
      toggle.setAttribute("aria-pressed", String(result.ok));
      if (!result.ok && result.reason === "unsupported") {
        document.getElementById("notify-status").textContent = "Your browser does not support notifications.";
        return;
      }
    } else {
      notify.disable();
      toggle.setAttribute("aria-pressed", "false");
    }
    paintNotifyStatus();
  });

  areaSelect.addEventListener("change", () => {
    notify.setArea(areaSelect.value);
    paintNotifyStatus();
  });
}

(function initSettingsPage() {
  applyTheme();
  initHighContrastToggle();
  initSidebarPositionControl();
  initSoundControl();
  initAccount();
  initNotifyMe();
  notify.resumeIfEnabled();
})();
