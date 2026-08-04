/* Focus timer (Pomodoro) — self-contained widget.
   Theme-aware (uses CSS variables), bilingual (reads studyLanguage),
   persists running state and a per-day completed count in localStorage. */
(function () {
  "use strict";

  const MODES = {
    focus: { mins: 25, key: "focus" },
    short: { mins: 5, key: "short" },
    long: { mins: 15, key: "long" },
  };

  const STORE_KEY = "studyFocusTimer";
  const COUNT_KEY = "studyFocusCount";

  const STRINGS = {
    ru: {
      title: "Фокус-таймер",
      focus: "Фокус",
      short: "Перерыв",
      long: "Отдых",
      start: "Старт",
      pause: "Пауза",
      reset: "Сброс",
      skip: "Пропустить",
      today: "сегодня",
      open: "Фокус-таймер",
      close: "Свернуть",
      doneFocus: "Сессия завершена! Время отдохнуть 🎉",
      doneBreak: "Перерыв окончен — за работу 💪",
      sessions: (n) => `${n} ${plural(n, ["сессия", "сессии", "сессий"])} сегодня`,
    },
    en: {
      title: "Focus timer",
      focus: "Focus",
      short: "Break",
      long: "Rest",
      start: "Start",
      pause: "Pause",
      reset: "Reset",
      skip: "Skip",
      today: "today",
      open: "Focus timer",
      close: "Collapse",
      doneFocus: "Session complete! Time for a break 🎉",
      doneBreak: "Break over — back to work 💪",
      sessions: (n) => `${n} ${n === 1 ? "session" : "sessions"} today`,
    },
  };

  function plural(n, forms) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
    return forms[2];
  }

  function lang() {
    try {
      return localStorage.getItem("studyLanguage") === "en" ? "en" : "ru";
    } catch {
      return "ru";
    }
  }

  function t() {
    return STRINGS[lang()];
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function readCount() {
    try {
      const raw = JSON.parse(localStorage.getItem(COUNT_KEY) || "{}");
      return raw.date === todayKey() ? Number(raw.count) || 0 : 0;
    } catch {
      return 0;
    }
  }

  function bumpCount() {
    const next = readCount() + 1;
    try {
      localStorage.setItem(COUNT_KEY, JSON.stringify({ date: todayKey(), count: next }));
    } catch {}
    return next;
  }

  const state = {
    mode: "focus",
    remaining: MODES.focus.mins * 60,
    running: false,
    endAt: 0,
    open: false,
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!saved || !MODES[saved.mode]) return;
      state.mode = saved.mode;
      state.open = Boolean(saved.open);
      if (saved.running && saved.endAt) {
        const left = Math.round((saved.endAt - Date.now()) / 1000);
        if (left > 0) {
          state.running = true;
          state.endAt = saved.endAt;
          state.remaining = left;
          return;
        }
      }
      state.remaining = typeof saved.remaining === "number" ? saved.remaining : MODES[saved.mode].mins * 60;
    } catch {}
  }

  function persist() {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          mode: state.mode,
          remaining: state.remaining,
          running: state.running,
          endAt: state.endAt,
          open: state.open,
        })
      );
    } catch {}
  }

  const RADIUS = 52;
  const CIRC = 2 * Math.PI * RADIUS;

  let root, ringFill, timeEl, sessionsEl, startBtn, fab;
  let ticker = null;

  function totalSeconds() {
    return MODES[state.mode].mins * 60;
  }

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const notes = [660, 880];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.18);
      });
      setTimeout(() => ctx.close().catch(() => {}), 800);
    } catch {}
  }

  function notify(message) {
    if (window.toast) {
      try {
        window.toast(message);
        return;
      } catch {}
    }
    const el = document.getElementById("toast");
    if (el) {
      el.textContent = message;
      el.classList.add("show");
      setTimeout(() => el.classList.remove("show"), 3200);
    }
  }

  function render() {
    if (!root) return;
    const dict = t();
    root.dataset.open = String(state.open);
    root.dataset.mode = state.mode;
    root.querySelector(".ft-title").textContent = dict.title;
    fab.setAttribute("aria-label", dict.open);
    fab.querySelector(".ft-fab-label").textContent = dict.title;
    root.querySelector(".ft-close").setAttribute("aria-label", dict.close);

    root.querySelectorAll(".ft-mode").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === state.mode);
      btn.textContent = dict[btn.dataset.mode];
    });

    timeEl.textContent = fmt(state.remaining);
    const progress = 1 - state.remaining / totalSeconds();
    ringFill.style.strokeDashoffset = String(CIRC * (1 - progress));

    startBtn.textContent = state.running ? dict.pause : dict.start;
    startBtn.dataset.state = state.running ? "running" : "paused";
    root.querySelector(".ft-reset").textContent = dict.reset;
    root.querySelector(".ft-skip").textContent = dict.skip;

    const count = readCount();
    sessionsEl.textContent = dict.sessions(count);
    fab.querySelector(".ft-fab-count").textContent = count > 0 ? String(count) : "";
    fab.querySelector(".ft-fab-count").classList.toggle("hidden", count === 0);
  }

  function stopTicker() {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  // A finished focus block is real study time: record it so the streak,
  // heatmap and weekly trend on the server stop reading as zero.
  function reportSession(minutes) {
    const token = (() => {
      try { return localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || ""; }
      catch { return ""; }
    })();
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    fetch("/api/sessions", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ minutes, note: "Pomodoro" }),
    })
      .then((res) => { if (res.ok && typeof window.refresh === "function") window.refresh(); })
      .catch(() => { /* offline or signed out — the local count still updates */ });
  }

  function complete() {
    state.running = false;
    stopTicker();
    beep();
    const wasFocus = state.mode === "focus";
    if (wasFocus) {
      bumpCount();
      reportSession(MODES.focus.mins);
      notify(t().doneFocus);
      state.mode = "short";
    } else {
      notify(t().doneBreak);
      state.mode = "focus";
    }
    state.remaining = totalSeconds();
    state.endAt = 0;
    persist();
    render();
  }

  function tick() {
    state.remaining = Math.round((state.endAt - Date.now()) / 1000);
    if (state.remaining <= 0) {
      state.remaining = 0;
      render();
      complete();
      return;
    }
    render();
  }

  function start() {
    if (state.remaining <= 0) state.remaining = totalSeconds();
    state.running = true;
    state.endAt = Date.now() + state.remaining * 1000;
    stopTicker();
    ticker = setInterval(tick, 250);
    persist();
    render();
  }

  function pause() {
    state.running = false;
    state.remaining = Math.max(0, Math.round((state.endAt - Date.now()) / 1000));
    state.endAt = 0;
    stopTicker();
    persist();
    render();
  }

  function reset() {
    state.running = false;
    stopTicker();
    state.remaining = totalSeconds();
    state.endAt = 0;
    persist();
    render();
  }

  function setMode(mode) {
    if (!MODES[mode]) return;
    state.mode = mode;
    state.running = false;
    stopTicker();
    state.remaining = totalSeconds();
    state.endAt = 0;
    persist();
    render();
  }

  function toggleOpen(force) {
    state.open = typeof force === "boolean" ? force : !state.open;
    persist();
    render();
  }

  function build() {
    root = document.createElement("div");
    root.className = "focus-timer";
    root.id = "focusTimer";
    root.innerHTML = `
      <button class="ft-fab" type="button" aria-label="Focus timer">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/></svg>
        <span class="ft-fab-label">Focus timer</span>
        <span class="ft-fab-count hidden"></span>
      </button>
      <section class="ft-panel" role="dialog" aria-label="Focus timer">
        <header class="ft-head">
          <strong class="ft-title">Focus timer</strong>
          <button class="ft-close icon-button" type="button" aria-label="Collapse">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>
          </button>
        </header>
        <div class="ft-modes" role="tablist">
          <button class="ft-mode" type="button" data-mode="focus">Focus</button>
          <button class="ft-mode" type="button" data-mode="short">Break</button>
          <button class="ft-mode" type="button" data-mode="long">Rest</button>
        </div>
        <div class="ft-ring-wrap">
          <svg class="ft-ring" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="ft-ring-track" cx="60" cy="60" r="${RADIUS}"></circle>
            <circle class="ft-ring-fill" cx="60" cy="60" r="${RADIUS}"></circle>
          </svg>
          <span class="ft-time" aria-live="polite">25:00</span>
        </div>
        <div class="ft-controls">
          <button class="ft-start primary-button" type="button" data-state="paused">Start</button>
          <button class="ft-reset ghost-button" type="button">Reset</button>
          <button class="ft-skip ghost-button" type="button">Skip</button>
        </div>
        <p class="ft-sessions"></p>
      </section>
    `;
    document.body.appendChild(root);

    fab = root.querySelector(".ft-fab");
    ringFill = root.querySelector(".ft-ring-fill");
    timeEl = root.querySelector(".ft-time");
    sessionsEl = root.querySelector(".ft-sessions");
    startBtn = root.querySelector(".ft-start");

    ringFill.style.strokeDasharray = String(CIRC);
    ringFill.style.strokeDashoffset = String(CIRC);

    fab.addEventListener("click", () => toggleOpen(true));
    root.querySelector(".ft-close").addEventListener("click", () => toggleOpen(false));
    startBtn.addEventListener("click", () => (state.running ? pause() : start()));
    root.querySelector(".ft-reset").addEventListener("click", reset);
    root.querySelector(".ft-skip").addEventListener("click", complete);
    root.querySelectorAll(".ft-mode").forEach((btn) =>
      btn.addEventListener("click", () => setMode(btn.dataset.mode))
    );

    // Re-render labels when the app's language toggle is used.
    document.getElementById("languageToggleBtn")?.addEventListener("click", () => setTimeout(render, 0));
    window.addEventListener("storage", (e) => {
      if (e.key === "studyLanguage") render();
    });
  }

  function init() {
    if (document.getElementById("focusTimer")) return;
    loadState();
    build();
    render();
    if (state.running && state.endAt > Date.now()) {
      ticker = setInterval(tick, 250);
    } else if (state.running) {
      // Timer elapsed while the page was closed.
      complete();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
