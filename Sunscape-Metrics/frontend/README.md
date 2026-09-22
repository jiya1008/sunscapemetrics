# Sunscape Metrics

Climate intelligence for the Mumbai Metropolitan Region (Mumbai, Navi Mumbai, Thane).
SDG 11 — Sustainable Cities and Communities · AI use case KJS-CES-01.

## ⚠️ Run this with a local server, not by double-clicking index.html

This build uses ES modules (`<script type="module" src="js/app.js">`), per the
brief's "use ES modules if appropriate." Browsers block ES module imports
under the `file://` protocol for security reasons (a CORS restriction that
does **not** apply to regular scripts) — so opening `index.html` directly by
double-clicking it will fail silently: you'll see the atmosphere/sidebar HTML
but none of the JavaScript will run.

Serve the folder locally instead. Any of these work:

```bash
# Python (built into most systems)
cd Sunscape-Metrics
python3 -m http.server 8000
# then open http://localhost:8000

# Node
npx serve Sunscape-Metrics

# VS Code
# Right-click index.html → "Open with Live Server"
```

This is also exactly how you'd deploy it (GitHub Pages, Netlify, a Flask
static route, etc.) — all of those serve over http(s), so this only matters
for local testing.

## File structure

```
Sunscape-Metrics/
├── index.html          Homepage — atmosphere, sidebar, logo, all product sections
├── settings.html        Separate page: account, high contrast, sidebar position, sound
├── css/
│   ├── main.css          Tokens, layout, sidebar, hero, atmosphere layers, components
│   ├── animations.css    Atmosphere motion, weather-icon states, scroll reveal
│   └── settings.css      Settings-page-only styles
├── js/
│   ├── data.js            Demo data + API abstraction (swap for fetch() later)
│   ├── navigation.js       Sidebar expand/position, active-section tracking, scroll reveal
│   ├── atmosphere.js       Time/season/weather engine, live sky, weather icon, sound
│   ├── heatwatch.js        HeatWatch panel + area comparison table
│   ├── heatalert.js        5-day timeline + Chart.js trend
│   ├── heatmap.js          Leaflet map + ranked list
│   ├── settings.js         settings.html logic (sign-in, dashboard, toggles)
│   └── app.js              index.html entry point — wires everything together
├── assets/
│   ├── icons/              (unused — weather icons are inline SVG in index.html)
│   ├── sounds/              (unused — sound is generated procedurally via Web Audio API)
│   └── backgrounds/         (unused — atmosphere is CSS-driven, not photographic)
└── README.md
```

## What changed from the previous single-file build

- **Refactored** the one large `index.html` into the structure above. `data.js`
  preserves the exact same demo values and API shape as before.
- **Removed** the top navigation bar and all city photography (Marine Drive,
  Navi Mumbai skyline, Thane Creek). Replaced with a large centered wordmark
  logo and a floating overlay sidebar (dash indicators by default, expands on
  hover/focus/tap, left or right, set in Settings).
- **New atmosphere system**: instead of a per-city photo, the sky is generated
  from CSS — a gradient graded by time-of-day and season, drifting cloud
  blobs, a twinkling star field, falling rain, an occasional lightning flash,
  and a glowing sun/moon — all CSS animations, no per-frame JS loops, so it's
  cheap to run. `getTimePeriod()`, `getSeason()` and `getWeatherMode()`
  (as `currentState()`) in `atmosphere.js` compute the live state; a small
  "Preview atmosphere" control (bottom-left, separate from the main nav) lets
  you step through every state for a demo without waiting on the real clock.
- **Weather icon**: an inline SVG that swaps between sun/moon/cloud/rain faces,
  idles with a slow rotation/float, and reacts to a click/tap with a brief
  pulse plus an optional short procedural chime (Web Audio API — no audio
  files, nothing copyrighted, never autoplays).
- **Scroll-reveal**: sections fade/rise into view via `IntersectionObserver`
  (`initScrollReveal` in `navigation.js`), respecting `prefers-reduced-motion`.
- **HeatWatch, HeatAlert, HeatMap, Area Comparison, Analyst Note, Methodology**
  all kept their existing logic and demo data, restyled so status is the
  dominant visual element (not the raw temperature), inside a long centered
  scroll rather than a card-grid dashboard.
- **settings.html** is new: demo sign-in (localStorage only, no password ever
  stored or shown, structured so Flask auth can replace it later), a
  post-sign-in dashboard, a High Contrast Mode toggle, and the sidebar
  left/right control — all synced across pages via `localStorage`.
- Kept the defensive guards from the previous debugging round: Leaflet and
  Chart.js are loaded from jsDelivr with no SRI hash, and both `heatmap.js`
  and `heatalert.js` check `typeof window.L` / `typeof window.Chart` and
  `try/catch` around their setup, so a failed CDN load degrades gracefully
  (plain ranked list / plain fallback text) instead of breaking the page.

## External dependencies (CDN)

- Google Fonts — Manrope, IBM Plex Mono
- Leaflet 1.9.4 (jsDelivr)
- Chart.js 4.4.1 (jsDelivr)

No build tools, no frameworks, no npm install required.

## Still needs the Flask backend

- `GET /api/areas`, `/api/weather`, `/api/heatwatch`, `/api/heatalert`,
  `/api/heatmap` — `js/data.js`'s `api` object currently resolves demo data
  synchronously; replace each method's body with the matching `fetch()` call.
- Real authentication for the Settings sign-in form (currently a localStorage
  stand-in — see `js/settings.js`).
- Real weather/season detection to replace `atmosphere.js`'s demo default
  (`condition: "clear"` in `data.js`); the engine already accepts a
  `weather.condition` string per area, so wiring in Open-Meteo just means
  populating that field from the real API response.

## Testing checklist

- [ ] Served via a local server (not opened directly — see warning above)
- [ ] Mumbai / Navi Mumbai / Thane selection all update HeatWatch, HeatAlert,
      the chart, the map, the ranked list and the comparison table
- [ ] Sidebar expands on hover (desktop) and on tap (touch/mobile), and via
      keyboard focus
- [ ] Sidebar nav links smooth-scroll to the right section and the active
      link updates while scrolling
- [ ] Settings link navigates to `settings.html` (not reachable by scrolling)
- [ ] Scroll-reveal fades sections in; disabling animations in OS settings
      (`prefers-reduced-motion`) shows content immediately instead
- [ ] Weather icon changes with the previewed time/weather and reacts to a
      click; sound stays off until the sound button is explicitly pressed
- [ ] Settings: sign-in shows the dashboard with no password ever displayed;
      sign-out returns to the form; High Contrast toggle visibly changes
      contrast on both pages; Sidebar Position left/right persists across a
      reload and across both pages
- [ ] No console errors; if Leaflet or Chart.js fail to load, the page still
      renders with the documented fallbacks instead of breaking
