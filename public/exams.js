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
  const RUNNER_STORE_KEY = "studyExamRunner";

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
      // revalidate so a rebuilt question bank is picked up instead of a stale cached copy
      ex.loading[examId] = fetch(`/data/exams/${examId}.json`, { cache: "no-cache" }).then((res) => {
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
      // Band conversion is defined for Reading and Listening; other sections report raw score.
      if (!sectionRows.some((r) => r.sectionId === "reading" || r.sectionId === "listening")) {
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
    // IELTS Listening runs Part 1 → 4 in order of difficulty, so for a full
    // sitting pick one recording per part and keep that order. Other
    // passage-based sections just take whole passages at random.
    const partOf = (group) => {
      const passage = (exam.passages || []).find((x) => x.id === group[0]?.passageId);
      const match = /Part\s*(\d)/i.exec(passage?.title || "");
      return match ? Number(match[1]) : null;
    };
    let ordered = shuffle([...groups.values()]);
    // Only recordings carry a part number; stray passage-less questions must not
    // disable the ordering for the whole section.
    const recordings = ordered.filter((g) => g[0]?.passageId);
    if (sectionId === "listening" && recordings.length && recordings.every((g) => partOf(g))) {
      ordered = recordings;
      const byPart = new Map();
      for (const group of ordered) {
        const part = partOf(group);
        if (!byPart.has(part)) byPart.set(part, group); // first after shuffle = random pick per part
      }
      ordered = [...byPart.keys()].sort((a, b) => a - b).map((part) => byPart.get(part));
    }
    // Take whole passages: a reading text with a single orphan question is
    // worse than slightly fewer questions. Only the last group is ever trimmed,
    // and only when it would otherwise contribute less than half its questions.
    const picked = [];
    for (const group of ordered) {
      if (picked.length >= count) break;
      const room = count - picked.length;
      if (room < group.length && room < Math.ceil(group.length / 2)) break;
      picked.push(...group.slice(0, room));
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
    if (question.type === "multi") {
      if (!Array.isArray(answer) || !answer.length) return false;
      const given = [...answer].map(Number).sort((a, b) => a - b);
      const correct = [...(question.correctIndices || [])].map(Number).sort((a, b) => a - b);
      return given.length === correct.length && given.every((v, i) => v === correct[i]);
    }
    return Number(answer) === Number(question.correctIndex);
  }

  // "Is there an answer worth counting?" — handles strings, numbers and multi-select arrays
  function hasAnswer(entry) {
    if (!entry || entry.value == null || entry.value === "") return false;
    if (Array.isArray(entry.value)) return entry.value.length > 0;
    return true;
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

  /* ---------- listening: browser TTS "audio" playback ---------- */
  const MAX_AUDIO_PLAYS = 2;
  const tts = { active: false, passageId: null, chunkIndex: 0, chunks: [] };

  function ttsSupported() { return "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"; }

  function scriptToChunks(script) {
    // Strip "SPEAKER:" labels and split into short utterances (Chrome cuts off long ones)
    const lines = String(script).split("\n").map((l) => l.trim()).filter(Boolean)
      .map((l) => l.replace(/^[A-ZÀ-ß][\w .'-]{0,25}:\s*/u, ""));
    const chunks = [];
    for (const line of lines) {
      const sentences = line.match(/[^.!?]+[.!?]+["']?|\S[^.!?]*$/g) || [line];
      let buffer = "";
      for (const sentence of sentences) {
        if ((buffer + sentence).length > 180 && buffer) { chunks.push(buffer.trim()); buffer = sentence; }
        else buffer += sentence;
      }
      if (buffer.trim()) chunks.push(buffer.trim());
    }
    return chunks;
  }

  function pickEnglishVoice() {
    const voices = window.speechSynthesis.getVoices() || [];
    return voices.find((v) => /^en[-_](GB|US)/i.test(v.lang) && /female|natural|google/i.test(v.name))
      || voices.find((v) => /^en[-_](GB|US)/i.test(v.lang))
      || voices.find((v) => v.lang?.toLowerCase().startsWith("en"))
      || null;
  }

  function stopAudio() {
    tts.active = false;
    tts.chunks = [];
    if (ttsSupported()) window.speechSynthesis.cancel();
    updateAudioUi();
  }

  function speakNextChunk() {
    if (!tts.active || tts.chunkIndex >= tts.chunks.length) {
      tts.active = false;
      updateAudioUi();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(tts.chunks[tts.chunkIndex]);
    const voice = pickEnglishVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || "en-US";
    utterance.rate = 0.95;
    utterance.onend = () => { tts.chunkIndex += 1; speakNextChunk(); };
    utterance.onerror = () => { tts.active = false; updateAudioUi(); };
    window.speechSynthesis.speak(utterance);
  }

  function playListening(passage) {
    if (!ttsSupported() || !ex.runner) return;
    const used = ex.runner.playsUsed?.[passage.id] || 0;
    if (used >= MAX_AUDIO_PLAYS || tts.active) return;
    ex.runner.playsUsed = ex.runner.playsUsed || {};
    ex.runner.playsUsed[passage.id] = used + 1;
    persistRunner();
    window.speechSynthesis.cancel();
    tts.active = true;
    tts.passageId = passage.id;
    tts.chunks = scriptToChunks(passage.script || passage.text || "");
    tts.chunkIndex = 0;
    // voices may load asynchronously on first use
    if (!window.speechSynthesis.getVoices().length) {
      window.speechSynthesis.addEventListener("voiceschanged", () => speakNextChunk(), { once: true });
      setTimeout(() => { if (tts.active && tts.chunkIndex === 0 && !window.speechSynthesis.speaking) speakNextChunk(); }, 400);
    } else {
      speakNextChunk();
    }
    updateAudioUi();
  }

  function updateAudioUi() {
    const status = document.getElementById("examAudioStatus");
    const playBtn = document.querySelector("[data-action='exam-play-audio']");
    const stopBtn = document.querySelector("[data-action='exam-stop-audio']");
    if (!status && !playBtn) return;
    const passageId = playBtn?.dataset.passage;
    const used = ex.runner?.playsUsed?.[passageId] || 0;
    const left = Math.max(0, MAX_AUDIO_PLAYS - used);
    if (status) {
      status.textContent = tts.active
        ? `🔊 ${t("Идёт воспроизведение…", "Playing…")}`
        : left > 0 ? `${t("Осталось прослушиваний", "Plays left")}: ${left}` : t("Прослушивания закончились", "No plays left");
    }
    if (playBtn) playBtn.disabled = tts.active || left <= 0;
    if (stopBtn) stopBtn.disabled = !tts.active;
  }

  /* ---------- interrupted-attempt persistence ---------- */
  function persistRunner() {
    const r = ex.runner;
    if (!r || r.finished) { clearSavedRunner(); return; }
    try {
      localStorage.setItem(RUNNER_STORE_KEY, JSON.stringify({
        examId: r.exam.examId,
        practice: r.practice,
        topic: r.topic,
        buildArgs: r.buildArgs,
        sectionIndex: r.sectionIndex,
        questionIndex: r.questionIndex,
        sections: r.sections.map((s) => ({ id: s.meta.id, questionIds: s.questions.map((q) => q.id), durationSec: s.durationSec })),
        answers: [...r.answers.entries()],
        startedAt: r.startedAt,
        remainingSec: r.practice ? null : Math.max(0, Math.round((r.sectionDeadline - Date.now()) / 1000)),
        fullMock: r.fullMock,
        playsUsed: r.playsUsed || {},
        savedAt: Date.now(),
      }));
    } catch {}
  }

  function clearSavedRunner() { try { localStorage.removeItem(RUNNER_STORE_KEY); } catch {} }

  function getSavedRunner() {
    try {
      const data = JSON.parse(localStorage.getItem(RUNNER_STORE_KEY) || "null");
      if (!data?.examId || !Array.isArray(data.sections)) return null;
      if (Date.now() - (data.savedAt || 0) > 24 * 3600 * 1000) { clearSavedRunner(); return null; }
      return data;
    } catch { return null; }
  }

  async function resumeSavedRunner() {
    const data = getSavedRunner();
    if (!data) return;
    try {
      const exam = await loadExam(data.examId);
      const byId = new Map(exam.questions.map((q) => [q.id, q]));
      const sections = data.sections.map((s) => ({
        meta: exam.sections.find((m) => m.id === s.id),
        questions: s.questionIds.map((id) => byId.get(id)).filter(Boolean),
        durationSec: s.durationSec,
      })).filter((s) => s.meta && s.questions.length);
      if (!sections.length) throw new Error("empty sections");
      const sectionIndex = Math.min(data.sectionIndex || 0, sections.length - 1);
      startRunner({
        exam,
        practice: !!data.practice,
        topic: data.topic || null,
        buildArgs: data.buildArgs || { sectionIds: sections.map((s) => s.meta.id), options: { practice: !!data.practice } },
        sections,
        sectionIndex,
        questionIndex: Math.min(data.questionIndex || 0, sections[sectionIndex].questions.length - 1),
        answers: new Map(data.answers || []),
        startedAt: data.startedAt || Date.now(),
        sectionDeadline: data.practice ? null : Date.now() + (data.remainingSec ?? sections[sectionIndex].durationSec) * 1000,
        timerId: null,
        finished: false,
        review: false,
        savedAttempt: null,
        playsUsed: data.playsUsed || {},
        fullMock: !!data.fullMock,
      });
    } catch {
      clearSavedRunner();
      toast(t("Не удалось восстановить тест", "Could not restore the test"));
      render();
    }
  }

  function renderResumeBanner() {
    const data = getSavedRunner();
    if (!data || ex.runner) return "";
    const meta = CATALOG.find((c) => c.id === data.examId);
    const exam = ex.cache[data.examId];
    const answered = (data.answers || []).filter(([, a]) => hasAnswer(a)).length;
    const name = pick(exam?.title) || pick(meta?.name) || data.examId.toUpperCase();
    const kind = data.practice ? t("практика", "practice") : t("пробный тест", "mock test");
    return `
      <div class="exam-resume-banner">
        <div>
          <strong>⏸ ${t("Незавершённый тест", "Unfinished test")}: ${esc(name)}</strong>
          <small>${esc(kind)} · ${t("отвечено", "answered")}: ${answered}${data.remainingSec != null ? ` · ${t("осталось", "time left")} ${timerText(data.remainingSec)}` : ""}</small>
        </div>
        <div class="exam-resume-actions">
          <button class="primary-button" data-action="exam-resume" type="button">${t("Продолжить", "Resume")}</button>
          <button class="ghost-button" data-action="exam-discard-save" type="button">${t("Отменить", "Discard")}</button>
        </div>
      </div>`;
  }

  /* ---------- rendering: root ---------- */
  function rootEl() { return document.getElementById("examsRoot"); }

  function render() {
    const root = rootEl();
    if (!root) return;
    if (ex.view === "detail" && ex.activeExamId && ex.cache[ex.activeExamId]) {
      root.innerHTML = renderResumeBanner() + renderDetail(ex.cache[ex.activeExamId]);
    } else {
      root.innerHTML = renderResumeBanner() + renderCatalog();
    }
  }

  function syncUrl() {
    if (window.location.pathname !== "/exams") return;
    const hash = ex.view === "detail" && ex.activeExamId ? `#${ex.activeExamId}` : "";
    const target = `/exams${hash}`;
    if (window.location.pathname + window.location.hash !== target) {
      window.history.pushState({ route: "exams" }, "", target);
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

  // A contextual "what to do next" hint so a new user never has to guess
  function renderNextStep(exam) {
    const attempts = attemptsFor(exam.examId);
    if (!attempts.length) {
      const first = exam.sections[0];
      return `
        <div class="exam-next-step">
          <span class="exam-next-icon">🎯</span>
          <div>
            <strong>${t("С чего начать", "Where to start")}</strong>
            <p>${t("Пройди одну секцию с таймером — это диагностика: после неё появятся твои слабые темы и график прогресса.", "Take one timed section as a diagnostic — afterwards you'll see your weak topics and a progress chart.")}</p>
          </div>
          <button class="primary-button" data-action="exam-start-section" data-section="${first.id}" type="button">${t("Начать диагностику", "Start diagnostic")}</button>
        </div>`;
    }
    const weak = weakTopics(exam.examId, 3);
    if (weak.length) {
      return `
        <div class="exam-next-step">
          <span class="exam-next-icon">📈</span>
          <div>
            <strong>${t("Следующий шаг", "Next step")}</strong>
            <p>${t("Потренируй слабые темы — это быстрее всего поднимет балл:", "Practise your weak topics — the fastest way to raise your score:")}</p>
            <div class="exam-weak-list">
              ${weak.map((w) => `
                <button class="exam-weak-chip" data-action="exam-practice-topic" data-topic="${esc(w.topic)}" data-section="${esc(w.sectionId)}" type="button">
                  <span>${esc(w.topic)}</span><small>${Math.round(w.accuracy * 100)}%</small>
                </button>`).join("")}
            </div>
          </div>
        </div>`;
    }
    return `
      <div class="exam-next-step">
        <span class="exam-next-icon">🚀</span>
        <div>
          <strong>${t("Следующий шаг", "Next step")}</strong>
          <p>${t("Явных слабых тем не видно — самое время пройти полный пробник и закрепить результат.", "No obvious weak topics — time to take a full mock and lock in your progress.")}</p>
        </div>
        <button class="primary-button" data-action="exam-start-full" type="button">${t("Полный пробник", "Full mock")}</button>
      </div>`;
  }

  function renderMockTab(exam) {
    const questionSections = exam.sections.filter((s) => s.kind !== "writing" && s.kind !== "speaking");
    const plan = mockPlan(exam);
    const plannedIds = plan
      ? [...plan.mandatory, ...(plan.mode === "pair" ? Object.values(plan.pairs)[0].ids : plan.defaults)]
      : null;
    const countedSections = plannedIds
      ? exam.sections.filter((s) => plannedIds.includes(s.id))
      : questionSections;
    const totalQuestions = countedSections.reduce((sum, s) => sum + s.questionsPerAttempt, 0);
    const totalMin = countedSections.reduce((sum, s) => sum + s.durationMin, 0);
    const entPairPicker = renderMockPlanPicker(exam);
    const sectionRows = exam.sections.map((s) => {
      if (s.kind === "writing" || s.kind === "speaking") {
        const speaking = s.kind === "speaking";
        return `
          <div class="exam-section-row exam-section-writing">
            <div>
              <strong>${speaking ? "🎙" : "✍️"} ${esc(pick(s.title))}</strong>
              <small>${speaking ? t("Говори вслух — ИИ оценит по критериям", "Speak out loud — AI grades against the criteria") : t("Проверка ИИ по критериям экзамена", "AI-graded against exam criteria")} · ${s.durationMin} ${t("мин", "min")}</small>
            </div>
            <button class="ghost-button" data-action="exam-writing-open" data-section="${s.id}" type="button">${t("Начать", "Start")}</button>
          </div>`;
      }
      return `
      <div class="exam-section-row">
        <div>
          <strong>${esc(pick(s.title))}</strong>
          <small>${s.questionsPerAttempt} ${plural(s.questionsPerAttempt, QUESTIONS_FORMS)} · ${s.durationMin} ${t("мин", "min")}</small>
        </div>
        <button class="ghost-button" data-action="exam-start-section" data-section="${s.id}" type="button">${t("Начать", "Start")}</button>
      </div>`;
    }).join("");
    return `
      ${renderNextStep(exam)}
      <div class="exam-mock-layout">
        <article class="panel exam-full-mock" style="--exam-accent:${accentFor(exam.examId)}">
          <h3>${t("Полный пробный тест", "Full mock test")}</h3>
          <p>${t("Все секции подряд с таймером, как на реальном экзамене.", "All sections in sequence with a timer, just like the real exam.")}</p>
          <div class="exam-full-mock-meta">
            <span>${countedSections.length} ${t("секций", "sections")}</span>
            <span>${totalQuestions} ${plural(totalQuestions, QUESTIONS_FORMS)}</span>
            <span>${totalMin} ${t("минут", "minutes")}</span>
          </div>
          ${entPairPicker}
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
    const sectionCards = exam.sections.filter((s) => s.kind !== "writing").map((s) => {
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
    const openSections = exam.sections.filter((s) => s.kind === "writing" || s.kind === "speaking");
    const writingBlock = openSections.length ? `
      <article class="panel">
        <h3>${t("Устная и письменная части", "Speaking & Writing")}</h3>
        <p class="exam-muted">${t("Отвечай голосом или письменно — ИИ-экзаменатор оценит по официальным критериям и покажет ошибки с цитатами.", "Answer by speaking or in writing — the AI examiner grades against the official criteria and quotes your mistakes.")}</p>
        <div class="exam-section-list">
          ${openSections.map((s) => {
            const speaking = s.kind === "speaking";
            const count = ((speaking ? exam.speakingTasks : exam.writingTasks) || []).filter((task) => task.sectionId === s.id).length;
            return `
            <div class="exam-section-row exam-section-writing">
              <div>
                <strong>${speaking ? "🎙" : "✍️"} ${esc(pick(s.title))}</strong>
                <small>${count} ${t("заданий", "tasks")} · ${s.durationMin} ${t("мин", "min")}</small>
              </div>
              <button class="ghost-button" data-action="exam-writing-open" data-section="${s.id}" type="button">${speaking ? t("Говорить", "Speak") : t("Писать", "Write")}</button>
            </div>`;
          }).join("")}
        </div>
      </article>` : "";
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
        ${writingBlock}
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
  function buildRunner(exam, sectionIds, options = {}) {
    const { practice = false, count = null, topic = null } = options;
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
      buildArgs: { sectionIds, options },
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
      playsUsed: {},
      fullMock: options.fullMock ?? (!practice && sectionIds.length === exam.sections.filter((s) => s.kind !== "writing").length),
    };
  }

  // A real sitting is mandatory subjects plus the ones the student chose, not every section at once.
  const MOCK_PLANS = {
    ent: {
      mandatory: ["history_kz", "math_literacy", "reading_literacy"],
      mode: "pair",
      label: { ru: "Профильные предметы", en: "Profile subjects" },
      pairs: {
        mathphys: { ids: ["math_profile", "physics"], label: { ru: "Математика + Физика", en: "Math + Physics" } },
        biochem: { ids: ["biology", "chemistry"], label: { ru: "Биология + Химия", en: "Biology + Chemistry" } },
      },
    },
    ege: {
      mandatory: ["russian", "math_profile"],
      mode: "choice",
      maxChoices: 2,
      label: { ru: "Предметы по выбору (до 2)", en: "Optional subjects (up to 2)" },
      note: { ru: "Обязательные: русский язык и математика", en: "Mandatory: Russian and mathematics" },
      options: ["physics", "informatics", "social", "history"],
      defaults: ["physics", "informatics"],
    },
  };

  function mockPlan(exam) {
    const plan = MOCK_PLANS[exam.examId];
    if (!plan) return null;
    // only apply once the bank actually contains the extra sections
    const known = new Set(exam.sections.map((s) => s.id));
    const pool = plan.mode === "pair" ? Object.values(plan.pairs).flatMap((p) => p.ids) : plan.options;
    return pool.every((id) => known.has(id)) ? plan : null;
  }

  function fullMockSectionIds(exam) {
    const plan = mockPlan(exam);
    if (!plan) return exam.sections.filter((s) => s.kind !== "writing").map((s) => s.id);
    let chosen = [];
    if (plan.mode === "pair") {
      const key = document.getElementById("examProfilePair")?.value;
      chosen = (plan.pairs[key] || Object.values(plan.pairs)[0]).ids;
    } else {
      chosen = [...document.querySelectorAll("[data-mock-option]:checked")].map((el) => el.dataset.mockOption);
      if (!chosen.length) chosen = plan.defaults;
      chosen = chosen.slice(0, plan.maxChoices);
    }
    return [...plan.mandatory, ...chosen].filter((id) => exam.sections.some((s) => s.id === id));
  }

  function renderMockPlanPicker(exam) {
    const plan = mockPlan(exam);
    if (!plan) return "";
    const title = (id) => esc(pick(exam.sections.find((s) => s.id === id)?.title) || id);
    if (plan.mode === "pair") {
      return `
        <label class="exam-profile-pick">
          <span>${esc(pick(plan.label))}:</span>
          <select id="examProfilePair">
            ${Object.entries(plan.pairs).map(([key, pair]) => `<option value="${key}">${esc(pick(pair.label))}</option>`).join("")}
          </select>
        </label>`;
    }
    return `
      <div class="exam-mock-options">
        <span class="exam-mock-options-label">${esc(pick(plan.label))}</span>
        <div class="exam-mock-option-list">
          ${plan.options.map((id) => `
            <label class="exam-mock-option">
              <input type="checkbox" data-mock-option="${id}" ${plan.defaults.includes(id) ? "checked" : ""}>
              <span>${title(id)}</span>
            </label>`).join("")}
        </div>
        <small>${esc(pick(plan.note))}</small>
      </div>`;
  }

  function startRunner(runner) {
    if (!runner) { toast(t("Недостаточно вопросов для теста", "Not enough questions for a test")); return; }
    ex.runner = runner;
    document.body.classList.add("exam-running");
    ensureCalculatorPanel();
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
          if (left % 10 === 0) persistRunner(); // keep the saved copy's remaining time fresh
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
    stopAudio();
    closeCalculator();
    document.getElementById("examCalculator")?.remove();
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
    clearSavedRunner();
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
    stopAudio();
    closeCalculator();
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
    runner.result.interpretation = buildInterpretation(runner, attempt);
    clearSavedRunner();
    renderRunner(); // show result screen immediately
    try {
      const saved = await api("/api/exam-attempts", { method: "POST", body: attempt });
      runner.savedAttempt = saved;
      await loadAttempts(true);
    } catch {
      toast(t("Не удалось сохранить результат", "Could not save the result"));
    }
  }

  // Human context for the score: trend vs the previous attempt + real-world benchmarks
  function buildInterpretation(runner, attempt) {
    const lines = [];
    const pct = attempt.score.total ? attempt.score.correct / attempt.score.total : 0;
    const prev = attemptsFor(runner.exam.examId)[0]; // saved attempts are newest-first; current one is not saved yet
    if (prev?.score?.total) {
      const prevPct = prev.score.correct / prev.score.total;
      const diff = Math.round((pct - prevPct) * 100);
      if (diff > 2) lines.push(`📈 ${t(`На ${diff} п.п. точнее прошлой попытки — отличная динамика!`, `${diff} pts more accurate than your last attempt — great progress!`)}`);
      else if (diff < -2) lines.push(`💪 ${t(`На ${Math.abs(diff)} п.п. ниже прошлой попытки. Загляни в разбор ответов — там видно, где ушли баллы.`, `${Math.abs(diff)} pts below your last attempt. Check the answer review to see where the points went.`)}`);
      else lines.push(`⚖️ ${t("Результат на уровне прошлой попытки.", "On par with your last attempt.")}`);
    }
    if (runner.fullMock) {
      const benchmarks = {
        ent: t("Ориентиры ЕНТ: порог допуска — 50 баллов, на грант обычно нужно 70–110+, топ-специальности — 120+.", "UNT benchmarks: pass threshold 50, grants usually need 70–110+, top programs 120+."),
        ege: t("Ориентиры ЕГЭ: минимальные пороги ~40 тестовых баллов, 60–80 — хороший результат, 80+ — сильный.", "EGE benchmarks: minimum ~40, 60–80 is good, 80+ is strong."),
        ielts: t("Ориентиры IELTS: большинству вузов достаточно band 6.0–7.0, топ-программы просят 7.5+.", "IELTS benchmarks: most universities ask for band 6.0–7.0, top programs 7.5+."),
        sat: t("Ориентиры SAT: средний балл ~1050, сильный результат 1300+, топ-вузы ждут 1450+.", "SAT benchmarks: average ~1050, strong 1300+, top schools expect 1450+."),
      };
      if (benchmarks[runner.exam.examId]) lines.push(`🎓 ${benchmarks[runner.exam.examId]}`);
    }
    return lines;
  }

  /* ---------- Desmos graphing calculator (Digital SAT allows it in Math) ---------- */
  const desmos = { loading: null, instance: null, open: false, pos: null };

  function calculatorAllowed(runner) {
    const section = runner?.sections?.[runner.sectionIndex];
    return runner?.exam?.examId === "sat" && section?.meta?.id === "math";
  }

  function loadDesmos() {
    if (window.Desmos) return Promise.resolve();
    if (desmos.loading) return desmos.loading;
    // The key is stamped into the page by the server from DESMOS_API_KEY;
    // without one the public demo key keeps the calculator working in development.
    const key = document.documentElement.dataset.desmosKey || "dcb31709b452b1cf9dc26972add0fda6";
    desmos.loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://www.desmos.com/api/v1.10/calculator.js?apiKey=${encodeURIComponent(key)}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => { desmos.loading = null; reject(new Error("Desmos failed to load")); };
      document.head.appendChild(script);
    });
    return desmos.loading;
  }

  async function toggleCalculator() {
    if (desmos.open) { closeCalculator(); return; }
    const panel = document.getElementById("examCalculator");
    if (!panel) return;
    panel.hidden = false;
    desmos.open = true;
    updateCalculatorButton();
    const host = panel.querySelector(".exam-calculator-host");
    host.innerHTML = `<div class="exam-calculator-loading">${t("Загружаем калькулятор…", "Loading the calculator…")}</div>`;
    try {
      await loadDesmos();
      if (!desmos.open) return; // closed while loading
      host.innerHTML = "";
      desmos.instance = window.Desmos.GraphingCalculator(host, {
        keypad: true,
        expressions: true,
        settingsMenu: false,
        zoomButtons: true,
        expressionsTopbar: true,
        border: false,
      });
    } catch {
      host.innerHTML = `<div class="exam-calculator-loading">${t("Калькулятор недоступен — проверь соединение.", "Calculator unavailable — check your connection.")}</div>`;
    }
  }

  function closeCalculator() {
    desmos.open = false;
    if (desmos.instance) { try { desmos.instance.destroy(); } catch {} desmos.instance = null; }
    const panel = document.getElementById("examCalculator");
    if (panel) { panel.hidden = true; panel.querySelector(".exam-calculator-host").innerHTML = ""; }
    updateCalculatorButton();
  }

  function updateCalculatorButton() {
    const button = document.querySelector("[data-action='exam-calculator']");
    if (button) button.classList.toggle("on", desmos.open);
  }

  function renderCalculatorPanel() {
    return `
      <aside class="exam-calculator" id="examCalculator" hidden aria-label="${t("Графический калькулятор", "Graphing calculator")}">
        <div class="exam-calculator-head">
          <strong>${t("Калькулятор", "Calculator")}</strong>
          <span>${t("как на цифровом SAT", "as on the Digital SAT")}</span>
          <button class="icon-button" data-action="exam-calculator-close" type="button" aria-label="${t("Закрыть", "Close")}"><svg><use href="#i-x"></use></svg></button>
        </div>
        <div class="exam-calculator-host"></div>
      </aside>`;
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

  // The runner re-renders its whole markup on every answer; the calculator lives
  // in a sibling element so an open graph is not wiped by the next click.
  function ensureCalculatorPanel() {
    if (document.getElementById("examCalculator")) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = renderCalculatorPanel();
    const panel = wrap.firstElementChild;
    document.body.appendChild(panel);
    if (desmos.pos) {
      panel.style.left = desmos.pos.left;
      panel.style.top = desmos.pos.top;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      clampCalculatorIntoView(panel);
    }
    makeCalculatorDraggable(panel);
  }

  function clampCalculatorIntoView(panel) {
    const rect = panel.getBoundingClientRect();
    const x = Math.min(Math.max(rect.left, 60 - rect.width), window.innerWidth - 60);
    const y = Math.min(Math.max(rect.top, 0), Math.max(0, window.innerHeight - 48));
    panel.style.left = x + "px";
    panel.style.top = y + "px";
  }

  // Drag by the header bar; phones keep the fixed bottom-sheet layout.
  function makeCalculatorDraggable(panel) {
    const head = panel.querySelector(".exam-calculator-head");
    head.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      if (window.matchMedia("(max-width: 640px)").matches) return;
      const rect = panel.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      // switch to left/top so dragging and the CSS resize handle agree
      panel.style.left = rect.left + "px";
      panel.style.top = rect.top + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.classList.add("dragging");
      document.body.style.userSelect = "none";
      const move = (e) => {
        const x = Math.min(Math.max(e.clientX - offsetX, 60 - panel.offsetWidth), window.innerWidth - 60);
        const y = Math.min(Math.max(e.clientY - offsetY, 0), Math.max(0, window.innerHeight - 48));
        panel.style.left = x + "px";
        panel.style.top = y + "px";
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        panel.classList.remove("dragging");
        document.body.style.userSelect = "";
        desmos.pos = { left: panel.style.left, top: panel.style.top };
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      event.preventDefault();
    });
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
    // Moving to a question from another recording must not leave the previous audio running
    if (tts.active && tts.passageId && tts.passageId !== question.passageId) stopAudio();
    const index = runner.questionIndex;
    const count = section.questions.length;
    const left = runner.practice ? null : Math.max(0, Math.round((runner.sectionDeadline - Date.now()) / 1000));

    const palette = section.questions.map((q, i) => {
      const a = runner.answers.get(q.id);
      const cls = [
        i === index ? "current" : "",
        hasAnswer(a) ? "answered" : "",
        a?.flagged ? "flagged" : "",
      ].filter(Boolean).join(" ");
      return `<button class="exam-dot ${cls}" data-action="exam-goto" data-index="${i}" type="button" aria-label="${t("Вопрос", "Question")} ${i + 1}">${i + 1}</button>`;
    }).join("");

    const answeredCount = section.questions.filter((q) => hasAnswer(runner.answers.get(q.id))).length;

    let body;
    if (question.type === "multi") {
      const picked = new Set(Array.isArray(answer.value) ? answer.value.map(Number) : []);
      const correctSet = new Set((question.correctIndices || []).map(Number));
      const showResult = runner.practice && answer.checked;
      body = `
        <p class="exam-multi-hint">${t("Можно выбрать несколько вариантов", "Multiple answers can be selected")}</p>
        <div class="exam-choices">${question.choices.map((choice, i) => {
          const isPicked = picked.has(i);
          let cls = isPicked ? "picked" : "";
          if (showResult) {
            if (correctSet.has(i)) cls = "correct";
            else if (isPicked) cls = "wrong";
          }
          return `<button class="exam-choice ${cls}" data-action="exam-multi-toggle" data-index="${i}" type="button" ${showResult ? "disabled" : ""}>
            <span class="exam-choice-letter ${isPicked || (showResult && correctSet.has(i)) ? "checked" : ""}">${isPicked ? "✓" : String.fromCharCode(65 + i)}</span>
            <span>${esc(choice)}</span>
          </button>`;
        }).join("")}</div>
        ${runner.practice && !answer.checked ? `<button class="primary-button exam-check-btn" data-action="exam-check" type="button">${t("Проверить", "Check")}</button>` : ""}`;
    } else if (question.type === "input") {
      const checked = runner.practice && answer.checked;
      body = `
        <input class="exam-input" id="examInputAnswer" type="text" autocomplete="off"
          placeholder="${t("Введи ответ", "Type your answer")}" value="${esc(answer.value ?? "")}" ${checked ? "disabled" : ""}>
        ${runner.practice && !checked ? `<button class="primary-button exam-check-btn" data-action="exam-check" type="button">${t("Проверить", "Check")}</button>` : ""}
        ${!runner.practice ? `<small class="exam-input-hint">${t("Ответ сохраняется автоматически", "Your answer is saved automatically")}</small>` : ""}`;
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
        ${question.type === "multi" && !isCorrect(question, answer.value) ? `<p>${t("Правильная комбинация", "Correct combination")}: <strong>${esc((question.correctIndices || []).map((i) => String.fromCharCode(65 + i)).join(", "))}</strong></p>` : ""}
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
          ${calculatorAllowed(runner) ? `<button class="exam-calc-btn ${desmos.open ? "on" : ""}" data-action="exam-calculator" type="button" title="${t("Графический калькулятор", "Graphing calculator")}">🧮 <span>${t("Калькулятор", "Calculator")}</span></button>` : ""}
          ${runner.practice ? `<span class="exam-progress-label">${index + 1} / ${count}</span>` : `<span class="exam-timer" id="examTimer">${timerText(left)}</span>`}
          <button class="icon-button" data-action="exam-exit" type="button" aria-label="${t("Выйти", "Exit")}"><svg><use href="#i-x"></use></svg></button>
        </header>
        <div class="exam-progressbar"><span style="width:${((index + 1) / count) * 100}%"></span></div>
        <div class="exam-runner-body ${passage ? "with-passage" : ""}">
          ${passage ? (passage.kind === "listening" ? renderListeningPanel(passage) : `<aside class="exam-passage"><h4>${esc(passage.title || "")}</h4><div>${esc(passage.text).replace(/\n/g, "<br>")}</div></aside>`) : ""}
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
          ${runner.practice ? "" : `<span class="exam-answered-count" title="${t("Отвечено", "Answered")}">${answeredCount}/${count}</span>`}
          <div class="exam-palette">${runner.practice ? "" : palette}</div>
          ${nextLabel ? `<button class="primary-button" data-action="exam-next" type="button" ${runner.practice && !answer.checked && answer.value != null && question.type !== "input" ? "" : ""}>${nextLabel} →</button>` : ""}
          ${!runner.practice && isLastQuestion ? `<button class="primary-button" data-action="exam-finish-section" type="button">${runner.sectionIndex < runner.sections.length - 1 ? t("Следующая секция", "Next section") : t("Завершить тест", "Finish test")}</button>` : ""}
        </footer>
      </div>`;

    if (!runner.finished) persistRunner();

    const input = document.getElementById("examInputAnswer");
    if (input) {
      input.addEventListener("input", () => { answerFor(question.id).value = input.value; persistRunner(); });
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

  function renderListeningPanel(passage) {
    const used = ex.runner?.playsUsed?.[passage.id] || 0;
    const left = Math.max(0, MAX_AUDIO_PLAYS - used);
    if (!ttsSupported()) {
      // no speech synthesis in this browser — degrade to reading the transcript
      return `
        <aside class="exam-passage exam-listening">
          <h4>🎧 ${esc(passage.title || "")}</h4>
          <p class="exam-listening-note">${t("Браузер не поддерживает озвучку — читай скрипт как текст.", "This browser has no speech synthesis — read the transcript instead.")}</p>
          <div>${esc(passage.script || "").replace(/\n/g, "<br>")}</div>
        </aside>`;
    }
    return `
      <aside class="exam-passage exam-listening">
        <h4>🎧 ${esc(passage.title || "")}</h4>
        <p class="exam-listening-note">${t("Как на экзамене: запись можно включить не больше 2 раз. Отвечай на вопросы по ходу прослушивания.", "Exam rules: you can play the recording at most twice. Answer the questions as you listen.")}</p>
        <div class="exam-listening-controls">
          <button class="primary-button" data-action="exam-play-audio" data-passage="${esc(passage.id)}" type="button" ${tts.active || left <= 0 ? "disabled" : ""}>▶ ${t("Слушать", "Play")}</button>
          <button class="ghost-button" data-action="exam-stop-audio" type="button" ${tts.active ? "" : "disabled"}>⏹ ${t("Стоп", "Stop")}</button>
        </div>
        <div class="exam-audio-status" id="examAudioStatus">${tts.active ? `🔊 ${t("Идёт воспроизведение…", "Playing…")}` : `${t("Осталось прослушиваний", "Plays left")}: ${left}`}</div>
      </aside>`;
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
          ${(result.interpretation || []).length ? `<div class="exam-result-notes">${result.interpretation.map((line) => `<p>${esc(line)}</p>`).join("")}</div>` : ""}
          <div class="exam-result-sections">${sectionRows}</div>
          ${weakRows.length ? `
            <div class="exam-result-weak">
              <h4>${t("Что подтянуть", "What to improve")}</h4>
              ${weakRows.map((row) => `<div class="exam-result-weak-row"><span>${esc(row.topic)}</span><small>${row.correct}/${row.total}</small></div>`).join("")}
            </div>` : ""}
          <div class="exam-result-actions">
            <button class="ghost-button" data-action="exam-retake" type="button">${t("Пройти ещё раз", "Take again")}</button>
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
        const letterList = (indices) => (indices || []).map((i) => `${String.fromCharCode(65 + Number(i))}. ${q.choices[i]}`).join("; ");
        let givenLabel;
        if (q.type === "input") givenLabel = a?.value ? String(a.value) : t("нет ответа", "no answer");
        else if (q.type === "multi") givenLabel = hasAnswer(a) ? letterList(a.value) : t("нет ответа", "no answer");
        else givenLabel = a?.value != null ? `${String.fromCharCode(65 + Number(a.value))}. ${q.choices[a.value]}` : t("нет ответа", "no answer");
        const correctLabel = q.type === "input" ? (q.answers || [])[0]
          : q.type === "multi" ? letterList(q.correctIndices)
          : `${String.fromCharCode(65 + q.correctIndex)}. ${q.choices[q.correctIndex]}`;
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
      const listeningScripts = [...new Set(s.questions.map((q) => q.passageId).filter(Boolean))]
        .map((id) => (runner.exam.passages || []).find((p) => p.id === id))
        .filter((p) => p && p.kind === "listening");
      const scriptsBlock = listeningScripts.map((p) => `
        <details class="exam-review-item">
          <summary><span class="exam-review-mark">🎧</span><span class="exam-review-q">${t("Скрипт записи", "Audio transcript")}: ${esc(p.title || "")}</span></summary>
          <div class="exam-review-detail"><p class="exam-review-full">${esc(p.script || "").replace(/\n/g, "<br>")}</p></div>
        </details>`).join("");
      return `<section class="exam-review-section"><h4>${esc(pick(s.meta.title))}</h4>${scriptsBlock}${items}</section>`;
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

  /* ---------- writing: AI-graded essays ---------- */
  function writingDraftKey(taskId) { return `studyExamEssay:${taskId}`; }
  function countWords(text) { return String(text || "").trim().split(/\s+/).filter(Boolean).length; }

  function openWriting(exam, sectionId) {
    const section = exam.sections.find((s) => s.id === sectionId);
    const speaking = section?.kind === "speaking";
    const tasks = (speaking ? exam.speakingTasks : exam.writingTasks || []).filter((task) => task.sectionId === sectionId);
    if (!tasks.length) { toast(t("Задания ещё не загружены", "Tasks are not available yet")); return; }
    ex.writing = { exam, sectionId, speaking, tasks, task: null, phase: "pick", text: "", deadline: null, timerId: null, feedback: null, score: null, startedAt: null };
    document.body.classList.add("exam-running");
    renderWriting();
  }

  /* ---------- speech recognition (dictation for Speaking) ---------- */
  const dictation = { recognizer: null, active: false, baseText: "" };

  function speechRecognitionSupported() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function stopDictation() {
    dictation.active = false;
    try { dictation.recognizer?.stop(); } catch {}
    dictation.recognizer = null;
    updateDictationUi();
  }

  function startDictation() {
    if (!speechRecognitionSupported() || dictation.active) return;
    const Recognizer = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognizer = new Recognizer();
    recognizer.lang = "en-US";
    recognizer.continuous = true;
    recognizer.interimResults = true;
    dictation.recognizer = recognizer;
    dictation.active = true;
    dictation.baseText = ex.writing?.text || "";

    recognizer.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += chunk;
        else interim += chunk;
      }
      if (finalText) dictation.baseText = `${dictation.baseText} ${finalText.trim()}`.trim();
      const textarea = document.getElementById("examWritingText");
      const combined = `${dictation.baseText}${interim ? ` ${interim.trim()}` : ""}`.trim();
      if (textarea) {
        textarea.value = combined;
        textarea.dispatchEvent(new Event("input"));
        textarea.scrollTop = textarea.scrollHeight;
      }
    };
    recognizer.onerror = (event) => {
      dictation.active = false;
      updateDictationUi();
      if (event.error === "not-allowed") toast(t("Нет доступа к микрофону — разреши его в браузере", "Microphone access denied — allow it in your browser"));
      else if (event.error !== "aborted") toast(t("Распознавание речи прервалось — попробуй ещё раз", "Speech recognition stopped — try again"));
    };
    recognizer.onend = () => {
      // continuous mode still ends on long pauses; restart while the user is recording
      if (dictation.active) { try { recognizer.start(); } catch { dictation.active = false; updateDictationUi(); } }
      else updateDictationUi();
    };
    try { recognizer.start(); } catch { dictation.active = false; }
    updateDictationUi();
  }

  function updateDictationUi() {
    const button = document.querySelector("[data-action='exam-dictate']");
    const status = document.getElementById("examDictationStatus");
    if (button) {
      button.classList.toggle("recording", dictation.active);
      button.textContent = dictation.active ? `⏹ ${t("Остановить запись", "Stop recording")}` : `🎙 ${t("Говорить", "Speak")}`;
    }
    if (status) status.textContent = dictation.active ? t("Идёт запись — говори в микрофон", "Recording — speak into your microphone") : "";
  }

  function startWritingTask(taskId) {
    const w = ex.writing;
    const task = w.tasks.find((item) => item.id === taskId);
    if (!task) return;
    w.task = task;
    w.phase = "write";
    w.text = localStorage.getItem(writingDraftKey(task.id)) || "";
    w.startedAt = Date.now();
    w.deadline = Date.now() + (task.durationMin || 40) * 60 * 1000;
    if (w.timerId) clearInterval(w.timerId);
    w.timerId = setInterval(() => {
      const label = document.getElementById("examWritingTimer");
      if (!label || !ex.writing || ex.writing.phase !== "write") return;
      const left = Math.round((ex.writing.deadline - Date.now()) / 1000);
      if (left <= 0) {
        label.textContent = "00:00";
        label.classList.add("danger");
        clearInterval(ex.writing.timerId);
        toast(t("Время вышло — можешь дописать и отправить", "Time is up — you can still finish and submit"));
      } else {
        label.textContent = timerText(left);
        label.classList.toggle("danger", left <= 120);
      }
    }, 1000);
    renderWriting();
  }

  function closeWriting(force = false) {
    const w = ex.writing;
    if (!w) return;
    stopDictation();
    const doClose = () => {
      if (w.timerId) clearInterval(w.timerId);
      ex.writing = null;
      document.body.classList.remove("exam-running");
      document.getElementById("examRunnerOverlay")?.remove();
      render();
    };
    if (!force && w.phase === "write" && countWords(w.text) > 10) {
      // draft is already autosaved — leaving is safe, just tell the user
      toast(t("Черновик сохранён — вернёшься, и текст будет на месте", "Draft saved — your text will be here when you return"));
    }
    doClose();
  }

  async function submitWriting() {
    const w = ex.writing;
    if (!w || !w.task) return;
    const words = countWords(w.text);
    if (words < 40) { toast(t("Слишком короткий текст для проверки (минимум ~40 слов)", "Too short to grade (about 40 words minimum)")); return; }
    if (words < (w.task.minWords || 0)) {
      const sure = typeof confirmAction === "function"
        ? await confirmAction({
            title: t("Отправить короткую работу?", "Submit a short answer?"),
            text: `${t("Слов", "Words")}: ${words} ${t("из требуемых", "of required")} ${w.task.minWords}. ${t("За недобор слов экзаменатор снижает балл.", "Examiners deduct points for being under the word limit.")}`,
            okText: t("Отправить", "Submit"),
          })
        : true;
      if (!sure) return;
    }
    stopDictation();
    w.phase = "checking";
    renderWriting();
    try {
      const examLang = w.exam.lang === "en" ? "en" : "ru";
      const result = await api("/api/exam-writing-check", {
        method: "POST",
        body: {
          examId: w.exam.examId,
          kind: w.speaking ? "speaking" : "writing",
          taskTitle: pick(w.task.title),
          taskPrompt: (w.task.prompt && (w.task.prompt[examLang] || pick(w.task.prompt))) || "",
          criteria: w.task.criteria || "",
          maxScore: w.task.maxScore || 9,
          essay: w.text,
          language: lang(),
        },
      });
      w.feedback = result.feedback || "";
      w.score = result.score;
      w.phase = "feedback";
      localStorage.removeItem(writingDraftKey(w.task.id));
      renderWriting();
      if (w.score != null) {
        const scaledLabel = w.exam.examId === "ielts" ? `Band ${w.score} (Writing)` : `${w.score}/${result.max} · ${t("сочинение", "essay")}`;
        try {
          await api("/api/exam-attempts", {
            method: "POST",
            body: {
              examId: w.exam.examId,
              mode: "section",
              sections: [{ sectionId: w.sectionId, correct: w.score, total: result.max }],
              topics: [],
              score: { correct: w.score, total: result.max, scaled: w.score, scaledLabel },
              durationSec: Math.round((Date.now() - w.startedAt) / 1000),
            },
          });
          await loadAttempts(true);
        } catch {}
      }
    } catch (error) {
      w.phase = "write";
      renderWriting();
      toast(error?.message || t("Не удалось проверить работу", "Could not check the work"));
    }
  }

  function renderWriting() {
    const w = ex.writing;
    if (!w) return;
    const overlay = ensureOverlay();
    const examTitle = esc(pick(w.exam.title));
    const sectionTitle = esc(pick(w.exam.sections.find((s) => s.id === w.sectionId)?.title) || "");

    if (w.phase === "pick") {
      overlay.innerHTML = `
        <div class="exam-runner exam-writing-screen">
          <header class="exam-runner-head">
            <div class="exam-runner-title"><strong>${examTitle}</strong><span>${sectionTitle}</span></div>
            <button class="icon-button" data-action="exam-writing-close" type="button" aria-label="${t("Закрыть", "Close")}"><svg><use href="#i-x"></use></svg></button>
          </header>
          <p class="exam-muted">${t("Выбери задание. Работу проверит ИИ по официальным критериям и объяснит, за что снижены баллы.", "Pick a task. The AI grades your work against the official criteria and explains every deduction.")}</p>
          <div class="exam-writing-tasks">
            ${w.tasks.map((task) => `
              <button class="exam-writing-task" data-action="exam-writing-start" data-task="${esc(task.id)}" type="button">
                <strong>${esc(pick(task.title))}</strong>
                <small>${t("минимум", "min")} ${task.minWords} ${t("слов", "words")} · ${task.durationMin} ${t("мин", "min")} · ${t("макс. балл", "max score")}: ${task.maxScore}</small>
              </button>`).join("")}
          </div>
        </div>`;
      overlay.scrollTop = 0;
      return;
    }

    if (w.phase === "write") {
      const words = countWords(w.text);
      const left = Math.max(0, Math.round((w.deadline - Date.now()) / 1000));
      overlay.innerHTML = `
        <div class="exam-runner exam-writing-screen">
          <header class="exam-runner-head">
            <div class="exam-runner-title"><strong>${examTitle}</strong><span>${esc(pick(w.task.title))}</span></div>
            <span class="exam-timer" id="examWritingTimer">${timerText(left)}</span>
            <button class="icon-button" data-action="exam-writing-close" type="button" aria-label="${t("Закрыть", "Close")}"><svg><use href="#i-x"></use></svg></button>
          </header>
          <div class="exam-writing-layout">
            <div class="exam-writing-prompt md-body">${renderMarkdown((w.task.prompt && (w.task.prompt[lang()] || pick(w.task.prompt))) || "")}</div>
            <div class="exam-writing-editor">
              ${w.speaking ? `
                <div class="exam-dictation">
                  ${speechRecognitionSupported()
                    ? `<button class="ghost-button exam-dictate-btn ${dictation.active ? "recording" : ""}" data-action="exam-dictate" type="button">${dictation.active ? `⏹ ${t("Остановить запись", "Stop recording")}` : `🎙 ${t("Говорить", "Speak")}`}</button>
                       <span class="exam-dictation-hint">${t("Говори вслух — речь превратится в текст. Или печатай ответ вручную.", "Speak out loud — your speech becomes text. Or type your answer instead.")}</span>`
                    : `<span class="exam-dictation-hint">${t("Браузер не поддерживает распознавание речи — напечатай свой ответ так, как сказал бы его вслух.", "This browser has no speech recognition — type your answer exactly as you would say it.")}</span>`}
                  <span class="exam-dictation-status" id="examDictationStatus">${dictation.active ? t("Идёт запись — говори в микрофон", "Recording — speak into your microphone") : ""}</span>
                </div>` : ""}
              <textarea id="examWritingText" placeholder="${w.speaking ? t("Здесь появится расшифровка твоей речи…", "Your speech transcript will appear here…") : t("Пиши здесь…", "Write here…")}" spellcheck="true">${esc(w.text)}</textarea>
              <div class="exam-writing-bar">
                <span id="examWritingWords" class="${words >= w.task.minWords ? "ok" : ""}">${words} / ${w.task.minWords} ${t("слов", "words")}</span>
                <span class="exam-writing-autosave">${w.speaking ? t("Оценивается содержание речи, не произношение", "Content is graded, not pronunciation") : t("Черновик сохраняется автоматически", "Draft is saved automatically")}</span>
                <button class="primary-button" data-action="exam-writing-submit" type="button">${t("Отправить на проверку ИИ", "Submit for AI review")}</button>
              </div>
            </div>
          </div>
        </div>`;
      const textarea = document.getElementById("examWritingText");
      textarea.addEventListener("input", () => {
        w.text = textarea.value;
        if (!dictation.active) dictation.baseText = textarea.value;
        localStorage.setItem(writingDraftKey(w.task.id), w.text);
        const counter = document.getElementById("examWritingWords");
        const count = countWords(w.text);
        if (counter) {
          counter.textContent = `${count} / ${w.task.minWords} ${t("слов", "words")}`;
          counter.classList.toggle("ok", count >= w.task.minWords);
        }
      });
      if (!dictation.active) textarea.focus();
      return;
    }

    if (w.phase === "checking") {
      overlay.innerHTML = `
        <div class="exam-runner exam-writing-screen">
          <header class="exam-runner-head">
            <div class="exam-runner-title"><strong>${examTitle}</strong><span>${esc(pick(w.task.title))}</span></div>
          </header>
          <div class="exam-writing-checking">
            <div class="exam-spinner" aria-hidden="true"></div>
            <p>${t("ИИ-экзаменатор проверяет работу по критериям… обычно это занимает 20–40 секунд.", "The AI examiner is grading your work… this usually takes 20–40 seconds.")}</p>
          </div>
        </div>`;
      return;
    }

    // feedback
    const scoreLabel = w.score == null
      ? t("Балл не распознан", "Score not detected")
      : (w.exam.examId === "ielts" ? `Band ${w.score}` : `${w.score} / ${w.task.maxScore}`);
    overlay.innerHTML = `
      <div class="exam-runner exam-writing-screen">
        <header class="exam-runner-head">
          <div class="exam-runner-title"><strong>${examTitle}</strong><span>${t("Результат проверки", "Review result")}</span></div>
          <button class="icon-button" data-action="exam-writing-close" type="button" aria-label="${t("Закрыть", "Close")}"><svg><use href="#i-x"></use></svg></button>
        </header>
        <div class="exam-result-hero" style="--exam-accent:${accentFor(w.exam.examId)}">
          <div class="exam-result-score">
            <strong>${esc(scoreLabel)}</strong>
            <span>${esc(pick(w.task.title))}</span>
            <small>${countWords(w.text)} ${t("слов", "words")}</small>
          </div>
        </div>
        <div class="exam-writing-feedback md-body">${renderMarkdown(w.feedback)}</div>
        <div class="exam-result-actions">
          <button class="ghost-button" data-action="exam-writing-retry" type="button">${t("Написать ещё", "Write another")}</button>
          <button class="primary-button" data-action="exam-writing-close" type="button">${t("Готово", "Done")}</button>
        </div>
      </div>`;
    overlay.scrollTop = 0;
  }

  /* ---------- runner interactions ---------- */
  function checkPracticeAnswer() {
    const question = currentQuestion();
    const answer = answerFor(question.id);
    if (!hasAnswer(answer)) { toast(t("Сначала выбери ответ", "Pick an answer first")); return; }
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
      syncUrl();
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
    if (action === "exam-back") { ex.view = "catalog"; syncUrl(); render(); return; }
    if (action === "exam-tab") { ex.tab = target.dataset.tab; render(); return; }
    if (action === "exam-resume") { resumeSavedRunner(); return; }
    if (action === "exam-discard-save") { clearSavedRunner(); render(); return; }
    if (action === "exam-material") {
      ex.openMaterialId = ex.openMaterialId === target.dataset.material ? null : target.dataset.material;
      render();
      return;
    }

    const exam = ex.activeExamId ? ex.cache[ex.activeExamId] : null;
    if (action === "exam-start-full" && exam) {
      startRunner(buildRunner(exam, fullMockSectionIds(exam), { fullMock: true }));
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

    // writing actions
    if (action === "exam-writing-open" && exam) { openWriting(exam, target.dataset.section); return; }
    if (ex.writing) {
      if (action === "exam-writing-start") { startWritingTask(target.dataset.task); return; }
      if (action === "exam-dictate") { dictation.active ? stopDictation() : startDictation(); return; }
      if (action === "exam-writing-submit") { submitWriting(); return; }
      if (action === "exam-writing-retry") { ex.writing.phase = "pick"; ex.writing.task = null; ex.writing.text = ""; renderWriting(); return; }
      if (action === "exam-writing-close") { closeWriting(); return; }
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
    if (action === "exam-play-audio") {
      const passage = (ex.runner.exam.passages || []).find((p) => p.id === target.dataset.passage);
      if (passage) playListening(passage);
      return;
    }
    if (action === "exam-stop-audio") { stopAudio(); return; }
    if (action === "exam-calculator") { toggleCalculator(); return; }
    if (action === "exam-calculator-close") { closeCalculator(); return; }
    if (action === "exam-multi-toggle") {
      const question = currentQuestion();
      const answer = answerFor(question.id);
      if (ex.runner.practice && answer.checked) return;
      const picked = new Set(Array.isArray(answer.value) ? answer.value.map(Number) : []);
      const idx = Number(target.dataset.index);
      if (picked.has(idx)) picked.delete(idx); else picked.add(idx);
      answer.value = [...picked].sort((a, b) => a - b);
      renderRunner();
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
      const questions = currentSection().questions;
      const unanswered = questions.filter((q) => !hasAnswer(ex.runner.answers.get(q.id))).length;
      const flagged = questions.filter((q) => ex.runner.answers.get(q.id)?.flagged).length;
      if (unanswered > 0 || flagged > 0) {
        const parts = [];
        if (unanswered > 0) parts.push(`${t("Без ответа", "Unanswered")}: ${unanswered}.`);
        if (flagged > 0) parts.push(`${t("Помечено флажком", "Flagged")}: ${flagged}.`);
        const sure = typeof confirmAction === "function"
          ? await confirmAction({
              title: t("Завершить секцию?", "Finish the section?"),
              text: `${parts.join(" ")} ${t("Вернуться будет нельзя.", "You won't be able to return.")}`,
              okText: t("Завершить", "Finish"),
            })
          : window.confirm(t("Есть вопросы без ответа. Завершить?", "There are unanswered questions. Finish?"));
        if (!sure) return;
      }
      finishSection();
      return;
    }
    if (action === "exam-retake") {
      const { exam: runExam, buildArgs } = ex.runner;
      stopRunner();
      startRunner(buildRunner(runExam, buildArgs.sectionIds, buildArgs.options));
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

  // an active timed attempt would be lost on accidental reload/close
  window.addEventListener("beforeunload", (event) => {
    if (ex.runner && !ex.runner.finished && ex.runner.answers.size > 0) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  // keyboard shortcuts inside the runner
  document.addEventListener("keydown", (event) => {
    if (ex.writing) {
      if (event.key === "Escape" && ex.writing.phase !== "checking") {
        event.stopImmediatePropagation();
        closeWriting();
      }
      return;
    }
    if (!ex.runner) return;
    if (event.key === "Escape" && !ex.runner.finished) {
      // app.js also listens for Escape to close the confirm modal we are about to open
      event.stopImmediatePropagation();
      exitRunner();
      return;
    }
    if (ex.runner.finished) return;
    if (event.target.matches("input, textarea")) return;
    const question = currentQuestion();
    if (!question) return;
    if (question.type !== "input" && /^[1-9]$/.test(event.key)) {
      const i = Number(event.key) - 1;
      if (i < question.choices.length) {
        const answer = answerFor(question.id);
        if (!(ex.runner.practice && answer.checked)) {
          if (question.type === "multi") {
            const picked = new Set(Array.isArray(answer.value) ? answer.value.map(Number) : []);
            if (picked.has(i)) picked.delete(i); else picked.add(i);
            answer.value = [...picked].sort((a, b) => a - b);
          } else {
            answer.value = i;
            if (ex.runner.practice) answer.checked = true;
          }
          renderRunner();
        }
      }
    } else if (event.key === "ArrowRight") { advance(); }
    else if (event.key === "ArrowLeft") { goToQuestion(ex.runner.questionIndex - 1); }
  });

  /* ---------- public API ---------- */
  window.StudyExams = {
    async onEnter() {
      // Deep link: /exams#ent opens the exam directly; also keeps browser Back working
      const hash = window.location.hash.slice(1);
      if (CATALOG.some((c) => c.id === hash)) {
        ex.view = "detail";
        ex.activeExamId = hash;
      } else {
        ex.view = "catalog";
      }
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
      if (ex.writing) renderWriting();
    },
    invalidateAttempts() { ex.attemptsLoaded = false; },
    // used by dashboard widget
    getAttempts() { return ex.attempts; },
  };
})();
