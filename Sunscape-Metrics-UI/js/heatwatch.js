/* =========================================================================
   HEATWATCH
   "What's happening right now" — status-first panel, plus the area
   comparison table. Status is the visual lead; temperature is secondary.
   ========================================================================= */
import { DEMO, formatTemp, statusClass } from "./data.js";

export function renderWatch(areaId) {
  const d = DEMO.heatwatch[areaId];

  const heroStatus = document.getElementById("hero-status");
  heroStatus.textContent = d.status;
  heroStatus.className = "hero-status status-" + statusClass(d.status);
  document.getElementById("hero-area-name").textContent = d.area;
  document.getElementById("hero-temp").textContent = formatTemp(d.temperatureC);
  document.getElementById("hero-apparent").textContent = formatTemp(d.apparentC);

  document.getElementById("watch-area-name").textContent = d.area;
  const watchStatus = document.getElementById("watch-status");
  watchStatus.textContent = d.status;
  watchStatus.className = "watch-status status-" + statusClass(d.status);
  document.getElementById("watch-temp").textContent = formatTemp(d.temperatureC);
  document.getElementById("watch-apparent").textContent = formatTemp(d.apparentC);
  document.getElementById("watch-humidity").textContent = d.humidityPct + "%";
  document.getElementById("watch-reason").textContent = d.reason;
  document.getElementById("watch-updated").textContent = "Updated " + d.updatedMinutesAgo + " min ago";

  renderCompare(areaId);
}

export function renderCompare(areaId) {
  const maxT = Math.max(...Object.values(DEMO.heatwatch).map((r) => r.temperatureC));
  const maxA = Math.max(...Object.values(DEMO.heatwatch).map((r) => r.apparentC));
  const maxH = Math.max(...Object.values(DEMO.heatwatch).map((r) => r.humidityPct));
  const body = document.querySelector("#compare-table tbody");
  if (!body) return;
  body.innerHTML = DEMO.areas.map((area) => {
    const d = DEMO.heatwatch[area.id];
    const active = area.id === areaId ? " active" : "";
    return (
      '<tr class="' + active.trim() + '">' +
        '<th scope="row">' + d.area + '</th>' +
        '<td><span class="mono">' + formatTemp(d.temperatureC) + '</span><div class="bar ' + statusClass(d.status) + '"><span style="width:' + (d.temperatureC / maxT * 100) + '%"></span></div></td>' +
        '<td><span class="mono">' + formatTemp(d.apparentC) + '</span><div class="bar ' + statusClass(d.status) + '"><span style="width:' + (d.apparentC / maxA * 100) + '%"></span></div></td>' +
        '<td><span class="mono">' + d.humidityPct + '%</span><div class="bar ' + statusClass(d.status) + '"><span style="width:' + (d.humidityPct / maxH * 100) + '%"></span></div></td>' +
        '<td><span class="badge ' + statusClass(d.status) + '">' + d.status + '</span></td>' +
      '</tr>'
    );
  }).join("");
}

export function renderAreaPicker(areaId, onSelect) {
  const picker = document.getElementById("area-picker");
  if (!picker) return;
  picker.innerHTML = DEMO.areas.map((area) => (
    '<button type="button" class="area-pill' + (area.id === areaId ? " active" : "") + '" data-area="' + area.id + '" aria-pressed="' + (area.id === areaId) + '">' + area.name + '</button>'
  )).join("");
  picker.querySelectorAll("[data-area]").forEach((btn) => {
    btn.addEventListener("click", () => onSelect(btn.dataset.area));
  });
}

export function syncAreaPicker(areaId) {
  document.querySelectorAll("#area-picker [data-area]").forEach((btn) => {
    const active = btn.dataset.area === areaId;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}
