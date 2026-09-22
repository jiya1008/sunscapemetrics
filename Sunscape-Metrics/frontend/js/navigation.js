/* =========================================================================
   NAVIGATION
   Overlay sidebar: a circular rolling selector (no panel/border) that always
   shows the current section name, rolls toward it as the page scrolls, and
   supports left/right positioning. Plus the scroll-reveal system.
   ========================================================================= */
import { CONFIG } from "./data.js";

export function initSidebarPosition() {
  const saved = localStorage.getItem(CONFIG.storageKeys.sidebarPosition) || "left";
  applySidebarPosition(saved);
}

export function applySidebarPosition(position) {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  sidebar.classList.toggle("sidebar-right", position === "right");
  sidebar.classList.toggle("sidebar-left", position !== "right");
}

// Set by initSidebarWheel() below so other modules (the independent Preview
// Atmosphere control) can force the sidebar back to its compact state —
// e.g. when the preview panel opens — without the two floating controls
// ever needing to overlap.
let forceCollapse = null;
export function collapseSidebar() {
  if (forceCollapse) forceCollapse();
}

/* ---- circular rolling wheel + active-section detection ------------------
   Compact by default: only the active section name is visible. Hovering or
   focusing the wheel reveals the full list at readable opacity; it collapses
   back down to just the active name once the pointer/focus leaves. On touch
   (no hover), tapping the compact wheel toggles the reveal instead. */
