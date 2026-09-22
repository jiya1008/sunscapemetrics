/* =========================================================================
   HEATALERT
   "What's coming next" — five-day timeline plus a restyled Chart.js trend
   line. Highlights the first elevated/high day, the peak, and the
   improvement day. Chart.js is optional at runtime: if it failed to load,
   the timeline still renders and the chart panel shows a plain fallback.
   ========================================================================= */
import { DEMO, formatTemp, statusClass, trendMark } from "./data.js";

let chart = null;

export function renderAlert(areaId) {
  const forecast = DEMO.heatalert[areaId];
  const name = DEMO.heatwatch[areaId].area;
  document.getElementById("chart-area-label").textContent = name;

  const peakC = Math.max(...forecast.map((d) => d.apparentC));
  const firstBadIdx = forecast.findIndex((d) => d.status === "ELEVATED" || d.status === "HIGH");
  const improveIdx = forecast.findIndex((d) => d.status === "IMPROVING");

  document.getElementById("alert-timeline").innerHTML = forecast.map((entry, i) => {
    const tags = [];
    if (entry.apparentC === peakC) tags.push('<span class="tl-tag">Peak</span>');
    if (i === firstBadIdx) tags.push('<span class="tl-tag">First elevated</span>');
    if (i === improveIdx) tags.push('<span class="tl-tag">Improves</span>');
    return (
      '<li class="tl-item ' + statusClass(entry.status) + '">' +
        '<div class="tl-node" aria-hidden="true"></div>' +
        '<p class="tele tl-day">' + entry.day + '</p>' +
        '<span class="badge ' + statusClass(entry.status) + '">' + entry.status + '</span>' +
        '<p class="mono tl-temp">' + formatTemp(entry.apparentC) + '</p>' +
        '<p class="tele tl-trend">' + trendMark(entry.trend) + '</p>' +
        (tags.length ? '<div class="tl-tags">' + tags.join("") + '</div>' : "") +
      '</li>'
    );
  }).join("");

  renderChart(forecast);
}

function renderChart(forecast) {
  const canvas = document.getElementById("alert-chart");
  const fallback = document.getElementById("chart-fallback");
  if (typeof window.Chart === "undefined") {
    if (fallback) fallback.hidden = false;
    if (canvas) canvas.hidden = true;
    return;
  }
  if (fallback) fallback.hidden = true;
  if (canvas) canvas.hidden = false;

  const theme = document.body.getAttribute("data-theme");
  const gridColor = theme === "dark" ? "rgba(255,255,255,.14)" : "rgba(20,20,20,.12)";
  const tickColor = theme === "dark" ? "#A9B0BB" : "#5E5A4E";

  const data = {
    labels: forecast.map((d) => d.day),
    datasets: [{
      label: "Apparent \u00B0C",
      data: forecast.map((d) => d.apparentC),
      borderColor: "#7FBFE0",
      backgroundColor: "rgba(127,191,224,0.14)",
      fill: true, tension: 0.35, pointRadius: 4, pointBackgroundColor: "#7FBFE0", borderWidth: 2
    }]
  };
  const options = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: tickColor, font: { family: "IBM Plex Mono", size: 11 } }, grid: { color: gridColor } },
      y: { ticks: { color: tickColor, font: { family: "IBM Plex Mono", size: 11 }, callback: (v) => v + "\u00B0" }, grid: { color: gridColor } }
    }
  };

  try {
    if (chart) { chart.data = data; chart.options = options; chart.update(); }
    else { chart = new window.Chart(canvas, { type: "line", data, options }); }
  } catch (err) {
    console.warn("Chart render failed:", err);
    if (fallback) fallback.hidden = false;
    if (canvas) canvas.hidden = true;
  }
}
