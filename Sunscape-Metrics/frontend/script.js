const DATA = {
  analystNote: { time: "19:24", text: "Navi Mumbai is currently experiencing higher apparent heat than Mumbai and Thane. Elevated humidity is contributing to the increased perceived heat." },
  areas: [
    { id:"mumbai", name:"Mumbai", lat:19.0760, lng:72.8777 },
    { id:"navi-mumbai", name:"Navi Mumbai", lat:19.0330, lng:73.0297 },
    { id:"thane", name:"Thane", lat:19.2183, lng:72.9781 }
  ],
  heatwatch: {
    mumbai: { area:"Mumbai", temperatureC:34.2, apparentC:39.1, humidityPct:68, status:"ELEVATED", reason:"High apparent heat combined with elevated humidity.", updatedMinutesAgo:6 },
    "navi-mumbai": { area:"Navi Mumbai", temperatureC:34.8, apparentC:40.2, humidityPct:72, status:"HIGH", reason:"Apparent temperature above 40°C with humidity over 70% is driving high heat stress.", updatedMinutesAgo:5 },
    thane: { area:"Thane", temperatureC:33.4, apparentC:36.4, humidityPct:65, status:"ELEVATED", reason:"Moderate-to-high apparent heat with humidity still in an uncomfortable range.", updatedMinutesAgo:7 }
  },
  heatalert: {
    mumbai: [
      {day:"Today",status:"ELEVATED",apparentC:39.1,trend:"up"},{day:"Tomorrow",status:"HIGH",apparentC:41.0,trend:"up"},
      {day:"Day 2",status:"HIGH",apparentC:41.4,trend:"up"},{day:"Day 3",status:"ELEVATED",apparentC:38.2,trend:"down"},
      {day:"Day 4",status:"IMPROVING",apparentC:35.6,trend:"down"}
    ],
    "navi-mumbai": [
      {day:"Today",status:"HIGH",apparentC:40.2,trend:"up"},{day:"Tomorrow",status:"HIGH",apparentC:41.8,trend:"up"},
      {day:"Day 2",status:"HIGH",apparentC:40.9,trend:"down"},{day:"Day 3",status:"ELEVATED",apparentC:38.4,trend:"down"},
      {day:"Day 4",status:"IMPROVING",apparentC:36.1,trend:"down"}
    ],
    thane: [
      {day:"Today",status:"ELEVATED",apparentC:36.4,trend:"flat"},{day:"Tomorrow",status:"ELEVATED",apparentC:37.8,trend:"up"},
      {day:"Day 2",status:"HIGH",apparentC:40.1,trend:"up"},{day:"Day 3",status:"ELEVATED",apparentC:37.0,trend:"down"},
      {day:"Day 4",status:"IMPROVING",apparentC:34.8,trend:"down"}
    ]
  }
};
const STATUS_COLOR = { NORMAL:"#33A468", ELEVATED:"#E2A339", HIGH:"#E15A3C", IMPROVING:"#33A468" };

const fmtTemp = n => n.toFixed(1) + "°C";
const cls = s => String(s).toLowerCase();
const trendMark = t => t === "up" ? "↑ rising" : t === "down" ? "↓ easing" : "→ steady";

let selected = "mumbai";
let map, markers = {}, chart, mapReady = false;

function renderAreaPicker(){
  const el = document.getElementById("area-picker");
  el.innerHTML = DATA.areas.map(a =>
    `<button data-area="${a.id}" class="${a.id===selected?'active':''}">${a.name}</button>`
  ).join("");
  el.querySelectorAll("button").forEach(b => b.addEventListener("click", () => setArea(b.dataset.area)));
}

function renderWatch(id){
  const w = DATA.heatwatch[id];
  document.getElementById("watch-area").textContent = w.area;
  const statusEl = document.getElementById("watch-status");
  statusEl.textContent = w.status; statusEl.className = "badge " + cls(w.status);
  document.getElementById("watch-temp").textContent = fmtTemp(w.temperatureC);
  document.getElementById("watch-apparent").textContent = fmtTemp(w.apparentC);
  document.getElementById("watch-humidity").textContent = w.humidityPct + "%";
  document.getElementById("watch-reason").textContent = w.reason;
  document.getElementById("watch-updated").textContent = "Updated " + w.updatedMinutesAgo + " min ago";
}

function renderComparison(){
  const body = document.getElementById("compare-body");
  body.innerHTML = DATA.areas.map(a => {
    const w = DATA.heatwatch[a.id];
    return `<tr><td>${w.area}</td><td>${fmtTemp(w.temperatureC)}</td><td>${fmtTemp(w.apparentC)}</td><td>${w.humidityPct}%</td>
      <td><span class="badge ${cls(w.status)}">${w.status}</span></td></tr>`;
  }).join("");
}

function renderAlert(id){
  const forecast = DATA.heatalert[id];
  document.getElementById("alert-area-label").textContent = DATA.heatwatch[id].area;

  const peak = Math.max(...forecast.map(d => d.apparentC));
  document.getElementById("alert-timeline").innerHTML = forecast.map(d => `
    <li>
      <div class="day">${d.day}</div>
      <span class="badge ${cls(d.status)}">${d.status}</span>
      <div class="temp mono">${fmtTemp(d.apparentC)}</div>
      <div class="muted">${trendMark(d.trend)}</div>
      ${d.apparentC === peak ? '<div class="muted" style="margin-top:.3rem;">🔺 Peak</div>' : ''}
    </li>`).join("");

  renderChart(forecast);
}

