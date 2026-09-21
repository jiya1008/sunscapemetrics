/* =========================================================================
   ATMOSPHERE
   Time-of-day + season + weather -> a live sky (CSS-driven gradients, drifting
   cloud layers, twinkling stars, falling rain, occasional lightning) plus an
   animated SVG weather icon and an optional procedural ambient sound.
   No static photography, no per-city imagery — this is a generic sky engine.
   ========================================================================= */
import { CONFIG } from "./data.js";

/* ---- time / season / weather ------------------------------------------ */
export function getTimePeriod(date) {
  date = date || new Date();
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 4 && h < 6) return "dawn";
  if (h >= 6 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 19) return "dusk";
  if (h >= 19 && h < 22) return "evening";
  return "midnight";
}

export function getSeason(date) {
  date = date || new Date();
  const m = date.getMonth() + 1; // 1-12
  if (m >= 6 && m <= 9) return "monsoon";
  if (m === 11 || m === 12 || m <= 2) return "winter";
  return "summer";
}

export function getTheme(period) {
  return (period === "dusk" || period === "evening" || period === "midnight") ? "dark" : "light";
}

let weatherOverride = null; // "clear" | "rain" | null (null = live/auto)
let periodOverride = null;
let seasonOverride = null;

export function setWeatherOverride(v) { weatherOverride = v; }
export function setPeriodOverride(v) { periodOverride = v; }
export function setSeasonOverride(v) { seasonOverride = v; }
export function clearOverrides() { weatherOverride = null; periodOverride = null; seasonOverride = null; }

export function currentState(areaWeatherCondition) {
  return {
    time: periodOverride || getTimePeriod(),
    season: seasonOverride || getSeason(),
    weather: weatherOverride || areaWeatherCondition || "clear"
  };
}

/* ---- DOM refs, built once ---------------------------------------------- */
const els = {};
function ensureLayers() {
  if (els.root) return els;
  const root = document.getElementById("atmosphere");
  els.root = root;
  els.sky = root.querySelector(".atmo-sky");
  els.clouds = root.querySelector(".atmo-clouds");
  els.cloudLayers = root.querySelectorAll(".atmo-clouds, .atmo-clouds-far");
  els.stars = root.querySelector(".atmo-stars");
  els.rain = root.querySelector(".atmo-rain");
  els.rainCanvas = root.querySelector(".atmo-rain-canvas");
  els.sun = root.querySelector(".atmo-sun");
  els.moon = root.querySelector(".atmo-moon");
  els.lightning = root.querySelector(".atmo-lightning");
  if (els.rainCanvas) initRain(els.rainCanvas);
  return els;
}

/* ---- rain (single canvas, no DOM particles) ------------------------------
   A handful of short, translucent, gently-slanted streaks with varied
   length/opacity/position — closer to real rain glimpsed through glass
   than a dense field of continuous parallel lines. Only animates while
   it's actually raining, and only ever one <canvas>. */
let rainCtx = null, rainCanvasEl = null, rainDpr = 1, rainDrops = [], rainRafId = null, rainLastT = 0;
const RAIN_SLANT = 0.16; // horizontal drift per unit fallen — a gentle diagonal, not dead-vertical

function makeDrop(w, h, y) {
  const len = 12 + Math.random() * 20; // short streak/dash, not a full-height line
  return {
    x: Math.random() * (w + 80) - 40,
    y: y !== undefined ? y : Math.random() * h,
    len,
    speed: 300 + Math.random() * 260,
    opacity: 0.08 + Math.random() * 0.2,
    width: 1 + Math.random() * 1
  };
}

function seedRainDrops(w, h) {
  // Roughly half the density of the old repeating-pattern look, capped for
  // performance on very large/high-DPI screens.
  const count = Math.max(16, Math.min(42, Math.round((w * h) / 28000)));
  rainDrops = new Array(count).fill(null).map(() => makeDrop(w, h));
}

function sizeRainCanvas() {
  if (!rainCanvasEl) return;
  const w = window.innerWidth, h = window.innerHeight;
  rainDpr = Math.min(window.devicePixelRatio || 1, 2);
  rainCanvasEl.width = Math.round(w * rainDpr);
  rainCanvasEl.height = Math.round(h * rainDpr);
  seedRainDrops(w, h);
}

