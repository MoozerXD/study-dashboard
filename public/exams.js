/* Exam preparation module: ЕНТ / ЕГЭ / IELTS / SAT mock tests, practice, materials, results tracking.
   Depends on globals from app.js: api(), escapeHtml(), currentLanguage(), currentLocale(), toast(). */
(() => {
  "use strict";

  const CATALOG = [
    { id: "ent", flag: "🇰🇿", accent: "#22c1a3", name: { ru: "ЕНТ", en: "UNT" } },
    { id: "ege", flag: "🇷🇺", accent: "#5b8cff", name: { ru: "ЕГЭ", en: "EGE" } },
    { id: "ielts", flag: "🌍", accent: "#b478ff", name: { ru: "IELTS", en: "IELTS" } },
    { id: "sat", flag: "🇺🇸", accent: "#ffb020", name: { ru: "SAT", en: "SAT" } },
  ];
  const PRACTICE_LENGTHS = [10, 20];

  const ex = {
    view: "catalog",          // catalog | detail
    activeExamId: null,
    tab: "mock",              // mock | practice | materials | results
    cache: {},                // examId -> exam json
    loading: {},
    attempts: [],             // all attempts for current user
    attemptsLoaded: false,
    openMaterialId: null,
    runner: null,             // active test run
  };

  function lang() { return typeof currentLanguage === "function" ? currentLanguage() : "ru"; }
  function t(ru, en) { return lang() === "en" ? en : ru; }
  function pick(obj) {
    if (obj == null) return "";
    if (typeof obj === "string") return obj;
    return obj[lang()] || obj.ru || obj.en || "";
  }
  function esc(value) { return escapeHtml(String(value ?? "")); }

  // Russian pluralization: plural(3, ["попытка","попытки","попыток"])
  function plural(n, forms) {
    if (lang() === "en") return `${forms[3] || forms[2]}`;
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1];
    return forms[2];
  }
  const QUESTIONS_FORMS = ["вопрос", "вопроса", "вопросов", "questions"];
  const ATTEMPTS_FORMS = ["попытка", "попытки", "попыток", "attempts"];

  /* ---------- tiny markdown renderer for materials ---------- */
  function renderMarkdown(md) {
    const lines = String(md || "").replace(/\r/g, "").split("\n");
    const out = [];
    let list = null; // "ul" | "ol"
    let tableRows = null;
    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    const closeTable = () => {
      if (!tableRows) return;
      const [head, ...body] = tableRows;
      const cells = (row, tag) => row.map((c) => `<${tag}>${inline(c)}</${tag}>`).join("");
      out.push(`<div class="md-table-wrap"><table><thead><tr>${cells(head, "th")}</tr></thead><tbody>${body.map((r) => `<tr>${cells(r, "td")}</tr>`).join("")}</tbody></table></div>`);
      tableRows = null;
    };
    const inline = (text) => esc(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*(?!\s)([^*]+?)\*/g, "<em>$1</em>");
    for (const raw of lines) {
      const line = raw.trimEnd();
      const trimmed = line.trim();
      if (/^\|.*\|$/.test(trimmed)) {
        closeList();
        const cells = trimmed.slice(1, -1).split("|").map((c) => c.trim());
        if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator row
        (tableRows ||= []).push(cells);
        continue;
      }
      closeTable();
      if (!trimmed) { closeList(); continue; }
      const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
      if (heading) { closeList(); out.push(`<h${heading[1].length + 2}>${inline(heading[2])}</h${heading[1].length + 2}>`); continue; }
      const bullet = trimmed.match(/^[-•]\s+(.+)$/);
      if (bullet) { if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(bullet[1])}</li>`); continue; }
      const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
      if (numbered) { if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(numbered[1])}</li>`); continue; }
      closeList();
      out.push(`<p>${inline(trimmed)}</p>`);
    }
    closeList(); closeTable();
    return out.join("");
  }

  /* ---------- data ---------- */
  async function loadExam(examId) {
    if (ex.cache[examId]) return ex.cache[examId];
    if (!ex.loading[examId]) {
      ex.loading[examId] = fetch(`/data/exams/${examId}.json`).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });
    }
    const data = await ex.loading[examId];
    ex.cache[examId] = data;
    return data;
  }

  async function loadAttempts(force = false) {
    if (ex.attemptsLoaded && !force) return ex.attempts;
    try {
      const rows = await api("/api/exam-attempts");
      ex.attempts = Array.isArray(rows) ? rows : [];
      ex.attemptsLoaded = true;
    } catch {
      ex.attempts = ex.attempts || [];
    }
    return ex.attempts;
  }

  function attemptsFor(examId) {
    return ex.attempts.filter((a) => a.examId === examId);
  }

  /* ---------- scoring ---------- */
  const IELTS_BANDS = [
    [0.975, 9], [0.925, 8.5], [0.875, 8], [0.825, 7.5], [0.75, 7], [0.675, 6.5],
    [0.575, 6], [0.475, 5.5], [0.375, 5], [0.325, 4.5], [0.25, 4], [0.2, 3.5], [0.15, 3],
  ];

  function computeScaled(exam, correct, total, sectionRows, fullMock = false) {
    const pct = total > 0 ? correct / total : 0;
    const type = exam?.scoreScale?.type || "points";
    // For partial attempts a projection to the full-exam scale is misleading — show raw score instead.
    if (!fullMock && (type === "points" || type === "scale100")) {
      return { scaled: Math.round(pct * 100), scaledLabel: `${correct}/${total} · ${Math.round(pct * 100)}%` };
    }
    if (type === "band") {
      // Band conversion is defined for the Reading module; other sections report raw score.
      if (!sectionRows.some((r) => r.sectionId === "reading")) {
        return { scaled: Math.round(pct * 100), scaledLabel: `${correct}/${total} · ${Math.round(pct * 100)}%` };
      }
      let band = 2.5;
      for (const [threshold, value] of IELTS_BANDS) { if (pct >= threshold) { band = value; break; } }
      return { scaled: band, scaledLabel: `Band ${band}` };
    }
    if (type === "sat1600") {
      const sectionScore = (rows) => rows.map((r) => {
        const p = r.total > 0 ? r.correct / r.total : 0;
        return 200 + Math.round((p * 600) / 10) * 10;
      });
      const scores = sectionScore(sectionRows);
      const scaled = scores.reduce((sum, s) => sum + s, 0) + (sectionRows.length === 1 ? 0 : 0);
      if (sectionRows.length >= 2) return { scaled, scaledLabel: `${scaled} / 1600` };
      return { scaled: scores[0] || 0, scaledLabel: `${scores[0] || 0} / 800` };
    }
    if (type === "scale100") {
      const scaled = Math.round(pct * 100);
      return { scaled, scaledLabel: `≈${scaled} / 100` };
    }
    const max = exam?.scoreScale?.max || total;
    const scaled = Math.round(pct * max);
    return { scaled, scaledLabel: `≈${scaled} / ${max}` };
  }

  /* ---------- helpers ---------- */
  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function sectionQuestions(exam, sectionId) {
    return exam.questions.filter((q) => q.sectionId === sectionId);
  }

  // Sample questions for a section; keeps passage groups together.
  function sampleQuestions(exam, sectionId, count) {
    const pool = sectionQuestions(exam, sectionId);
    const withPassage = pool.filter((q) => q.passageId);
    if (!withPassage.length) return shuffle(pool).slice(0, count);
    const groups = new Map();
    for (const q of pool) {
      const key = q.passageId || `solo:${q.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(q);
    }
    const picked = [];
    for (const group of shuffle([...groups.values()])) {
      if (picked.length >= count) break;
      picked.push(...group.slice(0, count - picked.length));
    }
    return picked;
  }

  function normalizeInput(value) {
    return String(value ?? "").trim().toLowerCase().replace(",", ".").replace(/\s+/g, " ");
  }

  function isCorrect(question, answer) {
    if (answer == null) return false;
    if (question.type === "input") {
      const given = normalizeInput(answer);
      if (!given) return false;
      return (question.answers || []).some((a) => normalizeInput(a) === given);
    }
    return Number(answer) === Number(question.correctIndex);
  }

  function formatDuration(totalSec) {
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min >= 60) return `${Math.floor(min / 60)} ${t("ч", "h")} ${min % 60} ${t("мин", "min")}`;
    if (min > 0) return `${min} ${t("мин", "min")}${sec ? ` ${sec} ${t("с", "s")}` : ""}`;
    return `${sec} ${t("с", "s")}`;
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(currentLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  }

  function accentFor(examId) {
    return CATALOG.find((c) => c.id === examId)?.accent || "#5b8cff";
  }

  /* ---------- rendering: root ---------- */
  function rootEl() { return document.getElementById("examsRoot"); }

  function render() {
    const root = rootEl();
    if (!root) return;
    if (ex.view === "detail" && ex.activeExamId && ex.cache[ex.activeExamId]) {
      root.innerHTML = renderDetail(ex.cache[ex.activeExamId]);
    } else {
      root.innerHTML = renderCatalog();
    }
  }

  function bestAttemptLabel(examId) {
    const rows = attemptsFor(examId).filter((a) => a.score?.scaledLabel && a.score.total > 0);
    if (!rows.length) return null;
    const accuracy = (a) => a.score.correct / a.score.total;
    const best = rows.reduce((acc, a) => (acc == null || accuracy(a) > accuracy(acc) ? a : acc), null);
    return best?.score?.scaledLabel || null;
  }

  function renderCatalog() {
    const cards = CATALOG.map((meta) => {
      const exam = ex.cache[meta.id];
      const attempts = attemptsFor(meta.id);
      const best = bestAttemptLabel(meta.id);
      const title = exam ? pick(exam.title) : meta.id.toUpperCase();
      const desc = exam ? pick(exam.description) : "";
      const qCount = exam ? exam.questions.length : null;
      const stats = [
        qCount != null ? `${qCount} ${plural(qCount, QUESTIONS_FORMS)}` : "",
        attempts.length ? `${attempts.length} ${plural(attempts.length, ATTEMPTS_FORMS)}` : t("ещё нет попыток", "no attempts yet"),
        best ? `${t("Лучший", "Best")}: ${best}` : "",
      ].filter(Boolean);
      return `
        <article class="exam-card" data-action="exam-open" data-exam="${meta.id}" style="--exam-accent:${meta.accent}" role="button" tabindex="0">
          <div class="exam-card-head">
            <span class="exam-flag" aria-hidden="true">${meta.flag}</span>
            <h3>${esc(title)}</h3>
          </div>
          <p class="exam-card-desc">${esc(desc)}</p>
          <div class="exam-card-stats">${stats.map((s) => `<span>${esc(s)}</span>`).join("")}</div>
          <span class="exam-card-cta">${t("Открыть", "Open")} →</span>
        </article>`;
    }).join("");
    return `<div class="exam-grid">${cards}</div>`;
  }

  /* ---------- rendering: exam detail ---------- */
  function renderDetail(exam) {
    const attempts = attemptsFor(exam.examId);
    const best = bestAttemptLabel(exam.examId);
    const last = attempts[0];
    const tabs = [
      ["mock", t("Пробный тест", "Mock test")],
      ["practice", t("Практика", "Practice")],
      ["materials", t("Материалы", "Materials")],
      ["results", t("Результаты", "Results")],
    ];
    return `
      <button class="link-button exam-back" data-action="exam-back" type="button">← ${t("Все экзамены", "All exams")}</button>
      <div class="exam-detail-head" style="--exam-accent:${accentFor(exam.examId)}">
        <div>
          <h2>${esc(pick(exam.title))}</h2>
          <p>${esc(pick(exam.description))}</p>
        </div>
        <div class="exam-head-stats">
          ${best ? `<div class="exam-head-stat"><small>${t("Лучший результат", "Best result")}</small><strong>${esc(best)}</strong></div>` : ""}
          ${last ? `<div class="exam-head-stat"><small>${t("Последняя попытка", "Last attempt")}</small><strong>${esc(last.score?.scaledLabel || `${last.score?.correct}/${last.score?.total}`)}</strong></div>` : ""}
          <div class="exam-head-stat"><small>${t("Попыток", "Attempts")}</small><strong>${attempts.length}</strong></div>
        </div>
      </div>
      <div class="exam-tabs">
        ${tabs.map(([id, label]) => `<button class="${ex.tab === id ? "active" : ""}" data-action="exam-tab" data-tab="${id}" type="button">${label}</button>`).join("")}
      </div>
      <div class="exam-tab-content">${renderTab(exam)}</div>`;
  }

  function renderTab(exam) {
    if (ex.tab === "mock") return renderMockTab(exam);
    if (ex.tab === "practice") return renderPracticeTab(exam);
    if (ex.tab === "materials") return renderMaterialsTab(exam);
    if (ex.tab === "results") return renderResultsTab(exam);
    return "";
  }

  function renderMockTab(exam) {
    const totalQuestions = exam.sections.reduce((sum, s) => sum + s.questionsPerAttempt, 0);
    const totalMin = exam.sections.reduce((sum, s) => sum + s.durationMin, 0);
    const sectionRows = exam.sections.map((s) => `
      <div class="exam-section-row">
        <div>
          <strong>${esc(pick(s.title))}</strong>
          <small>${s.questionsPerAttempt} ${plural(s.questionsPerAttempt, QUESTIONS_FORMS)} · ${s.durationMin} ${t("мин", "min")}</small>
        </div>
        <button class="ghost-button" data-action="exam-start-section" data-section="${s.id}" type="button">${t("Начать", "Start")}</button>
      </div>`).join("");
    return `
      <div class="exam-mock-layout">
        <article class="panel exam-full-mock" style="--exam-accent:${accentFor(exam.examId)}">
          <h3>${t("Полный пробный тест", "Full mock test")}</h3>
          <p>${t("Все секции подряд с таймером, как на реальном экзамене.", "All sections in sequence with a timer, just like the real exam.")}</p>
          <div class="exam-full-mock-meta">
            <span>${exam.sections.length} ${t("секций", "sections")}</span>
            <span>${totalQuestions} ${plural(totalQuestions, QUESTIONS_FORMS)}</span>
            <span>${totalMin} ${t("минут", "minutes")}</span>
          </div>
          <button class="primary-button" data-action="exam-start-full" type="button">${t("Начать полный тест", "Start full test")}</button>
        </article>
        <article class="panel">
          <h3>${t("Отдельные секции", "Individual sections")}</h3>
          <p class="exam-muted">${t("Тренируй одну секцию с таймером.", "Practise one timed section.")}</p>
          <div class="exam-section-list">${sectionRows}</div>
        </article>
      </div>`;
  }

  function renderPracticeTab(exam) {
    const weak = weakTopics(exam.examId, 4);
    const sectionCards = exam.sections.map((s) => {
      const total = sectionQuestions(exam, s.id).length;
      const lengths = PRACTICE_LENGTHS.filter((n) => n <= total);
      if (!lengths.length && total) lengths.push(total);
      return `
        <div class="exam-section-row">
          <div>
            <strong>${esc(pick(s.title))}</strong>
            <small>${total} ${plural(total, QUESTIONS_FORMS)} ${t("в банке", "in bank")}</small>
          </div>
          <div class="exam-practice-actions">
            ${lengths.map((n) => `<button class="ghost-button" data-action="exam-start-practice" data-section="${s.id}" data-count="${Math.min(n, total)}" type="button">${Math.min(n, total)}</button>`).join("")}
          </div>
        </div>`;
    }).join("");
    const weakBlock = weak.length ? `
      <article class="panel exam-weak-panel">
        <h3>${t("Слабые темы", "Weak topics")}</h3>
        <p class="exam-muted">${t("По результатам твоих попыток. Нажми, чтобы тренировать тему.", "Based on your attempts. Click a topic to practise it.")}</p>
        <div class="exam-weak-list">
          ${weak.map((w) => `
            <button class="exam-weak-chip" data-action="exam-practice-topic" data-topic="${esc(w.topic)}" data-section="${esc(w.sectionId)}" type="button">
              <span>${esc(w.topic)}</span><small>${Math.round(w.accuracy * 100)}%</small>
            </button>`).join("")}
        </div>
      </article>` : "";
    return `
      <div class="exam-practice-layout">
        <article class="panel">
          <h3>${t("Практика без таймера", "Untimed practice")}</h3>
          <p class="exam-muted">${t("Мгновенная проверка и объяснение после каждого вопроса.", "Instant feedback with an explanation after every question.")}</p>
          <div class="exam-section-list">${sectionCards}</div>
        </article>
        ${weakBlock}
      </div>`;
  }

  function renderMaterialsTab(exam) {
    const items = (exam.materials || []).map((m) => {
      const open = ex.openMaterialId === m.id;
      return `
        <article class="exam-material ${open ? "open" : ""}">
          <button class="exam-material-head" data-action="exam-material" data-material="${m.id}" type="button" aria-expanded="${open}">
            <strong>${esc(pick(m.title))}</strong>
            <svg class="chevron"><use href="#i-chevron"></use></svg>
          </button>
          ${open ? `<div class="exam-material-body md-body">${renderMarkdown(pick(m.body))}</div>` : ""}
        </article>`;
    }).join("");
    return `<div class="exam-materials">${items || `<p class="exam-muted">${t("Материалы скоро появятся.", "Materials coming soon.")}</p>`}</div>`;
  }

  /* ---------- results tab ---------- */
  function topicStats(examId) {
    const map = new Map();
    for (const attempt of attemptsFor(examId)) {
      for (const row of attempt.topics || []) {
        const key = `${row.sectionId}::${row.topic}`;
        const entry = map.get(key) || { topic: row.topic, sectionId: row.sectionId, correct: 0, total: 0 };
        entry.correct += row.correct;
        entry.total += row.total;
        map.set(key, entry);
      }
    }
    return [...map.values()].map((e) => ({ ...e, accuracy: e.total ? e.correct / e.total : 0 }));
  }

  function weakTopics(examId, limit = 6) {
    return topicStats(examId)
      .filter((e) => e.total >= 3 && e.accuracy < 0.75)
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, limit);
  }

  function renderScoreChart(attempts) {
    const rows = attempts.slice(0, 20).reverse().filter((a) => a.score && a.score.total > 0);
    if (rows.length < 2) return "";
    const width = 560, height = 140, pad = 10;
    const values = rows.map((a) => a.score.correct / a.score.total);
    const min = Math.max(0, Math.min(...values) - 0.08);
    const max = Math.min(1, Math.max(...values) + 0.08);
    const x = (i) => pad + (i * (width - pad * 2)) / Math.max(1, rows.length - 1);
    const y = (v) => height - pad - ((v - min) * (height - pad * 2)) / Math.max(0.001, max - min);
    const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const dots = values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5"><title>${rows[i].score.scaledLabel || Math.round(v * 100) + "%"}</title></circle>`).join("");
    return `
      <div class="exam-chart-wrap">
        <svg class="exam-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${t("Динамика результатов", "Score trend")}">
          <polyline points="${points}" fill="none"></polyline>
          ${dots}
        </svg>
        <div class="exam-chart-caption">${t("Точность по попыткам (старые → новые)", "Accuracy per attempt (oldest → newest)")}</div>
      </div>`;
  }

  function renderResultsTab(exam) {
    const attempts = attemptsFor(exam.examId);
    if (!attempts.length) {
      return `
        <div class="exam-empty">
          <p>${t("Пока нет ни одной попытки. Пройди пробный тест — результаты появятся здесь.", "No attempts yet. Take a mock test and your results will appear here.")}</p>
          <button class="primary-button" data-action="exam-tab" data-tab="mock" type="button">${t("К пробному тесту", "Go to mock test")}</button>
        </div>`;
    }
    const totalCorrect = attempts.reduce((sum, a) => sum + (a.score?.correct || 0), 0);
    const totalAnswered = attempts.reduce((sum, a) => sum + (a.score?.total || 0), 0);
    const avg = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    const best = bestAttemptLabel(exam.examId);
    const weak = weakTopics(exam.examId);
    const sectionTitle = (sectionId) => pick(exam.sections.find((s) => s.id === sectionId)?.title) || sectionId;
    const modeLabel = { full: t("Полный тест", "Full test"), section: t("Секция", "Section"), practice: t("Практика", "Practice") };
    const rows = attempts.map((a) => `
      <tr>
        <td>${esc(formatDate(a.createdAt))}</td>
        <td>${esc(modeLabel[a.mode] || a.mode)}<small class="exam-row-sections">${(a.sections || []).map((s) => esc(sectionTitle(s.sectionId))).join(", ")}</small></td>
        <td><strong>${esc(a.score?.scaledLabel || "—")}</strong></td>
        <td>${a.score?.correct}/${a.score?.total} (${a.score?.total ? Math.round((a.score.correct / a.score.total) * 100) : 0}%)</td>
        <td>${esc(formatDuration(a.durationSec || 0))}</td>
        <td><button class="icon-button exam-delete-attempt" data-action="exam-delete-attempt" data-id="${a.id}" type="button" aria-label="${t("Удалить попытку", "Delete attempt")}"><svg><use href="#i-x"></use></svg></button></td>
      </tr>`).join("");
    return `
      <div class="exam-results">
        <div class="exam-stat-row">
          <div class="exam-stat-tile"><small>${t("Попыток", "Attempts")}</small><strong>${attempts.length}</strong></div>
          <div class="exam-stat-tile"><small>${t("Средняя точность", "Average accuracy")}</small><strong>${avg}%</strong></div>
          ${best ? `<div class="exam-stat-tile"><small>${t("Лучший результат", "Best result")}</small><strong>${esc(best)}</strong></div>` : ""}
        </div>
        ${renderScoreChart(attempts)}
        ${weak.length ? `
          <article class="panel exam-weak-panel">
            <h3>${t("Слабые темы", "Weak topics")}</h3>
            <div class="exam-weak-list">
              ${weak.map((w) => `
                <button class="exam-weak-chip" data-action="exam-practice-topic" data-topic="${esc(w.topic)}" data-section="${esc(w.sectionId)}" type="button">
                  <span>${esc(w.topic)}</span><small>${Math.round(w.accuracy * 100)}% · ${w.correct}/${w.total}</small>
                </button>`).join("")}
            </div>
          </article>` : ""}
        <div class="md-table-wrap">
          <table class="exam-attempts-table">
            <thead><tr><th>${t("Дата", "Date")}</th><th>${t("Режим", "Mode")}</th><th>${t("Балл", "Score")}</th><th>${t("Верно", "Correct")}</th><th>${t("Время", "Time")}</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }

  /* ---------- test runner ---------- */
  function buildRunner(exam, sectionIds, { practice = false, count = null, topic = null } = {}) {
    const sections = [];
    for (const sectionId of sectionIds) {
      const sectionMeta = exam.sections.find((s) => s.id === sectionId);
      if (!sectionMeta) continue;
      let questions;
      if (topic) {
        const pool = sectionQuestions(exam, sectionId).filter((q) => (q.topic || "") === topic);
        questions = shuffle(pool).slice(0, count || 10);
      } else {
        questions = sampleQuestions(exam, sectionId, count || sectionMeta.questionsPerAttempt);
      }
      if (!questions.length) continue;
      sections.push({
        meta: sectionMeta,
        questions,
        durationSec: practice ? 0 : sectionMeta.durationMin * 60,
      });
    }
    if (!sections.length) return null;
    return {
      exam,
      practice,
      topic,
      sections,
      sectionIndex: 0,
      questionIndex: 0,
      answers: new Map(),      // question.id -> { value, flagged, checked (practice) }
      startedAt: Date.now(),
      sectionDeadline: practice ? null : Date.now() + sections[0].durationSec * 1000,
      timerId: null,
      finished: false,
      review: false,
      savedAttempt: null,
      fullMock: !practice && sectionIds.length === exam.sections.length,
    };
  }

  function startRunner(runner) {
    if (!runner) { toast(t("Недостаточно вопросов для теста", "Not enough questions for a test")); return; }
    ex.runner = runner;
    document.body.classList.add("exam-running");
    renderRunner();
    if (!runner.practice) {
      runner.timerId = setInterval(() => {
        if (!ex.runner || ex.runner.finished) return;
        const left = Math.round((ex.runner.sectionDeadline - Date.now()) / 1000);
        if (left <= 0) {
          finishSection(true);
        } else {
          const label = document.getElementById("examTimer");
          if (label) {
            label.textContent = timerText(left);
            label.classList.toggle("danger", left <= 60);
          }
        }
      }, 1000);
    }
  }

  function timerText(totalSec) {
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function currentSection() { return ex.runner?.sections[ex.runner.sectionIndex]; }
  function currentQuestion() { return currentSection()?.questions[ex.runner.questionIndex]; }

  function answerFor(qid) {
    if (!ex.runner.answers.has(qid)) ex.runner.answers.set(qid, { value: null, flagged: false, checked: false });
    return ex.runner.answers.get(qid);
  }

  function stopRunner() {
    if (ex.runner?.timerId) clearInterval(ex.runner.timerId);
    ex.runner = null;
    document.body.classList.remove("exam-running");
    const overlay = document.getElementById("examRunnerOverlay");
    if (overlay) overlay.remove();
  }

  async function exitRunner() {
    const runner = ex.runner;
    if (!runner) return;
    if (!runner.finished && runner.answers.size > 0) {
      const sure = typeof confirmAction === "function"
        ? await confirmAction({
            title: t("Выйти из теста?", "Leave the test?"),
            text: t("Прогресс этой попытки будет потерян.", "Progress of this attempt will be lost."),
            okText: t("Выйти", "Leave"),
          })
        : window.confirm(t("Выйти из теста? Прогресс будет потерян.", "Leave the test? Progress will be lost."));
      if (!sure) return;
    }
    stopRunner();
    render();
  }

  function goToQuestion(index) {
    const section = currentSection();
    if (!section) return;
    ex.runner.questionIndex = Math.max(0, Math.min(index, section.questions.length - 1));
    renderRunner();
  }

  function finishSection(auto = false) {
    const runner = ex.runner;
    if (!runner) return;
    if (runner.sectionIndex < runner.sections.length - 1) {
      runner.sectionIndex += 1;
      runner.questionIndex = 0;
      const next = runner.sections[runner.sectionIndex];
      runner.sectionDeadline = Date.now() + next.durationSec * 1000;
      if (auto) toast(t("Время секции вышло — переходим дальше", "Section time is up — moving on"));
      renderRunner();
    } else {
      finishRun(auto);
    }
  }

  async function finishRun(auto = false) {
    const runner = ex.runner;
    if (!runner || runner.finished) return;
    runner.finished = true;
    if (runner.timerId) clearInterval(runner.timerId);
    if (auto) toast(t("Время вышло", "Time is up"));

    // score
    const sectionRows = runner.sections.map((s) => {
      let correct = 0;
      for (const q of s.questions) if (isCorrect(q, ex.runner.answers.get(q.id)?.value)) correct += 1;
      return { sectionId: s.meta.id, correct, total: s.questions.length };
    });
    const topicMap = new Map();
    for (const s of runner.sections) {
      for (const q of s.questions) {
        const key = `${s.meta.id}::${q.topic || ""}`;
        const entry = topicMap.get(key) || { topic: q.topic || t("Прочее", "Other"), sectionId: s.meta.id, correct: 0, total: 0 };
        entry.total += 1;
        if (isCorrect(q, runner.answers.get(q.id)?.value)) entry.correct += 1;
        topicMap.set(key, entry);
      }
    }
    const correct = sectionRows.reduce((sum, r) => sum + r.correct, 0);
    const total = sectionRows.reduce((sum, r) => sum + r.total, 0);
    const { scaled, scaledLabel } = computeScaled(runner.exam, correct, total, sectionRows, runner.fullMock);
    const durationSec = Math.round((Date.now() - runner.startedAt) / 1000);
    const attempt = {
      examId: runner.exam.examId,
      mode: runner.practice ? "practice" : (runner.fullMock ? "full" : "section"),
      sections: sectionRows,
      topics: [...topicMap.values()],
      score: { correct, total, scaled, scaledLabel },
      durationSec,
    };
    runner.result = { ...attempt, createdAt: new Date().toISOString() };
    renderRunner(); // show result screen immediately
    try {
      const saved = await api("/api/exam-attempts", { method: "POST", body: attempt });
      runner.savedAttempt = saved;
      await loadAttempts(true);
    } catch {
      toast(t("Не удалось сохранить результат", "Could not save the result"));
    }
  }

  /* ---------- runner rendering ---------- */
  function ensureOverlay() {
    let overlay = document.getElementById("examRunnerOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "examRunnerOverlay";
      overlay.className = "exam-runner-overlay";
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function renderRunner() {
    const runner = ex.runner;
    if (!runner) return;
    const overlay = ensureOverlay();
    if (runner.finished) {
      overlay.innerHTML = runner.review ? renderReview(runner) : renderResultScreen(runner);
      overlay.scrollTop = 0;
      return;
    }
    const section = currentSection();
    const question = currentQuestion();
    const answer = answerFor(question.id);
    const passage = question.passageId ? (runner.exam.passages || []).find((p) => p.id === question.passageId) : null;
    const index = runner.questionIndex;
    const count = section.questions.length;
    const left = runner.practice ? null : Math.max(0, Math.round((runner.sectionDeadline - Date.now()) / 1000));

    const palette = section.questions.map((q, i) => {
      const a = runner.answers.get(q.id);
      const cls = [
        i === index ? "current" : "",
        a?.value != null && a.value !== "" ? "answered" : "",
        a?.flagged ? "flagged" : "",
      ].filter(Boolean).join(" ");
      return `<button class="exam-dot ${cls}" data-action="exam-goto" data-index="${i}" type="button" aria-label="${t("Вопрос", "Question")} ${i + 1}">${i + 1}</button>`;
    }).join("");

    let body;
    if (question.type === "input") {
      const checked = runner.practice && answer.checked;
      body = `
        <input class="exam-input" id="examInputAnswer" type="text" autocomplete="off"
          placeholder="${t("Введи ответ", "Type your answer")}" value="${esc(answer.value ?? "")}" ${checked ? "disabled" : ""}>
        ${runner.practice && !checked ? `<button class="primary-button exam-check-btn" data-action="exam-check" type="button">${t("Проверить", "Check")}</button>` : ""}`;
    } else {
      body = `<div class="exam-choices">${question.choices.map((choice, i) => {
        const isPicked = Number(answer.value) === i && answer.value != null;
        let cls = isPicked ? "picked" : "";
        if (runner.practice && answer.checked) {
          if (i === question.correctIndex) cls = "correct";
          else if (isPicked) cls = "wrong";
        }
        return `<button class="exam-choice ${cls}" data-action="exam-choice" data-index="${i}" type="button" ${runner.practice && answer.checked ? "disabled" : ""}>
          <span class="exam-choice-letter">${String.fromCharCode(65 + i)}</span>
          <span>${esc(choice)}</span>
        </button>`;
      }).join("")}</div>`;
    }

    const feedback = runner.practice && answer.checked ? `
      <div class="exam-feedback ${isCorrect(question, answer.value) ? "ok" : "bad"}">
        <strong>${isCorrect(question, answer.value) ? t("Верно! 🎉", "Correct! 🎉") : t("Неверно", "Incorrect")}</strong>
        ${question.type === "input" && !isCorrect(question, answer.value) ? `<p>${t("Правильный ответ", "Correct answer")}: <strong>${esc((question.answers || [])[0] || "")}</strong></p>` : ""}
        ${question.explanation ? `<p>${esc(question.explanation)}</p>` : ""}
      </div>` : "";

    const isLastQuestion = index === count - 1;
    const nextLabel = runner.practice
      ? (isLastQuestion ? t("Завершить", "Finish") : t("Далее", "Next"))
      : (isLastQuestion ? "" : t("Далее", "Next"));

    overlay.innerHTML = `
      <div class="exam-runner">
        <header class="exam-runner-head">
          <div class="exam-runner-title">
            <strong>${esc(pick(runner.exam.title))}</strong>
            <span>${esc(pick(section.meta.title))}${runner.topic ? ` · ${esc(runner.topic)}` : ""}</span>
          </div>
          ${runner.practice ? `<span class="exam-progress-label">${index + 1} / ${count}</span>` : `<span class="exam-timer" id="examTimer">${timerText(left)}</span>`}
          <button class="icon-button" data-action="exam-exit" type="button" aria-label="${t("Выйти", "Exit")}"><svg><use href="#i-x"></use></svg></button>
        </header>
        <div class="exam-progressbar"><span style="width:${((index + 1) / count) * 100}%"></span></div>
        <div class="exam-runner-body ${passage ? "with-passage" : ""}">
          ${passage ? `<aside class="exam-passage"><h4>${esc(passage.title || "")}</h4><div>${esc(passage.text).replace(/\n/g, "<br>")}</div></aside>` : ""}
          <div class="exam-question-panel">
            <div class="exam-question-meta">
              <span>${t("Вопрос", "Question")} ${index + 1} ${t("из", "of")} ${count}</span>
              ${question.topic ? `<span class="exam-topic-pill">${esc(question.topic)}</span>` : ""}
              ${!runner.practice ? `<button class="exam-flag ${answer.flagged ? "on" : ""}" data-action="exam-flag" type="button">${answer.flagged ? "🚩 " + t("Помечен", "Flagged") : "⚑ " + t("Пометить", "Flag")}</button>` : ""}
            </div>
            <div class="exam-question-text">${esc(question.text).replace(/\n/g, "<br>")}</div>
            ${body}
            ${feedback}
          </div>
        </div>
        <footer class="exam-runner-foot">
          <button class="ghost-button" data-action="exam-prev" type="button" ${index === 0 ? "disabled" : ""}>← ${t("Назад", "Back")}</button>
          <div class="exam-palette">${runner.practice ? "" : palette}</div>
          ${nextLabel ? `<button class="primary-button" data-action="exam-next" type="button" ${runner.practice && !answer.checked && answer.value != null && question.type !== "input" ? "" : ""}>${nextLabel} →</button>` : ""}
          ${!runner.practice && isLastQuestion ? `<button class="primary-button" data-action="exam-finish-section" type="button">${runner.sectionIndex < runner.sections.length - 1 ? t("Следующая секция", "Next section") : t("Завершить тест", "Finish test")}</button>` : ""}
        </footer>
      </div>`;

    const input = document.getElementById("examInputAnswer");
    if (input) {
      input.addEventListener("input", () => { answerFor(question.id).value = input.value; });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (runner.practice && !answerFor(question.id).checked) checkPracticeAnswer();
          else advance();
        }
      });
      if (!(runner.practice && answer.checked)) input.focus();
    }
  }

  function renderResultScreen(runner) {
    const result = runner.result;
    const pct = result.score.total ? Math.round((result.score.correct / result.score.total) * 100) : 0;
    const sectionTitle = (sectionId) => pick(runner.exam.sections.find((s) => s.id === sectionId)?.title) || sectionId;
    const sectionRows = result.sections.map((r) => {
      const p = r.total ? Math.round((r.correct / r.total) * 100) : 0;
      return `
        <div class="exam-result-section">
          <div class="exam-result-section-head"><span>${esc(sectionTitle(r.sectionId))}</span><strong>${r.correct}/${r.total}</strong></div>
          <div class="exam-bar"><span style="width:${p}%"></span></div>
        </div>`;
    }).join("");
    const weakRows = (result.topics || []).filter((row) => row.total >= 2 && row.correct / row.total < 0.75)
      .sort((a, b) => a.correct / a.total - b.correct / b.total).slice(0, 5);
    return `
      <div class="exam-runner exam-result-screen">
        <header class="exam-runner-head">
          <div class="exam-runner-title"><strong>${esc(pick(runner.exam.title))}</strong><span>${t("Результат", "Result")}</span></div>
          <button class="icon-button" data-action="exam-close-result" type="button" aria-label="${t("Закрыть", "Close")}"><svg><use href="#i-x"></use></svg></button>
        </header>
        <div class="exam-result-body">
          <div class="exam-result-hero" style="--exam-accent:${accentFor(runner.exam.examId)}">
            <div class="exam-result-score">
              <strong>${esc(result.score.scaledLabel || `${pct}%`)}</strong>
              <span>${result.score.correct} ${t("из", "of")} ${result.score.total} · ${pct}%</span>
              <small>${t("Время", "Time")}: ${esc(formatDuration(result.durationSec))}</small>
            </div>
            <div class="exam-result-ring" style="--pct:${pct}"><span>${pct}%</span></div>
          </div>
          <div class="exam-result-sections">${sectionRows}</div>
          ${weakRows.length ? `
            <div class="exam-result-weak">
              <h4>${t("Что подтянуть", "What to improve")}</h4>
              ${weakRows.map((row) => `<div class="exam-result-weak-row"><span>${esc(row.topic)}</span><small>${row.correct}/${row.total}</small></div>`).join("")}
            </div>` : ""}
          <div class="exam-result-actions">
            <button class="ghost-button" data-action="exam-review" type="button">${t("Разбор ответов", "Review answers")}</button>
            <button class="primary-button" data-action="exam-close-result" type="button">${t("Готово", "Done")}</button>
          </div>
        </div>
      </div>`;
  }

  function renderReview(runner) {
    const blocks = runner.sections.map((s) => {
      const items = s.questions.map((q, i) => {
        const a = runner.answers.get(q.id);
        const ok = isCorrect(q, a?.value);
        let givenLabel;
        if (q.type === "input") givenLabel = a?.value ? String(a.value) : t("нет ответа", "no answer");
        else givenLabel = a?.value != null ? `${String.fromCharCode(65 + Number(a.value))}. ${q.choices[a.value]}` : t("нет ответа", "no answer");
        const correctLabel = q.type === "input" ? (q.answers || [])[0] : `${String.fromCharCode(65 + q.correctIndex)}. ${q.choices[q.correctIndex]}`;
        return `
          <details class="exam-review-item ${ok ? "ok" : "bad"}">
            <summary><span class="exam-review-mark">${ok ? "✓" : "✕"}</span><span class="exam-review-q">${i + 1}. ${esc(q.text.slice(0, 140))}${q.text.length > 140 ? "…" : ""}</span></summary>
            <div class="exam-review-detail">
              <p class="exam-review-full">${esc(q.text).replace(/\n/g, "<br>")}</p>
              <p><strong>${t("Твой ответ", "Your answer")}:</strong> ${esc(givenLabel)}</p>
              ${!ok ? `<p><strong>${t("Правильный ответ", "Correct answer")}:</strong> ${esc(correctLabel)}</p>` : ""}
              ${q.explanation ? `<p class="exam-review-expl">${esc(q.explanation)}</p>` : ""}
            </div>
          </details>`;
      }).join("");
      return `<section class="exam-review-section"><h4>${esc(pick(s.meta.title))}</h4>${items}</section>`;
    }).join("");
    return `
      <div class="exam-runner exam-review-screen">
        <header class="exam-runner-head">
          <div class="exam-runner-title"><strong>${esc(pick(runner.exam.title))}</strong><span>${t("Разбор ответов", "Answer review")}</span></div>
          <button class="icon-button" data-action="exam-back-result" type="button" aria-label="${t("Назад", "Back")}"><svg><use href="#i-x"></use></svg></button>
        </header>
        <div class="exam-review-body">${blocks}</div>
        <footer class="exam-runner-foot exam-review-foot">
          <button class="ghost-button" data-action="exam-back-result" type="button">← ${t("К результату", "Back to result")}</button>
          <button class="primary-button" data-action="exam-close-result" type="button">${t("Готово", "Done")}</button>
        </footer>
      </div>`;
  }

  /* ---------- runner interactions ---------- */
  function checkPracticeAnswer() {
    const question = currentQuestion();
    const answer = answerFor(question.id);
    if (answer.value == null || answer.value === "") { toast(t("Сначала выбери ответ", "Pick an answer first")); return; }
    answer.checked = true;
    renderRunner();
  }

  function advance() {
    const runner = ex.runner;
    const section = currentSection();
    if (runner.questionIndex < section.questions.length - 1) {
      goToQuestion(runner.questionIndex + 1);
    } else if (runner.practice) {
      finishRun();
    } else {
      finishSection();
    }
  }

  /* ---------- dashboard widget ---------- */
  function renderDashboardWidget() {
    const box = document.getElementById("dashboardExams");
    if (!box) return;
    if (!ex.attemptsLoaded) {
      loadAttempts().then(() => renderDashboardWidget()).catch(() => {});
      return;
    }
    if (!ex.attempts.length) {
      box.innerHTML = `
        <div class="exam-dash-empty">
          <p>${t("Готовишься к ЕНТ, ЕГЭ, IELTS или SAT? Пройди первый пробный тест и следи за прогрессом здесь.", "Preparing for UNT, EGE, IELTS or SAT? Take your first mock test and track your progress here.")}</p>
          <div class="exam-dash-links">
            ${CATALOG.map((c) => `<button class="ghost-button" data-action="exam-open" data-exam="${c.id}" type="button">${c.flag} ${pick(c.name)}</button>`).join("")}
          </div>
        </div>`;
      return;
    }
    const byExam = CATALOG.map((meta) => {
      const rows = attemptsFor(meta.id);
      if (!rows.length) return null;
      const last = rows[0];
      const best = bestAttemptLabel(meta.id);
      const totalCorrect = rows.reduce((sum, a) => sum + (a.score?.correct || 0), 0);
      const totalAll = rows.reduce((sum, a) => sum + (a.score?.total || 0), 0);
      const accuracy = totalAll ? Math.round((totalCorrect / totalAll) * 100) : 0;
      return { meta, rows, last, best, accuracy };
    }).filter(Boolean);
    box.innerHTML = byExam.map(({ meta, rows, last, best, accuracy }) => `
      <button class="exam-dash-row" data-action="exam-open" data-exam="${meta.id}" type="button" style="--exam-accent:${meta.accent}">
        <span class="exam-flag">${meta.flag}</span>
        <span class="exam-dash-info">
          <strong>${esc(pick(ex.cache[meta.id]?.title) || pick(meta.name))}</strong>
          <small>${rows.length} ${plural(rows.length, ATTEMPTS_FORMS)} · ${t("последняя", "last")}: ${esc(last.score?.scaledLabel || "—")}${best ? ` · ${t("лучшая", "best")}: ${esc(best)}` : ""}</small>
        </span>
        <span class="exam-dash-bar"><span class="exam-bar"><span style="width:${accuracy}%"></span></span><small>${accuracy}%</small></span>
      </button>`).join("");
  }

  /* ---------- events ---------- */
  document.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action^='exam-']");
    if (!target) return;
    const action = target.dataset.action;

    if (action === "exam-open") {
      const examId = target.dataset.exam;
      ex.view = "detail";
      ex.activeExamId = examId;
      ex.tab = "mock";
      ex.openMaterialId = null;
      const routeHidden = document.getElementById("route-exams")?.classList.contains("hidden");
      if (routeHidden && typeof setActiveRoute === "function") setActiveRoute("exams");
      render(); // show whatever we have; then load
      try {
        await Promise.all([loadExam(examId), loadAttempts()]);
        render();
      } catch {
        toast(t("Не удалось загрузить данные экзамена", "Could not load exam data"));
        ex.view = "catalog";
        render();
      }
      return;
    }
    if (action === "exam-back") { ex.view = "catalog"; render(); return; }
    if (action === "exam-tab") { ex.tab = target.dataset.tab; render(); return; }
    if (action === "exam-material") {
      ex.openMaterialId = ex.openMaterialId === target.dataset.material ? null : target.dataset.material;
      render();
      return;
    }

    const exam = ex.activeExamId ? ex.cache[ex.activeExamId] : null;
    if (action === "exam-start-full" && exam) {
      startRunner(buildRunner(exam, exam.sections.map((s) => s.id)));
      return;
    }
    if (action === "exam-start-section" && exam) {
      startRunner(buildRunner(exam, [target.dataset.section]));
      return;
    }
    if (action === "exam-start-practice" && exam) {
      startRunner(buildRunner(exam, [target.dataset.section], { practice: true, count: Number(target.dataset.count) || 10 }));
      return;
    }
    if (action === "exam-practice-topic" && exam) {
      startRunner(buildRunner(exam, [target.dataset.section], { practice: true, count: 10, topic: target.dataset.topic }));
      return;
    }
    if (action === "exam-delete-attempt") {
      const id = target.dataset.id;
      const sure = typeof confirmAction === "function"
        ? await confirmAction({ title: t("Удалить попытку?", "Delete attempt?"), text: t("Запись о результате будет удалена.", "This result record will be removed."), okText: t("Удалить", "Delete") })
        : window.confirm(t("Удалить попытку?", "Delete attempt?"));
      if (!sure) return;
      try {
        await api(`/api/exam-attempts/${id}`, { method: "DELETE" });
        await loadAttempts(true);
        render();
      } catch { toast(t("Не удалось удалить", "Could not delete")); }
      return;
    }

    // runner actions
    if (!ex.runner) return;
    if (action === "exam-exit") { exitRunner(); return; }
    if (action === "exam-choice") {
      const question = currentQuestion();
      const answer = answerFor(question.id);
      if (ex.runner.practice && answer.checked) return;
      answer.value = Number(target.dataset.index);
      if (ex.runner.practice) { answer.checked = true; renderRunner(); }
      else renderRunner();
      return;
    }
    if (action === "exam-check") { checkPracticeAnswer(); return; }
    if (action === "exam-flag") {
      const answer = answerFor(currentQuestion().id);
      answer.flagged = !answer.flagged;
      renderRunner();
      return;
    }
    if (action === "exam-prev") { goToQuestion(ex.runner.questionIndex - 1); return; }
    if (action === "exam-next") { advance(); return; }
    if (action === "exam-goto") { goToQuestion(Number(target.dataset.index)); return; }
    if (action === "exam-finish-section") {
      const unanswered = currentSection().questions.filter((q) => {
        const a = ex.runner.answers.get(q.id);
        return a?.value == null || a.value === "";
      }).length;
      if (unanswered > 0) {
        const sure = typeof confirmAction === "function"
          ? await confirmAction({
              title: t("Завершить секцию?", "Finish the section?"),
              text: `${t("Без ответа", "Unanswered")}: ${unanswered}. ${t("Вернуться будет нельзя.", "You won't be able to return.")}`,
              okText: t("Завершить", "Finish"),
            })
          : window.confirm(t("Есть вопросы без ответа. Завершить?", "There are unanswered questions. Finish?"));
        if (!sure) return;
      }
      finishSection();
      return;
    }
    if (action === "exam-review") { ex.runner.review = true; renderRunner(); return; }
    if (action === "exam-back-result") { ex.runner.review = false; renderRunner(); return; }
    if (action === "exam-close-result") {
      stopRunner();
      ex.tab = "results";
      render();
      return;
    }
  });

  // keyboard shortcuts inside the runner
  document.addEventListener("keydown", (event) => {
    if (!ex.runner || ex.runner.finished) return;
    if (event.target.matches("input, textarea")) return;
    const question = currentQuestion();
    if (!question) return;
    if (question.type !== "input" && /^[1-9]$/.test(event.key)) {
      const i = Number(event.key) - 1;
      if (i < question.choices.length) {
        const answer = answerFor(question.id);
        if (!(ex.runner.practice && answer.checked)) {
          answer.value = i;
          if (ex.runner.practice) answer.checked = true;
          renderRunner();
        }
      }
    } else if (event.key === "ArrowRight") { advance(); }
    else if (event.key === "ArrowLeft") { goToQuestion(ex.runner.questionIndex - 1); }
  });

  /* ---------- public API ---------- */
  window.StudyExams = {
    async onEnter() {
      render();
      try {
        await loadAttempts();
        // Preload catalog metadata lazily (titles/descriptions/counts on cards)
        await Promise.all(CATALOG.map((c) => loadExam(c.id).catch(() => null)));
        render();
      } catch { /* keep whatever rendered */ }
    },
    refresh() {
      // called on renderAll (language switch / data reload)
      const route = document.getElementById("route-exams");
      if (route && !route.classList.contains("hidden")) render();
      renderDashboardWidget();
      if (ex.runner) renderRunner();
    },
    invalidateAttempts() { ex.attemptsLoaded = false; },
    // used by dashboard widget
    getAttempts() { return ex.attempts; },
  };
})();