function renderChart(forecast){
  const canvas = document.getElementById("alert-chart");
  const fallback = document.getElementById("chart-fallback");
  if (typeof window.Chart === "undefined"){
    fallback.hidden = false; canvas.hidden = true; return;
  }
  fallback.hidden = true; canvas.hidden = false;
  const data = {
    labels: forecast.map(d => d.day),
    datasets: [{ label:"Apparent °C", data: forecast.map(d => d.apparentC),
      borderColor:"#4C8FB8", backgroundColor:"rgba(76,143,184,0.15)", fill:true, tension:.3 }]
  };
  try{
    if (chart){ chart.data = data; chart.update(); }
    else { chart = new Chart(canvas, { type:"line", data, options:{ responsive:true, plugins:{legend:{display:false}} } }); }
  } catch(err){ fallback.hidden = false; canvas.hidden = true; }
}

function initMap(){
  const rows = DATA.areas.map(a => ({ ...a, ...DATA.heatwatch[a.id] }));
  if (typeof window.L === "undefined"){
    document.getElementById("mmr-map").innerHTML = '<p class="muted" style="padding:1rem;">Map unavailable. Heat data is still shown below.</p>';
  } else {
    try{
      map = L.map("mmr-map", { scrollWheelZoom:false }).setView([19.12, 72.95], 10);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution:"© OpenStreetMap", maxZoom:19 }).addTo(map);
      rows.forEach(r => {
        const m = L.circleMarker([r.lat, r.lng], markerStyle(r.status, r.id === selected)).addTo(map);
        m.bindPopup(`<strong>${r.area}</strong><br>${r.status} · ${fmtTemp(r.apparentC)} apparent`);
        m.on("click", () => setArea(r.id));
        markers[r.id] = m;
      });
      mapReady = true;
    } catch(err){
      document.getElementById("mmr-map").innerHTML = '<p class="muted" style="padding:1rem;">Map unavailable. Heat data is still shown below.</p>';
    }
  }
  renderRanks(rows);
}

function markerStyle(status, active){
  return { radius: active?14:10, color:"#fff", weight:active?2:1, fillColor: STATUS_COLOR[status]||"#999", fillOpacity:.85 };
}

function renderRanks(rows){
  const ranked = [...rows].sort((a,b) => b.apparentC - a.apparentC);
  document.getElementById("rank-list").innerHTML = ranked.map((r,i) => `
    <button class="rank-item ${r.id===selected?'active':''}" data-area="${r.id}">
      <span class="num mono">${String(i+1).padStart(2,"0")}</span>
      <span class="name">${r.area}<br><span class="muted mono">${fmtTemp(r.apparentC)} apparent</span></span>
      <span class="badge ${cls(r.status)}">${r.status}</span>
    </button>`).join("");
  document.querySelectorAll("#rank-list [data-area]").forEach(b => b.addEventListener("click", () => setArea(b.dataset.area)));
}

function syncMapAndRanks(){
  if (mapReady){
    Object.entries(markers).forEach(([id,m]) => m.setStyle(markerStyle(DATA.heatwatch[id].status, id===selected)));
  }
  document.querySelectorAll("#rank-list .rank-item").forEach(b => b.classList.toggle("active", b.dataset.area === selected));
}

function setArea(id){
  selected = id;
  renderAreaPicker();
  renderWatch(id);
  renderAlert(id);
  syncMapAndRanks();
}

function initSettings(){
  const btn = document.getElementById("settings-btn");
  const panel = document.getElementById("settings-panel");
  btn.addEventListener("click", () => panel.classList.toggle("open"));
  document.addEventListener("click", e => { if (!panel.contains(e.target) && e.target !== btn) panel.classList.remove("open"); });

  const darkToggle = document.getElementById("dark-toggle");
  const contrastToggle = document.getElementById("contrast-toggle");

  darkToggle.checked = localStorage.getItem("sunscape_theme") === "dark";
  document.body.setAttribute("data-theme", darkToggle.checked ? "dark" : "light");
  contrastToggle.checked = localStorage.getItem("sunscape_high_contrast") === "1";
  document.body.classList.toggle("high-contrast", contrastToggle.checked);

  darkToggle.addEventListener("change", () => {
    document.body.setAttribute("data-theme", darkToggle.checked ? "dark" : "light");
    localStorage.setItem("sunscape_theme", darkToggle.checked ? "dark" : "light");
  });
  contrastToggle.addEventListener("change", () => {
    document.body.classList.toggle("high-contrast", contrastToggle.checked);
    localStorage.setItem("sunscape_high_contrast", contrastToggle.checked ? "1" : "0");
  });
}

function initAccountBar(){
  const user = getUser();
  const greeting = document.getElementById("user-greeting");
  if (user && greeting) greeting.textContent = "Hi, " + (user.name || "there");
  const signOutBtn = document.getElementById("sign-out-btn");
  if (signOutBtn) signOutBtn.addEventListener("click", signOut);
  // Default the area picker to whatever the user chose while signing in.
  if (user && user.preferredArea && DATA.heatwatch[user.preferredArea]) {
    selected = user.preferredArea;
  }
}

(function init(){
  initAccountBar();
  initSettings();
  renderAreaPicker();
  renderComparison();
  document.getElementById("note-stamp").textContent = "Analyst note · " + DATA.analystNote.time;
  document.getElementById("note-copy").textContent = DATA.analystNote.text;
  initMap();
  setArea(selected);
})();