function drawRainFrame(dt) {
  const w = window.innerWidth, h = window.innerHeight;
  rainCtx.setTransform(rainDpr, 0, 0, rainDpr, 0, 0);
  rainCtx.clearRect(0, 0, w, h);
  rainCtx.lineCap = "round";
  for (const d of rainDrops) {
    if (dt) {
      const fall = (d.speed * dt) / 1000;
      d.y += fall;
      d.x += fall * RAIN_SLANT;
      if (d.y - d.len > h) Object.assign(d, makeDrop(w, h, -d.len));
    }
    const x2 = d.x - d.len * RAIN_SLANT;
    const y2 = d.y - d.len;
    const grad = rainCtx.createLinearGradient(d.x, d.y, x2, y2);
    // Translucent, slightly blue-white "liquid glass" streak — fades to
    // nothing at the tail rather than a hard-edged bar.
    grad.addColorStop(0, "rgba(214,231,248," + d.opacity + ")");
    grad.addColorStop(0.6, "rgba(214,231,248," + (d.opacity * 0.55) + ")");
    grad.addColorStop(1, "rgba(214,231,248,0)");
    rainCtx.strokeStyle = grad;
    rainCtx.lineWidth = d.width;
    rainCtx.beginPath();
    rainCtx.moveTo(d.x, d.y);
    rainCtx.lineTo(x2, y2);
    rainCtx.stroke();
  }
}

function rainTick(t) {
  if (!rainLastT) rainLastT = t;
  const dt = Math.min(48, t - rainLastT); // ms; clamp so a stalled tab doesn't jump the drops
  rainLastT = t;
  drawRainFrame(dt);
  rainRafId = requestAnimationFrame(rainTick);
}

function startRain() {
  if (!rainCtx || rainRafId) return;
  if (prefersReducedMotion()) { rainLastT = 0; drawRainFrame(0); return; } // one still frame, no loop
  rainLastT = 0;
  rainRafId = requestAnimationFrame(rainTick);
}

function stopRain() {
  if (rainRafId) { cancelAnimationFrame(rainRafId); rainRafId = null; }
  if (rainCtx) rainCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
}

let rainResizeTimer = null;
function initRain(canvas) {
  if (rainCanvasEl) return; // already wired up
  rainCanvasEl = canvas;
  rainCtx = canvas.getContext("2d");
  sizeRainCanvas();
  window.addEventListener("resize", () => {
    clearTimeout(rainResizeTimer);
    rainResizeTimer = setTimeout(() => {
      sizeRainCanvas();
      if (rainRafId || (els.rain && els.rain.classList.contains("active") && prefersReducedMotion())) drawRainFrame(0);
    }, 150);
  });
}

/* ---- sky gradients per time period, tinted by season --------------------
   Extra mid-stops (5 per period instead of 3) for a richer, more natural
   gradient — closer to real atmospheric color transition than a flat
   3-stop blend, while remaining pure CSS (no images). */
const SKY = {
  dawn:      ["#1d1530", "#4a3358", "#8f4f6c", "#d17f6e", "#f4b47e"],
  morning:   ["#8fbfe6", "#b3d5ec", "#d8e9f0", "#eef4ee", "#fbf3df"],
  afternoon: ["#4a90c9", "#72afdc", "#a3cce6", "#cfe6ee", "#eef6ee"],
  dusk:      ["#211531", "#4a2a52", "#8f3f68", "#cf6350", "#f4a35a"],
  evening:   ["#0c1024", "#181e3a", "#2c2f52", "#463a5e", "#5a4a6e"],
  midnight:  ["#04050c", "#080b18", "#0b1024", "#111730", "#141a33"]
};
const SEASON_TINT = {
  summer:  { warm: 1.08, sat: 1.05 },
  winter:  { warm: 0.9,  sat: 0.9 },
  monsoon: { warm: 0.85, sat: 0.8 }
};

let lightningTimer = null;
let soundCtx = null, soundGain = null, soundSource = null;
let iconResetTimer = null;