export function initSidebarWheel() {
  const sidebar = document.getElementById("sidebar");
  const wheel = document.querySelector(".sidebar-wheel");
  const track = document.getElementById("sidebar-nav");
  const links = Array.from(document.querySelectorAll("#sidebar-nav a[data-section]"));
  if (!sidebar || !wheel || !track || !links.length) return;

  const items = links.map((a) => a.closest("li"));
  const sections = links.map((a) => document.getElementById(a.dataset.section)).filter(Boolean);
  let activeIndex = 0;
  let expanded = false;

  function roll(index) {
    activeIndex = index;
    // getComputedStyle().height reads the item's laid-out box height, which
    // a CSS transform never changes (transforms are paint-only) — unlike
    // getBoundingClientRect(), which reports the post-transform visual box.
    // Since inactive items carry a scale(0.7) in the compact state, reading
    // items[0]'s rect directly could measure a shrunk item instead of a
    // true one and throw the centering math off by that same amount.
    const itemH = parseFloat(getComputedStyle(items[0]).height) || 38.4;
    const viewportH = wheel.getBoundingClientRect().height || itemH * 4;
    // Compact: center just the single active item inside the small window.
    // Expanded: the window is sized to fit the whole list, so lay the list
    // out plainly (centered as a block) instead of still centering the
    // active item — centering an item near either end of the list inside
    // a "full reveal" window pushes the opposite end past the mask edge,
    // which is what was clipping the first/last item's text when expanded.
    const offset = expanded
      ? (viewportH - items.length * itemH) / 2
      : viewportH / 2 - (index * itemH + itemH / 2);
    track.style.transform = "translateY(" + offset + "px)";
    items.forEach((li, i) => {
      if (expanded) {
        // Full reveal: everything readable. Emphasis on the active item
        // comes from its own larger font-size + stronger glow (.active in
        // main.css) — no li-level scale here. A scale() on an item flush
        // against the top/bottom edge of the now content-height-matched
        // list grows it past the mask on that side (transforms are visual
        // only, so it doesn't participate in the layout math above),
        // which is what was clipping the first/last item's text.
        li.style.transform = "scale(1)";
        li.style.opacity = "1";
      } else {
        // compact: only the active section name shows
        li.style.transform = "scale(" + (i === index ? 1 : 0.7) + ")";
        li.style.opacity = i === index ? "1" : "0";
      }
    });
  }

  // On very short/narrow viewports the gap between the fixed mobile sidebar
  // anchor and the hero heading below it can be smaller than the full
  // expanded list — measure the real available space and cap the wheel to
  // it (with a scrollbar as a fallback) so expanding the sidebar can never
  // grow into page content. On normal viewports this cap sits above the
  // list's natural height, so nothing changes there.
  function capExpandedHeight() {
    const heading = document.querySelector(".hero h1");
    if (!heading || window.innerWidth > 760) { wheel.style.maxHeight = ""; wheel.style.overflowY = ""; return; }
    const sidebarTop = sidebar.getBoundingClientRect().top;
    const headingTop = heading.getBoundingClientRect().top;
    const available = headingTop - sidebarTop - 12; // small safety buffer
    const fullListHeight = items.length * (parseFloat(getComputedStyle(items[0]).height) || 38.4);
    if (available < fullListHeight) {
      // Genuinely not enough room on this screen to reveal every item at
      // full size without touching the heading below — cap the box and
      // let it scroll internally instead of either overlapping the page
      // or shrinking the text.
      wheel.style.maxHeight = Math.max(items[0].getBoundingClientRect().height || 38, available) + "px";
      wheel.style.overflowY = "auto";
    } else {
      wheel.style.maxHeight = "";
      wheel.style.overflowY = "";
    }
  }

  function setExpanded(next) {
    if (next === expanded) return;
    expanded = next;
    if (expanded) capExpandedHeight();
    else { wheel.style.maxHeight = ""; wheel.style.overflowY = ""; }
    sidebar.classList.toggle("expanded", expanded);
    // Immediate pass for instant feedback. The wheel's height is mid-
    // transition at this point (CSS animates it over .42s), so this alone
    // can under/over-shoot and clip the first item against the mask edge —
    // the transitionend listener below re-rolls once the box has actually
    // reached its final height, which is what fixes it for good.
    roll(activeIndex);
    // Let anything listening (e.g. the independent Preview Atmosphere
    // control) know the sidebar just grew, so it can close itself instead
    // of the two floating controls ever occupying the same space at once.
    sidebar.dispatchEvent(new CustomEvent("sidebarexpand", { detail: { expanded } }));
  }

  wheel.addEventListener("transitionend", (e) => {
    if (e.propertyName === "height") roll(activeIndex);
  });

  function setActive(id) {
    const idx = links.findIndex((a) => a.dataset.section === id);
    if (idx === -1) return;
    links.forEach((a, i) => a.classList.toggle("active", i === idx));
    roll(idx);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      setActive(entry.target.id);
    });
  }, { rootMargin: "-40% 0px -50% 0px", threshold: 0 });
  sections.forEach((s) => observer.observe(s));

  links.forEach((a) => a.addEventListener("click", (e) => {
    const target = document.getElementById(a.dataset.section);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }));

  // Mouse/trackpad
  sidebar.addEventListener("mouseenter", () => setExpanded(true));
  sidebar.addEventListener("mouseleave", () => setExpanded(false));
  // Keyboard
  sidebar.addEventListener("focusin", () => setExpanded(true));
  sidebar.addEventListener("focusout", (e) => { if (!sidebar.contains(e.relatedTarget)) setExpanded(false); });
  // Touch: no hover, so tapping the compact wheel (not a link) toggles reveal
  wheel.addEventListener("click", (e) => {
    if (e.target.closest("a")) return; // a real link tap still navigates
    setExpanded(!expanded);
  });

  window.addEventListener("resize", () => roll(activeIndex));
  roll(0); // initial compact position, before scroll/observer fires

  forceCollapse = () => setExpanded(false);
}

export function initScrollReveal() {
  const groups = document.querySelectorAll("[data-reveal]");
  if (!groups.length) return;
  if (prefersReducedMotion()) {
    groups.forEach((g) => g.classList.add("reveal-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle("reveal-visible", entry.isIntersecting);
    });
  }, { threshold: 0.16 });
  groups.forEach((g) => observer.observe(g));
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
