/* Small, isolated UX enhancements that don't touch app.js.
   Currently: count-up animation for the dashboard metric numbers.
   Race-proof: app.js (renderDashboard) remains the source of truth — this only
   re-animates toward whatever value app.js writes, and ignores its own writes. */
(function () {
  "use strict";

  const reduceMotion = () =>
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const METRIC_IDS = ["metricTotalTasks", "metricFocus", "metricProgress"];

  function write(el, str) {
    el._lastWrite = str;
    el.textContent = str;
  }

  function animateTo(el, target, suffix) {
    if (el._countTarget === target) return;
    el._countTarget = target;

    if (reduceMotion()) {
      el._countShown = target;
      write(el, target + suffix);
      return;
    }

    const from = Number.isFinite(el._countShown) ? el._countShown : 0;
    const duration = 700;
    const startTime = performance.now();
    cancelAnimationFrame(el._raf);

    function frame(now) {
      const p = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = Math.round(from + (target - from) * eased);
      el._countShown = value;
      write(el, value + suffix);
      if (p < 1) el._raf = requestAnimationFrame(frame);
    }
    el._raf = requestAnimationFrame(frame);
  }

  function evaluate(el) {
    const raw = (el.textContent || "").trim();
    const m = raw.match(/^(\d+)(\D*)$/); // leading integer + optional suffix like "%"
    if (!m) return;
    animateTo(el, parseInt(m[1], 10), m[2] || "");
  }

  function watch(el) {
    el._countShown = 0;
    const observer = new MutationObserver(() => {
      // Ignore mutations we caused ourselves; react only to app.js writes.
      if (el.textContent === el._lastWrite) return;
      evaluate(el);
    });
    observer.observe(el, { childList: true, characterData: true, subtree: true });
    el._observer = observer;
    evaluate(el); // animate whatever value is present at startup
  }

  function init() {
    METRIC_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) watch(el);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