export function render(state) {
  const { root, sky, cloudLayers, stars, rain, sun, moon } = ensureLayers();
  const theme = getTheme(state.time);
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem(CONFIG.storageKeys.theme, theme);

  root.className = "atmosphere atmo-" + state.time + " season-" + state.season +
    (state.weather === "rain" ? " weather-rain" : " weather-clear");

  const stops = SKY[state.time] || SKY.afternoon;
  const tint = SEASON_TINT[state.season] || SEASON_TINT.summer;
  sky.style.background = "linear-gradient(180deg, " + stops[0] + " 0%, " + stops[1] + " 28%, " +
    stops[2] + " 52%, " + stops[3] + " 76%, " + stops[4] + " 100%)";
  sky.style.filter = "saturate(" + tint.sat + ") brightness(" + (state.weather === "rain" ? tint.warm * 0.72 : tint.warm) + ")";

  const showStars = state.time === "evening" || state.time === "midnight" || state.time === "dusk";
  stars.style.opacity = showStars ? (state.weather === "rain" ? .25 : 1) : 0;

  const showSun = (state.time === "morning" || state.time === "afternoon" || state.time === "dawn") && state.weather !== "rain";
  const showMoon = (state.time === "evening" || state.time === "midnight") ;
  sun.style.opacity = showSun ? 1 : 0;
  moon.style.opacity = showMoon ? 1 : 0;

  const heavy = state.weather === "rain" || state.season === "monsoon";
  const cloudOpacity = state.weather === "rain" ? .95 : (state.season === "monsoon" ? .7 : .4);
  // DOM order is [far layer, near layer] — far stays dimmer for depth.
  cloudLayers.forEach((layer, i) => {
    layer.style.opacity = i === 0 ? cloudOpacity * 0.55 : cloudOpacity;
    layer.classList.toggle("clouds-heavy", heavy);
  });

  const isRaining = state.weather === "rain";
  rain.classList.toggle("active", isRaining);
  if (isRaining) startRain(); else stopRain();
  clearInterval(lightningTimer);
  if (state.weather === "rain" && !prefersReducedMotion()) {
    lightningTimer = setInterval(maybeFlashLightning, 4500);
  }

  updateWeatherIcon(state);
  return theme;
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function maybeFlashLightning() {
  if (Math.random() > 0.35) return;
  const { lightning } = els;
  // Randomize where the glow sits along the horizon and how strong it is,
  // within a low ceiling — "distant lightning behind clouds", never a
  // bright strike right in front of the viewer.
  lightning.style.setProperty("--flash-x", 20 + Math.random() * 60 + "%");
  lightning.style.setProperty("--flash-strength", (0.06 + Math.random() * 0.07).toFixed(3));
  lightning.classList.add("flash");
  const holdMs = 140 + Math.random() * 90;
  setTimeout(() => {
    lightning.classList.remove("flash");
    // Occasionally a faint second pulse, like a distant flicker — kept
    // rare and even softer than the first so it reads as an echo, not a
    // second strike.
    if (Math.random() < 0.25) {
      setTimeout(() => {
        lightning.style.setProperty("--flash-strength", (0.04 + Math.random() * 0.04).toFixed(3));
        lightning.classList.add("flash");
        setTimeout(() => lightning.classList.remove("flash"), 110);
      }, 90);
    }
  }, holdMs);
}

/* ---- weather icon (SVG swap + idle/click animation) --------------------- */
function updateWeatherIcon(state) {
  const icon = document.getElementById("weather-icon");
  if (!icon) return;
  let kind = "sun";
  if (state.weather === "rain") kind = "rain";
  else if (state.time === "evening" || state.time === "midnight") kind = "moon";
  else if (state.season === "monsoon") kind = "cloud";
  icon.dataset.kind = kind;
  icon.setAttribute("aria-label", iconLabel(kind));
  icon.querySelectorAll(".icon-face").forEach((f) => f.style.display = "none");
  const face = icon.querySelector('[data-face="' + kind + '"]');
  if (face) face.style.display = "block";
}
function iconLabel(kind) {
  return { sun: "Clear sky", moon: "Clear night", cloud: "Cloudy", rain: "Rain" }[kind] || "Weather";
}

export function bindWeatherIcon() {
  const icon = document.getElementById("weather-icon");
  if (!icon) return;

  const trigger = () => {
    if (iconResetTimer) clearTimeout(iconResetTimer);
    icon.classList.add("icon-active");
    iconResetTimer = setTimeout(() => icon.classList.remove("icon-active"), 900);
    playChime();
  };

  // Drag-to-move: click plays the chime; dragging beyond a small threshold
  // is silent and springs back to the resting position on release.
  const DRAG_THRESHOLD = 6;
  let drag = null;
  let ignoreNextClick = false;

  icon.addEventListener("pointerdown", (e) => {
    drag = { startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId };
    try { icon.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
  });

  icon.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      drag.moved = true;
      icon.classList.add("dragging");
    }
    if (drag.moved && !prefersReducedMotion()) {
      icon.style.transform = "translate(" + dx + "px," + dy + "px) scale(1.14)";
    }
  });

  function endDrag(e) {
    if (!drag) return;
    const wasDrag = drag.moved;
    try { icon.releasePointerCapture(drag.pointerId); } catch (err) { /* noop */ }
    icon.classList.remove("dragging");
    icon.style.transform = ""; // CSS spring transition animates back to rest
    ignoreNextClick = true; // the browser still dispatches a click after pointerup
    drag = null;
    if (!wasDrag) trigger(); // small movement or none at all = a normal click
  }
  icon.addEventListener("pointerup", endDrag);
  icon.addEventListener("pointercancel", endDrag);

  // Native click only fires for keyboard activation now (Enter/Space below
  // already prevents its own synthetic click), so guard against the
  // duplicate click a pointer sequence also produces.
  icon.addEventListener("click", () => {
    if (ignoreNextClick) { ignoreNextClick = false; return; }
    trigger();
  });
  icon.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); trigger(); } });
}

