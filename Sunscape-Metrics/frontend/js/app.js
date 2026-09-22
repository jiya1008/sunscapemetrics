/* =========================================================================
   APP
   Initialization for index.html. Connects data, atmosphere, navigation,
   heatwatch, heatalert and heatmap modules; owns the selected-area state.
   ========================================================================= */
import { DEMO, CONFIG, api } from "./data.js";
import {
  currentState, render, bindWeatherIcon, initSoundControl,
  setWeatherOverride, setPeriodOverride, setSeasonOverride, clearOverrides
} from "./atmosphere.js";
import { renderWatch, renderAreaPicker, syncAreaPicker } from "./heatwatch.js";
import { renderAlert } from "./heatalert.js";
import { initMap, highlightMap, syncRanks, invalidateMapSize } from "./heatmap.js";
import { initSidebarPosition, initSidebarWheel, initScrollReveal, collapseSidebar } from "./navigation.js";
import { resumeIfEnabled } from "./notifications.js";

let selectedArea = "mumbai";
let mapInitialized = false;

async function setArea(areaId) {
  selectedArea = areaId;
  renderWatch(areaId);
  renderAlert(areaId);
  syncAreaPicker(areaId);
  syncRanks(areaId);
  highlightMap(areaId);

  const weather = await api.getWeather(areaId);
  const state = currentState(weather.condition);
  render(state);
}

function initHighContrast() {
  const on = localStorage.getItem(CONFIG.storageKeys.highContrast) === "1";
  document.body.classList.toggle("high-contrast", on);
}

function initAtmospherePreview() {
  const toggle = document.getElementById("atmos-toggle");
  const panel = document.getElementById("atmos-panel");
  const sidebar = document.getElementById("sidebar");
  if (!toggle || !panel) return;

  // The sidebar and Preview Atmosphere are two fully independent floating
  // controls, but each can grow tall enough (sidebar expanded; panel open)
  // to reach the other's space on shorter viewports. Rather than letting
  // them ever overlap, only one is ever allowed to be in its "grown" state
  // at a time — opening one collapses the other.
  toggle.addEventListener("click", () => {
    const open = panel.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    if (open) collapseSidebar();
  });
  if (sidebar) {
    sidebar.addEventListener("sidebarexpand", (e) => {
      if (e.detail.expanded) {
        panel.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }
  panel.querySelectorAll("[data-period]").forEach((b) => b.addEventListener("click", () => { setPeriodOverride(b.dataset.period); setArea(selectedArea); }));
  panel.querySelectorAll("[data-season]").forEach((b) => b.addEventListener("click", () => { setSeasonOverride(b.dataset.season); setArea(selectedArea); }));
  panel.querySelectorAll("[data-weather]").forEach((b) => b.addEventListener("click", () => { setWeatherOverride(b.dataset.weather); setArea(selectedArea); }));
  const live = document.getElementById("atmos-live");
  if (live) live.addEventListener("click", () => { clearOverrides(); setArea(selectedArea); });
}

(async function init() {
  initHighContrast();
  initSidebarPosition();
  initSidebarWheel();
  initScrollReveal();
  resumeIfEnabled();
  bindWeatherIcon();
  initSoundControl();
  initAtmospherePreview();

  renderAreaPicker(selectedArea, setArea);

  document.getElementById("note-stamp").textContent = "Analyst note \u00B7 " + DEMO.analystNote.time;
  document.getElementById("note-copy").textContent = DEMO.analystNote.text;

  await initMap(selectedArea, setArea);
  mapInitialized = true;
  await setArea(selectedArea);
  setTimeout(invalidateMapSize, 250);

  window.addEventListener("resize", () => { if (mapInitialized) invalidateMapSize(); });
})();
