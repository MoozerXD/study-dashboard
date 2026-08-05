/* Public demo test — runs on the marketing pages, needs no account.
   Mounts into any <div data-demo="ent"> and grades entirely in the browser. */
(function () {
  "use strict";

  const LANG = (document.documentElement.lang || "ru").toLowerCase().startsWith("en") ? "en" : "ru";
  const t = (ru, en) => (LANG === "en" ? en : ru);
  const EXAM_PATH = LANG === "en" ? "/en" : "";

  const CATALOG = {
    ent: { flag: "🇰🇿", accent: "#22c1a3", name: { ru: "ЕНТ", en: "UNT" } },
    ege: { flag: "🇷🇺", accent: "#5b8cff", name: { ru: "ЕГЭ", en: "EGE" } },
    ielts: { flag: "🌍", accent: "#b478ff", name: { ru: "IELTS", en: "IELTS" } },
    sat: { flag: "🇺🇸", accent: "#ffb020", name: { ru: "SAT", en: "SAT" } },
  };

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
  }

  function pick(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return value[LANG] || value.ru || value.en || "";
  }

  function plural(n, forms) {
    if (LANG === "en") return forms[3];
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1];
    return forms[2];
  }
  const QUESTIONS = ["вопрос", "вопроса", "вопросов", "questions"];

  function normalizeInput(value) {
    return String(value ?? "").trim().toLowerCase().replace(",", ".").replace(/\s+/g, " ");
  }

  function isCorrect(question, answer) {
    if (answer == null) return false;
    if (question.type === "input") {
      const given = normalizeInput(answer);
      return Boolean(given) && (question.answers || []).some((a) => normalizeInput(a) === given);
    }
    if (question.type === "multi") {
      if (!Array.isArray(answer) || !answer.length) return false;
      const given = [...answer].map(Number).sort((a, b) => a - b);
      const correct = [...(question.correctIndices || [])].map(Number).sort((a, b) => a - b);
      return given.length === correct.length && given.every((v, i) => v === correct[i]);
    }
    return Number(answer) === Number(question.correctIndex);
  }

  /* ------------------------------------------------------------ widget --- */

  function createDemo(root) {
    const examId = root.dataset.demo;
    const meta = CATALOG[examId];
    if (!meta) return;

    const state = {
      phase: "idle",      // idle | loading | running | done | error
      data: null,
      index: 0,
      answers: new Map(), // questionId -> { value, checked }
      variant: 0,
      section: "",
      startedAt: 0,
    };

    root.style.setProperty("--accent", meta.accent);
    root.classList.add("demo-widget");

    function answerFor(id) {
      if (!state.answers.has(id)) state.answers.set(id, { value: null, checked: false });
      return state.answers.get(id);
    }

    function currentQuestion() {
      return state.data?.questions[state.index] || null;
    }

    function score() {
      let correct = 0;
      for (const q of state.data.questions) if (isCorrect(q, state.answers.get(q.id)?.value)) correct += 1;
      return { correct, total: state.data.questions.length };
    }

    async function load(section = "") {
      state.phase = "loading";
      state.section = section;
      render();
      try {
        const query = new URLSearchParams({ n: "10" });
        if (section) query.set("section", section);
        const res = await fetch(`/api/demo/${examId}?${query}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        state.data = await res.json();
        state.index = 0;
        state.answers = new Map();
        state.variant += 1;
        state.startedAt = Date.now();
        state.phase = "running";
      } catch {
        state.phase = "error";
      }
      render();
      if (state.phase === "running") root.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    /* ------------------------------------------------------- rendering --- */

    function renderIdle() {
      const sections = state.data?.sections || [];
      return `
        <div class="demo-start">
          <span class="demo-badge">${meta.flag} ${t("Демо-тест", "Demo test")}</span>
          <h3>${t("Попробуй прямо сейчас — без регистрации", "Try it right now — no sign-up")}</h3>
          <p>${t(
            "10 вопросов из настоящего банка. После каждого ответа сразу видно, верно ли и почему.",
            "10 questions from the real bank. After every answer you immediately see whether it was right and why.")}</p>
          ${sections.length > 1 ? `
            <label class="demo-section-pick">
              <span>${t("Раздел", "Section")}:</span>
              <select data-demo-section>
                <option value="">${t("Все вперемешку", "Mixed")}</option>
                ${sections.map((s) => `<option value="${esc(s.id)}">${esc(pick(s.title))}</option>`).join("")}
              </select>
            </label>` : ""}
          <button class="btn primary lg" data-demo-start type="button">${t("Начать демо-тест", "Start the demo")}</button>
          <small>${t("Займёт 3–5 минут. Ничего вводить не нужно.", "Takes 3–5 minutes. Nothing to fill in.")}</small>
        </div>`;
    }

    function renderQuestion() {
      const q = currentQuestion();
      const answer = answerFor(q.id);
      const total = state.data.questions.length;
      const progress = ((state.index + (answer.checked ? 1 : 0)) / total) * 100;

      let body;
      if (q.type === "input") {
        body = `
          <input class="demo-input" data-demo-input type="text" autocomplete="off"
            placeholder="${t("Введи ответ", "Type your answer")}" value="${esc(answer.value ?? "")}" ${answer.checked ? "disabled" : ""}>
          ${answer.checked ? "" : `<button class="btn primary" data-demo-check type="button">${t("Проверить", "Check")}</button>`}`;
      } else if (q.type === "multi") {
        const picked = new Set(Array.isArray(answer.value) ? answer.value.map(Number) : []);
        const correct = new Set((q.correctIndices || []).map(Number));
        body = `
          <p class="demo-hint">${t("Можно выбрать несколько вариантов", "Several answers can be correct")}</p>
          <div class="demo-choices">
            ${q.choices.map((choice, i) => {
              let cls = picked.has(i) ? "picked" : "";
              if (answer.checked) {
                if (correct.has(i)) cls = "correct";
                else if (picked.has(i)) cls = "wrong";
              }
              return `<button class="demo-choice ${cls}" data-demo-multi="${i}" type="button" ${answer.checked ? "disabled" : ""}>
                <span class="demo-letter">${picked.has(i) ? "✓" : String.fromCharCode(65 + i)}</span>
                <span>${esc(choice)}</span>
              </button>`;
            }).join("")}
          </div>
          ${answer.checked ? "" : `<button class="btn primary" data-demo-check type="button">${t("Проверить", "Check")}</button>`}`;
      } else {
        body = `
          <div class="demo-choices">
            ${q.choices.map((choice, i) => {
              let cls = Number(answer.value) === i && answer.value != null ? "picked" : "";
              if (answer.checked) {
                if (i === Number(q.correctIndex)) cls = "correct";
                else if (Number(answer.value) === i) cls = "wrong";
              }
              return `<button class="demo-choice ${cls}" data-demo-choice="${i}" type="button" ${answer.checked ? "disabled" : ""}>
                <span class="demo-letter">${String.fromCharCode(65 + i)}</span>
                <span>${esc(choice)}</span>
              </button>`;
            }).join("")}
          </div>`;
      }

      const ok = isCorrect(q, answer.value);
      const correctLabel = q.type === "input"
        ? esc((q.answers || [])[0] || "")
        : q.type === "multi"
          ? (q.correctIndices || []).map((i) => String.fromCharCode(65 + i)).join(", ")
          : String.fromCharCode(65 + Number(q.correctIndex));

      const feedback = answer.checked ? `
        <div class="demo-feedback ${ok ? "ok" : "bad"}">
          <strong>${ok ? t("Верно! 🎉", "Correct! 🎉") : `${t("Неверно", "Incorrect")} — ${t("правильный ответ", "correct answer")}: ${esc(correctLabel)}`}</strong>
          <p>${esc(q.explanation)}</p>
        </div>` : "";

      const isLast = state.index === total - 1;

      return `
        <div class="demo-run">
          <div class="demo-topbar">
            <span class="demo-counter">${t("Вопрос", "Question")} ${state.index + 1} ${t("из", "of")} ${total}</span>
            ${q.sectionTitle ? `<span class="demo-pill">${esc(pick(q.sectionTitle))}</span>` : ""}
            ${q.topic ? `<span class="demo-pill soft">${esc(q.topic)}</span>` : ""}
          </div>
          <div class="demo-progress"><span style="width:${progress}%"></span></div>
          <p class="demo-question">${esc(q.text).replace(/\n/g, "<br>")}</p>
          ${body}
          ${feedback}
          ${answer.checked ? `<button class="btn primary lg demo-next" data-demo-next type="button">${isLast ? t("Показать результат", "See the result") : t("Следующий вопрос", "Next question")} →</button>` : ""}
        </div>`;
    }

    function renderResult() {
      const { correct, total } = score();
      const pct = total ? Math.round((correct / total) * 100) : 0;
      const seconds = Math.max(1, Math.round((Date.now() - state.startedAt) / 1000));
      const minutes = Math.floor(seconds / 60);
      const timeLabel = minutes ? `${minutes} ${t("мин", "min")} ${seconds % 60} ${t("с", "s")}` : `${seconds} ${t("с", "s")}`;

      const verdict = pct >= 80
        ? t("Отличный результат! Готов проверить себя на полном пробнике?", "Excellent! Ready to try a full mock?")
        : pct >= 50
          ? t("Неплохо. Полный пробник покажет, какие темы проседают.", "Not bad. A full mock will show which topics are weak.")
          : t("Есть над чем поработать — и это нормально, для этого тренажёр и нужен.", "There is work to do — and that is exactly what the trainer is for.");

      const byTopic = new Map();
      for (const q of state.data.questions) {
        const key = q.topic || pick(q.sectionTitle) || "—";
        const entry = byTopic.get(key) || { correct: 0, total: 0 };
        entry.total += 1;
        if (isCorrect(q, state.answers.get(q.id)?.value)) entry.correct += 1;
        byTopic.set(key, entry);
      }
      const weak = [...byTopic.entries()]
        .filter(([, v]) => v.correct < v.total)
        .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
        .slice(0, 4);

      return `
        <div class="demo-result">
          <div class="demo-result-head">
            <div class="demo-ring" style="--pct:${pct}"><span>${pct}%</span></div>
            <div>
              <h3>${correct} ${t("из", "of")} ${total} ${t("верно", "correct")}</h3>
              <p>${esc(verdict)}</p>
              <small>${t("Время", "Time")}: ${timeLabel} · ${t("вариант", "variant")} №${state.variant}</small>
            </div>
          </div>

          ${weak.length ? `
            <div class="demo-weak">
              <strong>${t("Темы, где были ошибки:", "Topics you missed:")}</strong>
              <div class="demo-weak-list">
                ${weak.map(([topic, v]) => `<span class="demo-pill soft">${esc(topic)} · ${v.correct}/${v.total}</span>`).join("")}
              </div>
            </div>` : ""}

          <div class="demo-cta">
            <p>${t(
              `В полном тренажёре ${state.data.total} ${plural(state.data.total, QUESTIONS)}, пробники с таймером и разбор всех ошибок. Бесплатно.`,
              `The full trainer has ${state.data.total} questions, timed mocks and a review of every mistake. Free.`)}</p>
            <div class="demo-cta-row">
              <a class="btn primary lg" href="/register">${t("Создать аккаунт и продолжить", "Create an account and continue")}</a>
              <button class="btn ghost" data-demo-again type="button">${t("Другой вариант", "Another variant")}</button>
              <button class="btn ghost" data-demo-share type="button">${t("Поделиться", "Share")}</button>
            </div>
          </div>
        </div>`;
    }

    function render() {
      if (state.phase === "loading") {
        root.innerHTML = `<div class="demo-loading"><span class="demo-spinner"></span><p>${t("Готовим вопросы…", "Preparing questions…")}</p></div>`;
        return;
      }
      if (state.phase === "error") {
        root.innerHTML = `
          <div class="demo-start">
            <h3>${t("Не удалось загрузить вопросы", "Could not load the questions")}</h3>
            <p>${t("Попробуй ещё раз — возможно, пропала связь.", "Try again — the connection may have dropped.")}</p>
            <button class="btn primary" data-demo-start type="button">${t("Повторить", "Retry")}</button>
          </div>`;
        return;
      }
      if (state.phase === "running") { root.innerHTML = renderQuestion(); focusInput(); return; }
      if (state.phase === "done") { root.innerHTML = renderResult(); return; }
      root.innerHTML = renderIdle();
    }

    function focusInput() {
      const input = root.querySelector("[data-demo-input]");
      if (!input || input.disabled) return;
      input.addEventListener("input", () => { answerFor(currentQuestion().id).value = input.value; });
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const answer = answerFor(currentQuestion().id);
        if (answer.checked) advance(); else check();
      });
    }

    function check() {
      const q = currentQuestion();
      const answer = answerFor(q.id);
      const empty = answer.value == null || answer.value === ""
        || (Array.isArray(answer.value) && !answer.value.length);
      if (empty) return;
      answer.checked = true;
      render();
    }

    function advance() {
      if (state.index < state.data.questions.length - 1) {
        state.index += 1;
        render();
        root.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        state.phase = "done";
        render();
        root.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    /* ----------------------------------------------------------- share --- */

    function drawResultCard() {
      const { correct, total } = score();
      const pct = total ? Math.round((correct / total) * 100) : 0;
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext("2d");

      const bg = ctx.createLinearGradient(0, 0, 1200, 630);
      bg.addColorStop(0, "#040d1d");
      bg.addColorStop(1, "#07203d");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 1200, 630);

      ctx.fillStyle = meta.accent;
      ctx.fillRect(0, 0, 1200, 8);

      ctx.fillStyle = "#9ba8c3";
      ctx.font = "600 28px Inter, system-ui, sans-serif";
      ctx.fillText("Study Dashboard · studydashboard.me", 70, 90);

      ctx.fillStyle = "#f7fbff";
      ctx.font = "800 66px Inter, system-ui, sans-serif";
      ctx.fillText(`${meta.flag} ${t("Демо-тест", "Demo test")} ${pick(meta.name)}`, 70, 200);

      ctx.font = "800 150px Inter, system-ui, sans-serif";
      ctx.fillStyle = meta.accent;
      ctx.fillText(`${correct}/${total}`, 70, 370);

      ctx.font = "600 46px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#f7fbff";
      ctx.fillText(`${pct}% ${t("верных ответов", "correct")}`, 70, 445);

      ctx.font = "500 32px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#9ba8c3";
      ctx.fillText(t("Пройди пробный тест бесплатно", "Take a free practice test"), 70, 530);

      return canvas;
    }

    async function share() {
      const { correct, total } = score();
      const text = t(
        `Прошёл демо-тест ${pick(meta.name)} на studydashboard.me: ${correct}/${total}. Попробуй и ты!`,
        `I scored ${correct}/${total} on the ${pick(meta.name)} demo test at studydashboard.me. Try it!`);
      const url = `${location.origin}${EXAM_PATH}/${examId}`;
      const canvas = drawResultCard();

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      const file = blob ? new File([blob], `${examId}-demo.png`, { type: "image/png" }) : null;

      if (file && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], text, url }); return; } catch { /* cancelled */ }
      }
      if (navigator.share) {
        try { await navigator.share({ text, url }); return; } catch { /* cancelled */ }
      }
      // No share sheet: hand over the image and copy the link.
      if (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${examId}-demo.png`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      }
      try { await navigator.clipboard.writeText(`${text} ${url}`); } catch { /* clipboard blocked */ }
      toast(t("Картинка сохранена, ссылка скопирована", "Image saved, link copied"));
    }

    function toast(message) {
      let el = document.getElementById("demoToast");
      if (!el) {
        el = document.createElement("div");
        el.id = "demoToast";
        el.className = "demo-toast";
        document.body.appendChild(el);
      }
      el.textContent = message;
      el.classList.add("visible");
      clearTimeout(toast.timer);
      toast.timer = setTimeout(() => el.classList.remove("visible"), 3200);
    }

    /* ---------------------------------------------------------- events --- */

    root.addEventListener("click", (event) => {
      const target = event.target.closest("button");
      if (!target) return;

      if (target.hasAttribute("data-demo-start")) {
        load(root.querySelector("[data-demo-section]")?.value || "");
        return;
      }
      if (target.hasAttribute("data-demo-choice")) {
        const q = currentQuestion();
        const answer = answerFor(q.id);
        if (answer.checked) return;
        answer.value = Number(target.dataset.demoChoice);
        answer.checked = true; // single choice grades immediately
        render();
        return;
      }
      if (target.hasAttribute("data-demo-multi")) {
        const q = currentQuestion();
        const answer = answerFor(q.id);
        if (answer.checked) return;
        const picked = new Set(Array.isArray(answer.value) ? answer.value.map(Number) : []);
        const index = Number(target.dataset.demoMulti);
        if (picked.has(index)) picked.delete(index); else picked.add(index);
        answer.value = [...picked].sort((a, b) => a - b);
        render();
        return;
      }
      if (target.hasAttribute("data-demo-check")) { check(); return; }
      if (target.hasAttribute("data-demo-next")) { advance(); return; }
      if (target.hasAttribute("data-demo-again")) { load(state.section); return; }
      if (target.hasAttribute("data-demo-share")) { share(); return; }
    });

    // Section list needs the bank metadata; fetch it lazily so the idle card
    // can already offer a picker without blocking first paint.
    fetch(`/api/demo/${examId}?n=5`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || state.phase !== "idle") return;
        state.data = data;
        render();
      })
      .catch(() => { /* the start button still works */ });

    render();
  }

  function init() {
    document.querySelectorAll("[data-demo]").forEach(createDemo);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