/* ---- optional procedural sound (no external audio files, no autoplay) --- */
function ensureAudioContext() {
  if (soundCtx) return soundCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  soundCtx = new Ctx();
  soundGain = soundCtx.createGain();
  soundGain.gain.value = 0;
  soundGain.connect(soundCtx.destination);
  return soundCtx;
}

function buildNoiseSource(ctx) {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1200;
  src.connect(filter);
  filter.connect(soundGain);
  return src;
}

export function setSoundEnabled(enabled) {
  localStorage.setItem(CONFIG.storageKeys.soundEnabled, enabled ? "1" : "0");
  const btn = document.getElementById("sound-toggle");
  if (btn) {
    btn.setAttribute("aria-pressed", String(enabled));
    const label = enabled ? "Mute ambient sound" : "Enable ambient sound";
    btn.setAttribute("aria-label", label);
    btn.title = label;
    btn.textContent = enabled ? "\uD83D\uDD0A" : "\uD83D\uDD07"; // icon only — no visible text
  }
  const ctx = ensureAudioContext();
  if (!ctx) return;
  if (enabled) {
    if (ctx.state === "suspended") ctx.resume();
    if (!soundSource) { soundSource = buildNoiseSource(ctx); soundSource.start(); }
    soundGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1.2);
  } else if (soundGain) {
    soundGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  }
}

function playChime() {
  if (localStorage.getItem(CONFIG.storageKeys.soundEnabled) !== "1") return;
  const ctx = ensureAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 660;
  g.gain.value = 0;
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start();
  const t = ctx.currentTime;
  g.gain.linearRampToValueAtTime(0.06, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  osc.stop(t + 0.55);
}

export function initSoundControl() {
  const btn = document.getElementById("sound-toggle");
  if (!btn) return;
  const saved = localStorage.getItem(CONFIG.storageKeys.soundEnabled) === "1";
  btn.setAttribute("aria-pressed", String(saved));
  const label = saved ? "Mute ambient sound" : "Enable ambient sound";
  btn.setAttribute("aria-label", label);
  btn.title = label;
  btn.textContent = saved ? "\uD83D\uDD0A" : "\uD83D\uDD07"; // icon only — no visible text
  btn.addEventListener("click", () => {
    const now = btn.getAttribute("aria-pressed") !== "true";
    setSoundEnabled(now);
  });
  // Do NOT auto-start audio here — browsers block it and the spec forbids autoplay.
  // setSoundEnabled(true) only ever runs from the click handler above.
}
