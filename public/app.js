const state = {
  me: null,
  subjects: [],
  tasks: [],
  goals: [],
  materials: [],
  sessions: [],
  dashboard: null,
  focus: null,
  analytics: null,
  aiHistory: [],
  aiStatus: null,
  aiConversation: [],
  aiBusy: false,
  selectedHeatmapDate: null,
};

function getToken() {
  return localStorage.getItem("authToken") || sessionStorage.getItem("authToken") || "";
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function toast(text) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

function formatDate(value, withTime = true) {
  if (!value) return "без срока";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "без срока";
  return d.toLocaleString("ru-RU", withTime ? {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  } : {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatTime(value) {
  const d = new Date(value);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function toDayKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function setHeatmapModalOpen(open) {
  const modal = document.getElementById("heatmapModal");
  if (!modal) return;
  modal.classList.toggle("show", open);
  modal.setAttribute("aria-hidden", String(!open));
  document.body.classList.toggle("heatmap-modal-open", open);
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isCompactLayout() {
  return window.matchMedia("(max-width: 1120px)").matches;
}

function setSidebarOpen(open) {
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("sidebarToggleBtn");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (!sidebar) return;

  const active = isCompactLayout() && open;
  document.body.classList.toggle("menu-open", active);
  sidebar.setAttribute("aria-hidden", isCompactLayout() ? String(!active) : "false");
  if (toggle) toggle.setAttribute("aria-expanded", String(active));
  if (backdrop) backdrop.setAttribute("aria-hidden", String(!active));
}

function setActiveRoute(route) {
  document.querySelectorAll(".nav-link").forEach((btn) => btn.classList.toggle("active", btn.dataset.route === route));
  document.querySelectorAll(".route").forEach((el) => el.classList.add("hidden"));
  document.getElementById(`route-${route}`)?.classList.remove("hidden");
  setSidebarOpen(false);
}

const materialTopicContent = {
  sat: {
    title: "SAT",
    tag: "международный экзамен",
    description: "Раздел для подготовки к SAT English: reading и writing. Подходит для поэтапной подготовки, повторения тем и решения пробных вариантов.",
    links: [
      { label: "Alikhan Prep", url: "https://alikhanprep.kz/sat-suite-question-bank/" },
    ],
    points: [
      { label: "Фокус", value: "Reading + Writing" },
      { label: "Формат", value: "Practice tests" },
      { label: "Подходит для", value: "Поступления" },
    ],
  },
  ielts: {
    title: "IELTS",
    links: [
      { label: "Your IELTS", url: "https://yourielts.ru/ielts-practice-tests" },
    ],
    tag: "английский язык",
    description: "Здесь можно собрать материалы для всех частей IELTS: listening, reading, writing и speaking. Удобно использовать для тренировки формата и регулярной языковой практики.",
    points: [
      { label: "Фокус", value: "4 sections" },
      { label: "Формат", value: "Academic practice" },
      { label: "Подходит для", value: "English exam" },
    ],
  },
  ege: {
    title: "ЕГЭ",
    tag: "школьная подготовка",
    description: "Раздел для подготовки к ЕГЭ по обязательным и профильным предметам. Можно использовать для конспектов, теории, тематических задач и пробников.",
    points: [
      { label: "Фокус", value: "Школьные предметы" },
      { label: "Формат", value: "Теория + практика" },
      { label: "Подходит для", value: "Экзамен ЕГЭ" },
    ],
  },
  ent: {
    title: "ЕНТ",
    tag: "национальное тестирование",
    description: "Подборка материалов для подготовки к ЕНТ: теория, практические задания и повторение по профильным направлениям. Удобно для структурированной подготовки по темам.",
    points: [
      { label: "Фокус", value: "Темы ЕНТ" },
      { label: "Формат", value: "Задачи + разбор" },
      { label: "Подходит для", value: "Тестирование" },
    ],
  },
  "school-books": {
    title: "Школьные учебники",
    tag: "базовая программа",
    description: "Раздел для обычных школьных учебников и дополнительных пособий. Здесь удобно хранить материалы по классам, предметам и темам для повседневной учебы.",
    points: [
      { label: "Фокус", value: "База по предметам" },
      { label: "Формат", value: "Учебники + пособия" },
      { label: "Подходит для", value: "Ежедневной учебы" },
    ],
  },
};

const satPractice = {
  loaded: false,
  loading: null,
  subject: "rw",
  subsection: "all",
  questionIndex: 0,
  crossoutMode: false,
  timer: null,
  bank: { rw: [] },
  progress: { answers: {}, crossed: {}, marked: {}, elapsed: {}, checks: {} },
};

const satSources = {
  rw: { label: "English" },
};

const satBankUrl = "./data/sat-question-bank.json";

function stripCountLabel(text) {
  return String(text || "").replace(/\s*\(\d+\)\s*$/, "").trim();
}

function cleanSatBody(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/Student-produced response directions[\s\S]*?Mark for Review/gi, "Mark for Review")
    .replace(/Section\s+\d,\s*Module\s+\d:\s*(?:Math|Reading and Writing)\s*Directions/gi, "")
    .replace(/\b\d{1,2}:\d{2}\b/g, "")
    .replace(/\b\d{2}%\b/g, "")
    .replace(/\bMark for Review\b/gi, "")
    .replace(/\b(?:Hide|Calculator|Reference|More|Answer Preview|Examples|Acceptable ways to enter answer|Unacceptable: will NOT receive credit)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSatChoice(text) {
  return String(text || "")
    .replace(/\b(?:Calculator|Reference|More|Hide)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractExplicitSatAnswer(raw) {
  const text = String(raw || "").replace(/\r/g, " ");
  const answerMatch = text.match(/(?:Correct\s+Answer|Answer\s+Key|Правильный\s+ответ)\s*[:\-]\s*([A-D]|[-+]?\d+(?:[./]\d+)?)/i);
  if (!answerMatch) return null;
  return answerMatch[1].trim().toUpperCase();
}

function getChoiceMarkers(text, regex) {
  const markers = [];
  let match;
  regex.lastIndex = 0;
  while ((match = regex.exec(text))) {
    const prefix = match[1] || "";
    const label = match[2];
    markers.push({
      label,
      start: match.index + prefix.length,
      contentStart: match.index + match[0].length,
    });
  }
  return markers;
}

function chooseChoiceMarkers(markers) {
  const labels = ["A", "B", "C", "D"];
  for (let i = 0; i < markers.length; i += 1) {
    if (markers[i].label !== "A") continue;
    const chosen = [markers[i]];
    let nextLabel = 1;
    for (let j = i + 1; j < markers.length && nextLabel < labels.length; j += 1) {
      if (markers[j].label === labels[nextLabel]) {
        chosen.push(markers[j]);
        nextLabel += 1;
      }
    }
    if (chosen.length === labels.length) return chosen;
  }
  return null;
}

function extractSatChoices(text) {
  const patterns = [
    /(^|\s)([ABCD])[\.\)]\s+/g,
    /(^|\s)\(([ABCD])\)\s*/g,
    /(^|\s)([ABCD])\s+(?=(?:[A-Z0-9$+\-]|\w[=<>≤≥]))/g,
  ];

  for (const pattern of patterns) {
    const markers = chooseChoiceMarkers(getChoiceMarkers(text, pattern));
    if (!markers) continue;
    const choices = markers.map((marker, index) => {
      const next = markers[index + 1];
      return cleanSatChoice(text.slice(marker.contentStart, next ? next.start : undefined));
    });
    if (choices.every(Boolean)) {
      return {
        questionText: text.slice(0, markers[0].start).trim(),
        choices,
      };
    }
  }

  return { questionText: text, choices: [] };
}

function parseSatQuestionBody(raw) {
  const correctAnswer = extractExplicitSatAnswer(raw);
  const cleaned = cleanSatBody(raw);
  const extracted = extractSatChoices(cleaned);
  let prompt = extracted.choices.length ? "Выберите лучший ответ." : "Введите ответ.";
  let passage = extracted.questionText || cleaned;
  const textStart = passage.search(/\bText 1\b/i);

  if (textStart > 8) {
    prompt = passage.slice(0, textStart).trim() || prompt;
    passage = passage.slice(textStart).trim();
  }

  return {
    prompt,
    passage,
    choices: extracted.choices,
    correctAnswer,
    raw: cleaned,
  };
}

function parseSatMarkdown(markdown, subject) {
  const lines = String(markdown || "").replace(/\r/g, "").split("\n");
  const questions = [];
  let domain = "";
  let subsection = "";
  let current = null;

  function finishCurrent() {
    if (!current) return;
    const entry = current;
    const raw = current.lines.join("\n").trim();
    current = null;
    if (!raw || /Нет извлеченных вопросов/i.test(raw)) return;
    const parsed = parseSatQuestionBody(raw);
    questions.push({
      id: `${subject}:${questions.length + 1}`,
      subject,
      number: questions.length + 1,
      sourceNumber: entry.sourceNumber,
      sourceFile: entry.sourceFile,
      sourcePage: entry.sourcePage,
      domain: entry.domain || domain || "SAT",
      subsection: entry.subsection || subsection || "General",
      ...parsed,
    });
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const domainMatch = trimmed.match(/^##\s+(.+)$/);
    const subsectionMatch = trimmed.match(/^###\s+(.+)$/);
    const sourceMatch = trimmed.match(/^\*\*(\d+)\.\s*Источник:\*\*\s*`([^`]+)`,\s*стр\.\s*(\d+)/);

    if (domainMatch && !subsectionMatch) {
      finishCurrent();
      domain = stripCountLabel(domainMatch[1]);
      subsection = "";
      continue;
    }

    if (subsectionMatch) {
      finishCurrent();
      subsection = stripCountLabel(subsectionMatch[1]);
      continue;
    }

    if (sourceMatch) {
      finishCurrent();
      current = {
        sourceNumber: Number(sourceMatch[1]),
        sourceFile: sourceMatch[2],
        sourcePage: sourceMatch[3],
        domain,
        subsection,
        lines: [],
      };
      continue;
    }

    if (trimmed === "---") {
      finishCurrent();
      continue;
    }

    if (current) current.lines.push(line);
  }

  finishCurrent();
  return questions;
}

function loadSatProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem("satPracticeProgressV1") || "{}");
    satPractice.progress = {
      answers: saved.answers || {},
      crossed: saved.crossed || {},
      marked: saved.marked || {},
      elapsed: saved.elapsed || {},
      checks: saved.checks || {},
    };
  } catch {
    satPractice.progress = { answers: {}, crossed: {}, marked: {}, elapsed: {}, checks: {} };
  }
}

function saveSatProgress() {
  localStorage.setItem("satPracticeProgressV1", JSON.stringify(satPractice.progress));
}

async function loadSatPracticeData() {
  if (satPractice.loaded) return;
  if (satPractice.loading) return satPractice.loading;

  satPractice.loading = fetch(satBankUrl).then((res) => {
    if (!res.ok) throw new Error("Не удалось загрузить новый SAT question bank.");
    return res.json();
  }).then((payload) => {
    const questions = Array.isArray(payload.questions) ? payload.questions : [];
    satPractice.bank.rw = questions.filter((question) => question.subject === "rw");
    loadSatProgress();
    satPractice.loaded = true;
    renderSatPractice();
  }).catch((error) => {
    const status = document.getElementById("satPracticeStatus");
    if (status) status.textContent = error.message || "Не удалось загрузить SAT вопросы.";
  });

  return satPractice.loading;
}

function satGroupKey(domain, subsection) {
  return `${domain}|||${subsection}`;
}

function getSatVisibleQuestions() {
  const questions = satPractice.bank[satPractice.subject] || [];
  if (satPractice.subsection === "all") return questions;
  return questions.filter((question) => satGroupKey(question.domain, question.subsection) === satPractice.subsection);
}

function getCurrentSatQuestion() {
  const questions = getSatVisibleQuestions();
  if (!questions.length) return null;
  if (satPractice.questionIndex >= questions.length) satPractice.questionIndex = 0;
  if (satPractice.questionIndex < 0) satPractice.questionIndex = questions.length - 1;
  return questions[satPractice.questionIndex];
}

function formatSatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderSatText(text) {
  const paragraphs = String(text || "").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return paragraphs.map((part) => `<p>${escapeHtml(part).replaceAll("\n", "<br>")}</p>`).join("");
}

function getSatSelectedAnswer(question) {
  return question ? String(satPractice.progress.answers[question.id] || "").trim() : "";
}

function getSatChoiceList(question) {
  const choices = Array.isArray(question?.choices) ? question.choices : [];
  if (choices.length) return choices;
  return [];
}

function normalizeSatAnswer(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function isSatAnswerCorrect(selected, correctAnswer) {
  const selectedText = normalizeSatAnswer(selected);
  if (!selectedText) return false;
  return String(correctAnswer || "")
    .split(/\s*,\s*|\s+or\s+/i)
    .map(normalizeSatAnswer)
    .filter(Boolean)
    .includes(selectedText);
}

function buildSatQuestionForAi(question) {
  if (!question) return "";
  const choiceList = getSatChoiceList(question);
  const choices = choiceList.length
    ? choiceList.map((choice, index) => {
      const letter = String.fromCharCode(65 + index);
      return `${letter}. ${choice || `Variant ${letter}`}`;
    }).join("\n")
    : "Free response question";

  return [
    `SAT section: ${satSources[question.subject]?.label || "SAT"}`,
    `Topic: ${question.domain} / ${question.subsection}`,
    `Question ID: ${question.sourceId || question.id || "unknown"}`,
    `Source: ${question.sourcePdf || question.sourceFile || "unknown"}`,
    "",
    "Question:",
    question.questionText || question.passage || question.raw,
    "",
    "Choices:",
    choices,
    "",
    "Correct answer:",
    question.correctAnswer || "Not available",
    "",
    "Official explanation:",
    question.rationale || "Not available",
  ].join("\n");
}

function renderSatCheckResult(question) {
  const result = document.getElementById("satCheckResult");
  if (!result || !question) return;
  const check = satPractice.progress.checks[question.id];
  result.className = "sat-check-result hidden";
  result.textContent = "";

  if (!check) return;

  result.classList.remove("hidden");
  result.classList.toggle("correct", check.status === "correct");
  result.classList.toggle("wrong", check.status === "wrong");
  result.innerHTML = escapeHtml(check.message || "").replaceAll("\n", "<br>");
}

function renderSatSubsections() {
  const select = document.getElementById("satSubsectionSelect");
  if (!select) return;

  const questions = satPractice.bank[satPractice.subject] || [];
  const currentValue = satPractice.subsection;
  const grouped = new Map();
  questions.forEach((question) => {
    if (!grouped.has(question.domain)) grouped.set(question.domain, new Map());
    const sections = grouped.get(question.domain);
    const key = satGroupKey(question.domain, question.subsection);
    sections.set(key, {
      label: question.subsection,
      count: (sections.get(key)?.count || 0) + 1,
    });
  });

  select.innerHTML = "";
  select.append(new Option(`Все вопросы (${questions.length})`, "all"));
  grouped.forEach((sections, domain) => {
    const group = document.createElement("optgroup");
    group.label = domain;
    sections.forEach((section, key) => {
      group.append(new Option(`${section.label} (${section.count})`, key));
    });
    select.append(group);
  });

  select.value = [...select.options].some((option) => option.value === currentValue) ? currentValue : "all";
  satPractice.subsection = select.value;
}

function renderSatTimer() {
  const timer = document.getElementById("satTimer");
  const question = getCurrentSatQuestion();
  if (!timer || !question) return;
  timer.textContent = formatSatTime(satPractice.progress.elapsed[question.id] || 0);
}

function ensureSatTimer() {
  if (satPractice.timer) return;
  satPractice.timer = window.setInterval(() => {
    const panel = document.getElementById("satPracticePanel");
    const question = getCurrentSatQuestion();
    if (!panel || panel.classList.contains("hidden") || !question) return;
    satPractice.progress.elapsed[question.id] = (satPractice.progress.elapsed[question.id] || 0) + 1;
    renderSatTimer();
    if (satPractice.progress.elapsed[question.id] % 5 === 0) saveSatProgress();
  }, 1000);
}

function renderSatPractice() {
  const panel = document.getElementById("satPracticePanel");
  if (!panel || panel.classList.contains("hidden")) return;

  document.querySelectorAll("[data-sat-subject]").forEach((button) => {
    button.classList.toggle("active", button.dataset.satSubject === satPractice.subject);
  });

  if (!satPractice.loaded) {
    const status = document.getElementById("satPracticeStatus");
    if (status) status.textContent = "Загрузка вопросов...";
    return;
  }

  renderSatSubsections();
  const questions = getSatVisibleQuestions();
  const question = getCurrentSatQuestion();
  const shell = document.getElementById("satExamShell");
  const status = document.getElementById("satPracticeStatus");

  if (!question || !questions.length) {
    if (shell) shell.hidden = true;
    if (status) status.textContent = "В этой подсекции пока нет вопросов.";
    return;
  }

  if (shell) shell.hidden = false;
  if (status) {
    status.textContent = `${satSources[satPractice.subject].label}: ${satPractice.bank[satPractice.subject].length} вопросов`;
  }

  const answered = questions.filter((item) => satPractice.progress.answers[item.id]).length;
  const marked = questions.filter((item) => satPractice.progress.marked[item.id]).length;
  const answeredNode = document.getElementById("satAnsweredCount");
  const markedNode = document.getElementById("satMarkedCount");
  if (answeredNode) answeredNode.textContent = `${answered} решено`;
  if (markedNode) markedNode.textContent = `${marked} отмечено`;

  const meta = document.getElementById("satQuestionMeta");
  if (meta) {
    const metaText = `${question.domain} / ${question.subsection} · ${question.topic || "SAT"} ${question.set ? `set ${question.set}` : ""} · ${question.difficulty || "practice"}`;
    meta.textContent = metaText;
  }

  const body = document.getElementById("satQuestionBody");
  if (body) {
    body.innerHTML = renderSatText(question.questionText || question.passage || question.raw);
  }

  const prompt = document.getElementById("satQuestionPrompt");
  const choiceList = getSatChoiceList(question);
  if (prompt) prompt.textContent = choiceList.length ? "Выберите лучший ответ." : "Введите ответ.";

  const counter = document.getElementById("satQuestionCounter");
  if (counter) counter.textContent = `${satPractice.questionIndex + 1} / ${questions.length}`;

  const markButton = document.getElementById("satMarkBtn");
  if (markButton) {
    const markedCurrent = !!satPractice.progress.marked[question.id];
    markButton.classList.toggle("active", markedCurrent);
    markButton.textContent = `${markedCurrent ? "★" : "☆"} Mark`;
  }

  const crossoutButton = document.getElementById("satCrossoutBtn");
  if (crossoutButton) crossoutButton.classList.toggle("active", satPractice.crossoutMode);

  const choices = document.getElementById("satChoices");
  const freeResponse = document.getElementById("satFreeResponse");
  const freeAnswer = document.getElementById("satFreeAnswer");
  const selected = satPractice.progress.answers[question.id] || "";
  const crossed = satPractice.progress.crossed[question.id] || {};

  if (choices) {
    choices.innerHTML = choiceList.length ? choiceList.map((choice, index) => {
      const letter = String.fromCharCode(65 + index);
      const choiceText = String(choice || "").trim() || `Вариант ${letter}`;
      const className = [
        "sat-choice",
        choice ? "" : "text-only-choice",
        selected === letter ? "selected" : "",
        crossed[letter] ? "crossed" : "",
      ].filter(Boolean).join(" ");
      return `
        <button class="${className}" type="button" data-sat-choice="${letter}">
          <span class="sat-choice-letter">${letter}</span>
          <span class="sat-choice-text">${escapeHtml(choiceText)}</span>
        </button>
      `;
    }).join("") : "";
  }

  if (freeResponse) freeResponse.classList.toggle("hidden", !!choiceList.length);
  if (freeAnswer) freeAnswer.value = choiceList.length ? "" : selected;

  renderSatCheckResult(question);
  renderSatTimer();
  ensureSatTimer();
}

async function checkCurrentSatAnswer() {
  const question = getCurrentSatQuestion();
  if (!question) return;

  const selected = getSatSelectedAnswer(question);
  const checkButton = document.getElementById("satCheckBtn");
  if (checkButton) {
    checkButton.disabled = true;
    checkButton.textContent = "Проверяю...";
  }

  try {
    if (question.correctAnswer) {
      const status = isSatAnswerCorrect(selected, question.correctAnswer) ? "correct" : "wrong";
      satPractice.progress.checks[question.id] = {
        status,
        message: [
          status === "correct" ? "Правильно." : "Пока неверно.",
          `Правильный ответ: ${question.correctAnswer}`,
          selected ? `Ваш ответ: ${selected}` : "Ваш ответ не выбран.",
          question.rationale ? `\nОбъяснение: ${question.rationale}` : "",
        ].join("\n"),
      };
      saveSatProgress();
      renderSatPractice();
      return;
    }

    satPractice.progress.checks[question.id] = {
      status: "pending",
      message: "В файле нет готового ключа ответа. Проверяю через ИИ...",
    };
    renderSatPractice();

    const aiPrompt = [
      "Проверь этот SAT-вопрос. Ответь по-русски.",
      "Сначала напиши строку: Правильный ответ: <буква или значение>.",
      "Потом коротко объясни почему. Если вопрос поврежден OCR и нельзя надежно решить, так и скажи.",
      selected ? `Ответ ученика: ${selected}` : "Ответ ученика: не выбран.",
      "",
      buildSatQuestionForAi(question),
    ].join("\n");

    const response = await api("/api/ai-plan", {
      method: "POST",
      body: { prompt: aiPrompt, history: [] },
    });

    satPractice.progress.checks[question.id] = {
      status: "ai",
      message: response.response || "ИИ не вернул ответ.",
    };
    saveSatProgress();
    renderSatPractice();
  } catch (error) {
    satPractice.progress.checks[question.id] = {
      status: "wrong",
      message: `Не удалось проверить ответ: ${error.message || "ошибка"}`,
    };
    saveSatProgress();
    renderSatPractice();
  } finally {
    if (checkButton) {
      checkButton.disabled = false;
      checkButton.textContent = "Проверить";
    }
  }
}

async function askAiAboutCurrentSatQuestion() {
  const question = getCurrentSatQuestion();
  if (!question) return;
  const selected = getSatSelectedAnswer(question);
  const prompt = [
    "Разбери этот SAT-вопрос по-русски.",
    "Дай правильный ответ и объясни ход решения простыми шагами.",
    "Если мой выбранный ответ неверный, объясни где ошибка.",
    selected ? `Мой ответ: ${selected}` : "Я пока не выбрал ответ.",
    "",
    buildSatQuestionForAi(question),
  ].join("\n");

  setActiveRoute("ai");
  await requestAiReply(prompt);
}

function bindSatPractice() {
  document.querySelectorAll("[data-sat-subject]").forEach((button) => {
    button.addEventListener("click", () => {
      satPractice.subject = button.dataset.satSubject;
      satPractice.subsection = "all";
      satPractice.questionIndex = 0;
      renderSatPractice();
    });
  });

  document.getElementById("satSubsectionSelect")?.addEventListener("change", (event) => {
    satPractice.subsection = event.target.value;
    satPractice.questionIndex = 0;
    renderSatPractice();
  });

  document.getElementById("satChoices")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sat-choice]");
    const question = getCurrentSatQuestion();
    if (!button || !question) return;
    const choice = button.dataset.satChoice;

    if (satPractice.crossoutMode) {
      const crossed = satPractice.progress.crossed[question.id] || {};
      crossed[choice] = !crossed[choice];
      satPractice.progress.crossed[question.id] = crossed;
    } else {
      satPractice.progress.answers[question.id] = satPractice.progress.answers[question.id] === choice ? "" : choice;
    }

    saveSatProgress();
    renderSatPractice();
  });

  document.getElementById("satFreeAnswer")?.addEventListener("input", (event) => {
    const question = getCurrentSatQuestion();
    if (!question) return;
    satPractice.progress.answers[question.id] = event.target.value.trim();
    saveSatProgress();
  });

  document.getElementById("satMarkBtn")?.addEventListener("click", () => {
    const question = getCurrentSatQuestion();
    if (!question) return;
    satPractice.progress.marked[question.id] = !satPractice.progress.marked[question.id];
    saveSatProgress();
    renderSatPractice();
  });

  document.getElementById("satCrossoutBtn")?.addEventListener("click", () => {
    satPractice.crossoutMode = !satPractice.crossoutMode;
    renderSatPractice();
  });

  document.getElementById("satPrevBtn")?.addEventListener("click", () => {
    satPractice.questionIndex -= 1;
    saveSatProgress();
    renderSatPractice();
  });

  document.getElementById("satNextBtn")?.addEventListener("click", () => {
    satPractice.questionIndex += 1;
    saveSatProgress();
    renderSatPractice();
  });

  document.getElementById("satClearBtn")?.addEventListener("click", () => {
    const question = getCurrentSatQuestion();
    if (!question) return;
    delete satPractice.progress.answers[question.id];
    delete satPractice.progress.crossed[question.id];
    delete satPractice.progress.checks[question.id];
    satPractice.progress.elapsed[question.id] = 0;
    saveSatProgress();
    renderSatPractice();
  });

  document.getElementById("satCheckBtn")?.addEventListener("click", checkCurrentSatAnswer);
  document.getElementById("satAskAiBtn")?.addEventListener("click", askAiAboutCurrentSatQuestion);
}

function renderMaterialTopic(topicKey) {
  const topic = materialTopicContent[topicKey];
  const title = document.getElementById("materialTopicTitle");
  const tag = document.getElementById("materialTopicTag");
  const description = document.getElementById("materialTopicDescription");
  const links = document.getElementById("materialTopicLinks");
  const points = document.getElementById("materialTopicPoints");
  const detailPanel = document.getElementById("materialTopicDetailPanel");
  const satPanel = document.getElementById("satPracticePanel");
  if (!topic || !title || !description || !links || !points) return;

  const isSat = topicKey === "sat";
  if (detailPanel) detailPanel.classList.toggle("hidden", isSat);
  if (satPanel) satPanel.classList.toggle("hidden", !isSat);
  if (isSat) {
    loadSatPracticeData();
    renderSatPractice();
  }

  title.textContent = topic.title;
  if (tag) tag.textContent = topic.tag;
  description.textContent = topic.description;
  links.innerHTML = (topic.links || []).map((item) => `
    <a class="btn btn-secondary" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a>
  `).join("");
  links.hidden = !(topic.links || []).length;
  points.innerHTML = topic.points.map((item) => `
    <div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>
  `).join("");

  document.querySelectorAll(".material-topic-card").forEach((button) => {
    const active = button.dataset.topic === topicKey;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function initMaterialTopics() {
  const buttons = document.querySelectorAll(".material-topic-card");
  if (!buttons.length) return;
  bindSatPractice();

  buttons.forEach((button) => {
    button.addEventListener("click", () => renderMaterialTopic(button.dataset.topic));
  });

  renderMaterialTopic(document.querySelector(".material-topic-card.active")?.dataset.topic || buttons[0].dataset.topic);
}

function initSidebarMenu() {
  const toggle = document.getElementById("sidebarToggleBtn");
  const close = document.getElementById("sidebarCloseBtn");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (!toggle || !close || !backdrop) return;

  toggle.addEventListener("click", () => {
    setSidebarOpen(!document.body.classList.contains("menu-open"));
  });

  close.addEventListener("click", () => setSidebarOpen(false));
  backdrop.addEventListener("click", () => setSidebarOpen(false));

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setSidebarOpen(false);
      setHeatmapModalOpen(false);
    }
  });

  window.addEventListener("resize", () => {
    setSidebarOpen(document.body.classList.contains("menu-open"));
  });

  setSidebarOpen(false);
}

async function handleLogout() {
  try { await api("/api/auth/logout", { method: "POST" }); } catch {}
  localStorage.removeItem("authToken");
  sessionStorage.removeItem("authToken");
  window.location.href = "/auth.html#login";
}

function fillSubjectSelects() {
  ["taskSubjectSelect", "goalSubjectSelect", "materialSubjectSelect", "sessionSubjectSelect"].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    const current = select.value;
    const firstLabel = select.querySelector("option")?.textContent || "Без предмета";
    select.innerHTML = `<option value="">${firstLabel}</option>` + state.subjects
      .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
      .join("");
    if (current) select.value = current;
  });
}

function renderEmpty(container, text) {
  container.innerHTML = `<div class="empty">${escapeHtml(text)}</div>`;
}

function renderAiStatus() {
  const aiStatus = state.aiStatus;
  const toolbarMode = document.getElementById("aiToolbarMode");
  const toolbarModels = document.getElementById("aiToolbarModels");
  const providerLabel = aiStatus?.provider === "openai"
    ? "OpenAI"
    : aiStatus?.provider === "openrouter"
      ? "OpenRouter"
      : "Локальный";

  if (toolbarMode) toolbarMode.textContent = aiStatus?.configured ? "Подключён" : "Резервный режим";
  if (toolbarModels) {
    toolbarModels.textContent = aiStatus?.configured
      ? (aiStatus.model || providerLabel)
      : "Внешняя модель не настроена";
  }
}

function setAiBusy(isBusy) {
  state.aiBusy = isBusy;
  const submit = document.getElementById("aiSubmitBtn");
  const smoke = document.getElementById("aiSmokeTestBtn");
  const prompt = document.getElementById("aiPrompt");
  const quickButtons = document.querySelectorAll(".ai-quick");
  if (submit) {
    submit.disabled = isBusy;
    submit.textContent = isBusy ? "Думаю..." : "Спросить AI";
  }
  if (smoke) smoke.disabled = isBusy;
  if (prompt) prompt.disabled = isBusy;
  quickButtons.forEach((button) => { button.disabled = isBusy; });
}

function getAiRequestHistory() {
  return state.aiConversation
    .filter((entry) => entry.role === "user" || entry.role === "assistant")
    .slice(-8)
    .map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));
}

function formatAiMeta(mode, source) {
  return mode === "live" ? "Live AI" : "Fallback";
}

async function requestAiReply(prompt, options = {}) {
  const text = String(prompt || "").trim();
  if (!text || state.aiBusy) return null;

  const history = getAiRequestHistory();
  const promptNode = document.getElementById("aiPrompt");

  addAiMessage(text, "user");
  if (promptNode && options.clearPrompt !== false) promptNode.value = "";

  setAiBusy(true);
  try {
    const res = await api("/api/ai-plan", {
      method: "POST",
      body: { prompt: text, history },
    });
    addAiMessage(res.response, "bot");
    await refresh();
    return res;
  } catch (error) {
    addAiMessage("Не удалось получить ответ. Попробуйте ещё раз через пару секунд.", "bot", "", { track: false });
    toast(error.message || "Ошибка AI");
    return null;
  } finally {
    setAiBusy(false);
  }
}

function renderTasks() {
  const container = document.getElementById("taskList");
  if (!state.tasks.length) return renderEmpty(container, "Пока нет задач.");

  container.innerHTML = state.tasks.map((task) => {
    const overdue = task.status !== "done" && task.dueDate && new Date(task.dueDate) < new Date();
    return `
      <div class="item-card ${overdue ? "danger-outline" : ""}">
        <div>
          <div class="item-title">${escapeHtml(task.title)}</div>
          <div class="item-meta">
            <span>${task.subject ? escapeHtml(task.subject.name) : "без предмета"}</span>
            <span>срок: ${escapeHtml(formatDate(task.dueDate))}</span>
            <span>${task.estimatedMins} мин</span>
            <span>focus ${task.focusScore}</span>
          </div>
          ${task.description ? `<div class="muted" style="margin-top:8px">${escapeHtml(task.description)}</div>` : ""}
          <div class="badges" style="margin-top:10px">
            <span class="badge ${task.status}">${task.status}</span>
            <span class="badge ${task.priority === "high" ? "high" : ""}">${task.priority}</span>
            ${overdue ? `<span class="badge high">просрочено</span>` : ""}
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-secondary js-task-status" data-id="${task.id}" data-status="todo">todo</button>
          <button class="btn btn-secondary js-task-status" data-id="${task.id}" data-status="doing">doing</button>
          <button class="btn btn-primary js-task-status" data-id="${task.id}" data-status="done">done</button>
          <button class="btn btn-danger js-task-delete" data-id="${task.id}">удалить</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderSubjects() {
  const container = document.getElementById("subjectList");
  if (!state.subjects.length) return renderEmpty(container, "Предметов нет. Тогда аналитика будет плоской.");

  const breakdown = state.analytics?.subjectBreakdown || [];
  container.innerHTML = state.subjects.map((subject) => {
    const extra = breakdown.find((x) => x.id === subject.id);
    return `
      <div class="item-card">
        <div>
          <div class="item-title"><span class="dot" style="background:${subject.color}"></span>${escapeHtml(subject.name)}</div>
          <div class="item-meta">
            <span>цель: ${subject.targetMinutes} мин/нед.</span>
            <span>задач: ${subject._count?.tasks || 0}</span>
            <span>сессий: ${subject._count?.studySessions || 0}</span>
            <span>week hit: ${extra ? extra.weeklyTargetHit : 0}%</span>
          </div>
          ${subject.description ? `<div class="muted" style="margin-top:8px">${escapeHtml(subject.description)}</div>` : ""}
          ${extra ? `<div class="progress"><span style="width:${Math.min(100, extra.weeklyTargetHit)}%;background:${subject.color}"></span></div>` : ""}
        </div>
        <div class="actions">
          <button class="btn btn-danger js-subject-delete" data-id="${subject.id}">удалить</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderGoals() {
  const container = document.getElementById("goalList");
  if (!state.goals.length) return renderEmpty(container, "Целей нет. Без измеримых целей прогресс не проверяется.");

  container.innerHTML = state.goals.map((goal) => {
    const progress = goal.targetValue ? Math.min(100, Math.round((goal.progressValue / goal.targetValue) * 100)) : 0;
    return `
      <div class="item-card">
        <div style="flex:1">
          <div class="item-title">${escapeHtml(goal.title)}</div>
          <div class="item-meta">
            <span>${goal.subject ? escapeHtml(goal.subject.name) : "без предмета"}</span>
            <span>дедлайн: ${goal.targetDate ? escapeHtml(new Date(goal.targetDate).toLocaleDateString("ru-RU")) : "не указан"}</span>
            <span>статус: ${escapeHtml(goal.status)}</span>
          </div>
          <div class="progress"><span style="width:${progress}%"></span></div>
          <div class="item-meta" style="margin-top:8px"><span>${goal.progressValue}/${goal.targetValue}</span><span>${progress}% выполнено</span></div>
        </div>
        <div class="actions">
          <button class="btn btn-secondary js-goal-progress" data-id="${goal.id}" data-delta="1">+1</button>
          <button class="btn btn-secondary js-goal-progress" data-id="${goal.id}" data-delta="5">+5</button>
          <button class="btn btn-danger js-goal-delete" data-id="${goal.id}">удалить</button>
        </div>
      </div>
    `;
  }).join("");
}

function materialKindLabel(kind) {
  return ({
    note: "Конспект",
    article: "Статья",
    video: "Видео",
    book: "Книга",
    practice: "Практика",
    link: "Ссылка",
  })[kind] || "Материал";
}

function getMaterialHost(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function renderMaterials() {
  const list = document.getElementById("materialList");
  const highlights = document.getElementById("materialHighlights");

  if (highlights) {
    if (!state.materials.length) {
      renderEmpty(highlights, "Пока нет учебных материалов. Добавьте первую ссылку, конспект или практику.");
    } else {
      const linkedCount = state.materials.filter((material) => material.url).length;
      const notesCount = state.materials.filter((material) => material.kind === "note").length;
      const kinds = Array.from(new Set(state.materials.map((material) => materialKindLabel(material.kind))));
      const bySubject = state.materials.reduce((map, material) => {
        const key = material.subject?.id || "none";
        const current = map.get(key) || {
          title: material.subject?.name || "Без предмета",
          count: 0,
          linked: 0,
        };
        current.count += 1;
        if (material.url) current.linked += 1;
        map.set(key, current);
        return map;
      }, new Map());
      const groups = Array.from(bySubject.values())
        .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "ru"))
        .slice(0, 4);

      highlights.innerHTML = `
        <div class="item-card">
          <div>
            <div class="item-title">Всего материалов: ${state.materials.length}</div>
            <div class="item-meta">
              <span>Со ссылкой: ${linkedCount}</span>
              <span>Конспектов: ${notesCount}</span>
            </div>
          </div>
          <div class="badges">
            ${kinds.map((label) => `<span class="badge">${escapeHtml(label)}</span>`).join("")}
          </div>
        </div>
        ${groups.map((group) => `
          <div class="item-card">
            <div>
              <div class="item-title">${escapeHtml(group.title)}</div>
              <div class="item-meta">
                <span>${group.count} шт.</span>
                <span>Ссылок: ${group.linked}</span>
              </div>
            </div>
          </div>
        `).join("")}
      `;
    }
  }

  if (!list) return;
  if (!state.materials.length) return renderEmpty(list, "Библиотека пуста. Сохраните сюда ссылки, заметки или практические материалы.");

  list.innerHTML = state.materials.map((material) => {
    const host = getMaterialHost(material.url);
    return `
      <div class="item-card">
        <div style="flex:1">
          <div class="item-title">${escapeHtml(material.title)}</div>
          <div class="item-meta">
            <span>${material.subject ? escapeHtml(material.subject.name) : "Без предмета"}</span>
            <span>${escapeHtml(materialKindLabel(material.kind))}</span>
            <span>${escapeHtml(formatDate(material.createdAt))}</span>
            ${host ? `<span>${escapeHtml(host)}</span>` : ""}
          </div>
          ${material.description ? `<div class="muted" style="margin-top:8px">${escapeHtml(material.description)}</div>` : ""}
        </div>
        <div class="actions">
          ${material.url ? `<a class="btn btn-secondary" href="${escapeHtml(material.url)}" target="_blank" rel="noreferrer">Открыть</a>` : ""}
          <button class="btn btn-danger js-material-delete" data-id="${material.id}">Удалить</button>
        </div>
      </div>
    `;
  }).join("");
}

function renderDashboard() {
  const d = state.dashboard;
  const a = state.analytics;
  if (!d || !a) return;

  document.getElementById("metricTotalTasks").textContent = d.metrics.totalTasks;
  document.getElementById("metricDoneTasks").textContent = d.metrics.doneTasks;
  document.getElementById("metricOverdueTasks").textContent = d.metrics.overdueTasks;
  document.getElementById("metricStreak").textContent = a.streak;
  const dashboardCompletion = document.getElementById("dashboardCompletion");
  if (dashboardCompletion) dashboardCompletion.textContent = `${d.metrics.completionRate}% completion`;

  const daily = a.dailyReview;
  document.getElementById("dailyReviewText").textContent = daily.summary;
  const dailyVerdict = document.getElementById("dailyVerdict");
  if (dailyVerdict) dailyVerdict.textContent = daily.verdict;
  document.getElementById("dailyReviewStats").innerHTML = `
    <div><span>Минут сегодня</span><strong>${daily.todayMinutes}</strong></div>
    <div><span>Сделано сегодня</span><strong>${daily.doneToday}</strong></div>
    <div><span>Просрочено</span><strong>${daily.overdue}</strong></div>
  `;

  const plan = a.todayPlan;
  document.getElementById("todayPlanHeadline").textContent = plan.headline;
  const todayPlanMode = document.getElementById("todayPlanMode");
  if (todayPlanMode) todayPlanMode.textContent = plan.mode;
  document.getElementById("todayPlanBlocks").innerHTML = plan.blocks.length ? plan.blocks.map((b) => `
    <div class="item-card">
      <div>
        <div class="item-title">${escapeHtml(b.label)}</div>
        <div class="item-meta">
          <span>${b.subject ? escapeHtml(b.subject.name) : "без предмета"}</span>
          <span>${formatTime(b.start)}–${formatTime(b.end)}</span>
          <span>${b.duration} мин</span>
        </div>
      </div>
      <div class="badge ${b.type === "recovery" ? "high" : "doing"}">${b.type}</div>
    </div>
  `).join("") : `<div class="empty">Открытых задач нет.</div>`;

  const tasksWrap = document.getElementById("dashboardTasks");
  const sampleTasks = d.tasks.slice(0, 5);
  tasksWrap.innerHTML = sampleTasks.length ? sampleTasks.map((task) => `
    <div class="item-card">
      <div>
        <div class="item-title">${escapeHtml(task.title)}</div>
        <div class="item-meta">
          <span>${task.subject ? escapeHtml(task.subject.name) : "без предмета"}</span>
          <span>${escapeHtml(formatDate(task.dueDate))}</span>
        </div>
      </div>
      <div class="badges"><span class="badge ${task.status}">${task.status}</span></div>
    </div>
  `).join("") : `<div class="empty">Пока нет задач.</div>`;

  const subjectsWrap = document.getElementById("dashboardSubjects");
  subjectsWrap.innerHTML = d.subjectBreakdown.length ? d.subjectBreakdown.map((subject) => `
    <div class="item-card">
      <div style="flex:1">
        <div class="item-title"><span class="dot" style="background:${subject.color}"></span>${escapeHtml(subject.name)}</div>
        <div class="item-meta"><span>${subject.doneTasks}/${subject.tasks} задач</span><span>${subject.weekMinutes}/${subject.targetMinutes} мин</span></div>
        <div class="progress"><span style="width:${Math.min(100, subject.weeklyTargetHit)}%;background:${subject.color}"></span></div>
      </div>
    </div>
  `).join("") : `<div class="empty">Нет предметов.</div>`;

  const goalsWrap = document.getElementById("dashboardGoals");
  goalsWrap.innerHTML = d.goals.slice(0, 4).length ? d.goals.slice(0, 4).map((goal) => {
    const progress = goal.targetValue ? Math.min(100, Math.round((goal.progressValue / goal.targetValue) * 100)) : 0;
    return `
      <div class="item-card">
        <div style="flex:1">
          <div class="item-title">${escapeHtml(goal.title)}</div>
          <div class="item-meta"><span>${goal.progressValue}/${goal.targetValue}</span><span>${goal.status}</span></div>
          <div class="progress"><span style="width:${progress}%"></span></div>
        </div>
      </div>
    `;
  }).join("") : `<div class="empty">Нет целей.</div>`;

  const agenda = document.getElementById("calendarAgenda");
  agenda.innerHTML = a.calendar.some((x) => x.items.length) ? a.calendar.map((day) => `
    <div class="calendar-day">
      <div class="calendar-date">${formatDate(day.date, false)}</div>
      <div class="calendar-items">
        ${day.items.length ? day.items.map((item) => `<div class="calendar-item"><span>${escapeHtml(item.title)}</span><strong>${formatTime(item.dueDate)}</strong></div>`).join("") : `<div class="muted">пусто</div>`}
      </div>
    </div>
  `).join("") : `<div class="empty">На 10 дней вперёд дедлайнов нет.</div>`;
}

function renderFocus() {
  const f = state.focus;
  if (!f) return;
  document.getElementById("focusRiskValue").textContent = f.risk;
  document.getElementById("focusRecommendation").textContent = f.recommendation;
  document.getElementById("focusMood").textContent = f.avgMood;
  document.getElementById("focusDoneToday").textContent = f.todayDone;
  document.getElementById("focusMinutesToday").textContent = f.todayMinutes;
}

function getHeatmapSessions(dateValue) {
  const dayKey = toDayKey(dateValue);
  return state.sessions
    .filter((session) => toDayKey(session.startedAt || session.createdAt) === dayKey)
    .sort((a, b) => new Date(a.startedAt || a.createdAt) - new Date(b.startedAt || b.createdAt));
}

function setHeatmapSelection(dateValue) {
  const grid = document.getElementById("heatmapGrid");
  const heatmap = state.analytics?.heatmap || [];
  if (!grid || !heatmap.length) return null;

  const selected = heatmap.find((cell) => cell.date === dateValue) || heatmap.at(-1);
  if (!selected) return null;

  state.selectedHeatmapDate = selected.date;
  grid.querySelectorAll(".heat-cell").forEach((cell) => {
    const active = cell.dataset.date === selected.date;
    cell.classList.toggle("active", active);
    cell.setAttribute("aria-pressed", String(active));
  });

  return selected;
}

function renderHeatmapDetail(dateValue) {
  const detail = document.getElementById("heatmapModalContent");
  const selected = setHeatmapSelection(dateValue);
  if (!detail || !selected) return;

  const sessions = getHeatmapSessions(selected.date);
  const totalMinutes = sessions.length ? sessions.reduce((sum, session) => sum + session.minutes, 0) : selected.minutes;
  const sessionLabel = sessions.length === 1 ? "сессия" : sessions.length >= 2 && sessions.length <= 4 ? "сессии" : "сессий";

  detail.innerHTML = `
    <div class="heatmap-detail-head">
      <div>
        <div class="item-title" id="heatmapModalTitle">${formatDate(selected.date, false)}</div>
        <div class="muted">Подробности по выбранному дню</div>
      </div>
      <div class="heatmap-detail-stats">
        <span>${totalMinutes} мин</span>
        <span>${sessions.length} ${sessionLabel}</span>
      </div>
    </div>
    ${sessions.length ? `
      <div class="heatmap-session-list">
        ${sessions.map((session) => `
          <div class="heatmap-session-item">
            <div class="item-title">${session.subject ? escapeHtml(session.subject.name) : "Без предмета"}</div>
            <div class="item-meta">
              <span>${formatTime(session.startedAt || session.createdAt)}–${formatTime(session.endedAt || session.createdAt)}</span>
              <span>${session.minutes} мин</span>
              <span>настроение ${session.mood}</span>
            </div>
            ${session.note ? `<div class="muted" style="margin-top:8px">${escapeHtml(session.note)}</div>` : ""}
          </div>
        `).join("")}
      </div>
    ` : `
      <div class="muted">За этот день подробных сессий в загруженном списке нет, но суммарная активность составила ${selected.minutes} мин.</div>
    `}
  `;
  setHeatmapModalOpen(true);
}

function renderInsights() {
  const a = state.analytics;
  if (!a) return;

  const heat = document.getElementById("heatmapGrid");
  heat.innerHTML = a.heatmap.map((cell) => `
    <button type="button" class="heat-cell level-${cell.level}" data-date="${cell.date}" aria-pressed="false" title="${formatDate(cell.date, false)} · ${cell.minutes} мин">
      <span class="sr-only">${formatDate(cell.date, false)} · ${cell.minutes} мин</span>
    </button>
  `).join("");
  const selectedHeatmapDate = state.selectedHeatmapDate && a.heatmap.some((cell) => cell.date === state.selectedHeatmapDate)
    ? state.selectedHeatmapDate
    : (a.heatmap.slice().reverse().find((cell) => cell.minutes > 0)?.date || a.heatmap.at(-1)?.date || null);
  if (selectedHeatmapDate) setHeatmapSelection(selectedHeatmapDate);

  const bars = document.getElementById("weeklyTrendChart");
  const max = Math.max(1, ...a.weeklyTrend.map((x) => x.minutes));
  bars.innerHTML = a.weeklyTrend.map((week) => `
    <div class="trend-card ${week.minutes === 0 ? "zero" : ""}">
      <div class="trend-card-head">
        <span class="trend-date">${escapeHtml(week.label)}</span>
        <span class="trend-minutes">${week.minutes} мин</span>
      </div>
      <div class="trend-bar-shell">
        <span class="trend-bar-fill" style="height:${Math.max(12, Math.round((week.minutes / max) * 148))}px"></span>
      </div>
    </div>
  `).join("");

  const sessionList = document.getElementById("sessionList");
  sessionList.innerHTML = a.recentSessions.length ? a.recentSessions.map((s) => `
    <div class="item-card">
      <div>
        <div class="item-title">${s.subject ? escapeHtml(s.subject.name) : "без предмета"}</div>
        <div class="item-meta"><span>${formatDate(s.createdAt)}</span><span>${s.minutes} мин</span><span>mood ${s.mood}</span></div>
        ${s.note ? `<div class="muted" style="margin-top:8px">${escapeHtml(s.note)}</div>` : ""}
      </div>
    </div>
  `).join("") : `<div class="empty">Сессий пока нет.</div>`;

  const risks = [];
  if (a.backlog.overdue > 0) risks.push({ title: "Просрочка", text: `Есть ${a.backlog.overdue} просроченных задач. Это ломает планирование.` });
  if (a.dailyReview.weakSubject) risks.push({ title: "Недокормленный предмет", text: `${a.dailyReview.weakSubject.name} отстаёт по weekly target.` });
  if ((state.focus?.risk || 0) >= 70) risks.push({ title: "Риск перегруза", text: "Нагрузка объективно высокая. Нужен режим сужения фронта работ." });
  if (a.streak === 0) risks.push({ title: "Нет серии дней", text: "Дисциплина не закреплена. Один рывок не заменяет рутину." });
  if (!risks.length) risks.push({ title: "Состояние устойчивое", text: "Критических проблем не видно. Можно усиливать качество, а не объём." });

  const riskWrap = document.getElementById("riskCards");
  riskWrap.innerHTML = risks.map((r) => `
    <div class="item-card">
      <div>
        <div class="item-title">${escapeHtml(r.title)}</div>
        <div class="muted">${escapeHtml(r.text)}</div>
      </div>
    </div>
  `).join("");
}

function addAiMessage(text, role = "bot", meta = "", options = {}) {
  const wrap = document.getElementById("aiMessages");
  if (!wrap) return;
  const normalizedRole = role === "user" ? "user" : "bot";
  if (options.track !== false) {
    state.aiConversation.push({
      role: normalizedRole === "user" ? "user" : "assistant",
      content: String(text || ""),
    });
  }
  const div = document.createElement("div");
  div.className = `msg ${normalizedRole}`;
  div.innerHTML = `${meta ? `<div class="chat-meta">${escapeHtml(meta)}</div>` : ""}${escapeHtml(text).replaceAll("\n", "<br>")}`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
}

function renderAiHistory() {
  const wrap = document.getElementById("aiHistory");
  if (!wrap) return;
  if (!state.aiHistory.length) return renderEmpty(wrap, "Ответов пока нет.");
  wrap.innerHTML = state.aiHistory.map((item) => `
    <div class="item-card vertical">
      <div class="item-title">${escapeHtml(item.prompt)}</div>
      <div class="muted">${escapeHtml(item.response).replaceAll("\n", "<br>")}</div>
      <div class="item-meta"><span>${formatDate(item.createdAt)}</span><span>${escapeHtml(item.aiMode || "fallback")}</span><span>${escapeHtml((item.aiSource || "local").replace("openai:", "").replace("openrouter:", ""))}</span></div>
    </div>
  `).join("");
}

async function loadAll() {
  const [me, subjects, tasks, goals, materials, sessions, dashboard, focus, analytics, aiHistory, aiStatus] = await Promise.all([
    api("/api/auth/me"),
    api("/api/subjects"),
    api("/api/tasks"),
    api("/api/goals"),
    api("/api/materials"),
    api("/api/sessions"),
    api("/api/dashboard"),
    api("/api/focus-mode"),
    api("/api/analytics"),
    api("/api/ai-history"),
    api("/api/ai-status"),
  ]);
  state.me = me.user;
  state.subjects = subjects;
  state.tasks = tasks;
  state.goals = goals;
  state.materials = materials;
  state.sessions = sessions;
  state.dashboard = dashboard;
  state.focus = focus;
  state.analytics = analytics;
  state.aiHistory = aiHistory;
  state.aiStatus = aiStatus;

  const logoutLabel = "\u0412\u044b\u0439\u0442\u0438";
  const logoutBtn = document.getElementById("logoutBtn");
  const logoutMenuBtn = document.getElementById("logoutMenuBtn");
  if (logoutBtn) logoutBtn.textContent = logoutLabel;
  if (logoutMenuBtn) logoutMenuBtn.textContent = logoutLabel;
  document.getElementById("userEmail").textContent = state.me.email;
  const mobileEmail = document.getElementById("userEmailMenu");
  if (mobileEmail) mobileEmail.textContent = state.me.email;
  renderAiStatus();
  fillSubjectSelects();
  renderTasks();
  renderSubjects();
  renderGoals();
  renderMaterials();
  renderDashboard();
  renderFocus();
  renderInsights();
  renderAiHistory();
}

async function refresh() {
  await loadAll();
}

function bindNavigation() {
  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.addEventListener("click", () => setActiveRoute(btn.dataset.route));
  });
}

function bindForms() {
  document.getElementById("taskForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await api("/api/tasks", {
      method: "POST",
      body: {
        title: form.get("title"),
        subjectId: form.get("subjectId") || null,
        dueDate: form.get("dueDate") || null,
        priority: form.get("priority"),
        estimatedMins: Number(form.get("estimatedMins") || 30),
        focusScore: Number(form.get("focusScore") || 60),
        description: form.get("description"),
      },
    });
    e.target.reset();
    document.querySelector('#taskForm [name="priority"]').value = 'medium';
    document.querySelector('#taskForm [name="estimatedMins"]').value = 30;
    document.querySelector('#taskForm [name="focusScore"]').value = 60;
    toast("Задача добавлена");
  });

  document.getElementById("subjectForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await api("/api/subjects", {
      method: "POST",
      body: {
        name: form.get("name"),
        color: form.get("color"),
        targetMinutes: Number(form.get("targetMinutes") || 240),
        description: form.get("description"),
      },
    });
    e.target.reset();
    document.querySelector('#subjectForm [name="color"]').value = '#5b8cff';
    document.querySelector('#subjectForm [name="targetMinutes"]').value = 240;
    toast("Предмет добавлен");
    await refresh();
  });

  document.getElementById("goalForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await api("/api/goals", {
      method: "POST",
      body: {
        title: form.get("title"),
        subjectId: form.get("subjectId") || null,
        targetValue: Number(form.get("targetValue") || 10),
        progressValue: Number(form.get("progressValue") || 0),
        targetDate: form.get("targetDate") || null,
        description: form.get("description"),
      },
    });
    e.target.reset();
    document.querySelector('#goalForm [name="targetValue"]').value = 10;
    document.querySelector('#goalForm [name="progressValue"]').value = 0;
    toast("Цель добавлена");
    await refresh();
  });

  document.getElementById("materialForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await api("/api/materials", {
      method: "POST",
      body: {
        title: form.get("title"),
        subjectId: form.get("subjectId") || null,
        kind: form.get("kind"),
        url: form.get("url"),
        description: form.get("description"),
      },
    });
    e.target.reset();
    document.querySelector('#materialForm [name="kind"]').value = "note";
    toast("Материал сохранён");
    await refresh();
  });

  document.getElementById("sessionForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    await api("/api/sessions", {
      method: "POST",
      body: {
        subjectId: form.get("subjectId") || null,
        minutes: Number(form.get("minutes") || 25),
        mood: Number(form.get("mood") || 3),
        note: form.get("note"),
      },
    });
    e.target.reset();
    document.querySelector('#sessionForm [name="minutes"]').value = 25;
    document.querySelector('#sessionForm [name="mood"]').value = 3;
    toast("Сессия записана");
    await refresh();
  });

  document.getElementById("aiForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const prompt = document.getElementById("aiPrompt")?.value.trim();
    if (!prompt) return;
    await requestAiReply(prompt);
  });
  document.getElementById("aiPrompt")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      document.getElementById("aiForm")?.requestSubmit();
    }
  });
}

function bindActions() {
  document.body.addEventListener("click", async (e) => {
    const taskStatus = e.target.closest(".js-task-status");
    if (taskStatus) {
      await api(`/api/tasks/${taskStatus.dataset.id}`, { method: "PATCH", body: { status: taskStatus.dataset.status } });
      toast("Статус обновлён");
      return refresh();
    }

    const taskDelete = e.target.closest(".js-task-delete");
    if (taskDelete) {
      await api(`/api/tasks/${taskDelete.dataset.id}`, { method: "DELETE" });
      toast("Задача удалена");
      return refresh();
    }

    const subjectDelete = e.target.closest(".js-subject-delete");
    if (subjectDelete) {
      await api(`/api/subjects/${subjectDelete.dataset.id}`, { method: "DELETE" });
      toast("Предмет удалён");
      return refresh();
    }

    const goalProgress = e.target.closest(".js-goal-progress");
    if (goalProgress) {
      const goal = state.goals.find((g) => g.id === goalProgress.dataset.id);
      if (!goal) return;
      const next = (goal.progressValue || 0) + Number(goalProgress.dataset.delta || 1);
      const status = next >= goal.targetValue ? "done" : goal.status;
      await api(`/api/goals/${goal.id}`, { method: "PATCH", body: { progressValue: next, status } });
      toast("Прогресс цели обновлён");
      return refresh();
    }

    const goalDelete = e.target.closest(".js-goal-delete");
    if (goalDelete) {
      await api(`/api/goals/${goalDelete.dataset.id}`, { method: "DELETE" });
      toast("Цель удалена");
      return refresh();
    }

    const materialDelete = e.target.closest(".js-material-delete");
    if (materialDelete) {
      await api(`/api/materials/${materialDelete.dataset.id}`, { method: "DELETE" });
      toast("Материал удалён");
      return refresh();
    }

    const quick = e.target.closest(".ai-quick");
    if (quick) {
      document.getElementById("aiPrompt").value = quick.dataset.prompt;
      document.getElementById("aiForm").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }

    const heatCell = e.target.closest(".heat-cell");
    if (heatCell?.dataset.date) {
      renderHeatmapDetail(heatCell.dataset.date);
      return;
    }

    if (e.target.closest("#heatmapModalClose")) {
      setHeatmapModalOpen(false);
      return;
    }

    if (e.target.id === "heatmapModal") {
      setHeatmapModalOpen(false);
      return;
    }

    const jump = e.target.closest(".nav-jump");
    if (jump) setActiveRoute(jump.dataset.route);
  });

  document.getElementById("aiStatusRefreshBtn")?.addEventListener("click", async () => {
    state.aiStatus = await api("/api/ai-status");
    renderAiStatus();
    toast("Статус AI обновлён");
  });

  document.getElementById("aiSmokeTestBtn")?.addEventListener("click", async () => {
    setActiveRoute("ai");
    const prompt = "Дай короткий план на сегодня по моей самой важной учебной задаче.";
    const res = await requestAiReply(prompt);
    if (!res) return;
    if (res.aiMode === "live") toast("Live AI ответил");
    else toast("Сработал fallback: live AI сейчас недоступен");
  });

  document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);
  document.getElementById("logoutMenuBtn")?.addEventListener("click", handleLogout);
}

async function init() {
  try {
    initSidebarMenu();
    bindNavigation();
    bindForms();
    bindActions();
    initMaterialTopics();
    await loadAll();
  } catch (error) {
    console.error(error);
    toast(error.message || "Ошибка загрузки");
    if (/not authorized|invalid token/i.test(String(error.message))) {
      localStorage.removeItem("authToken");
      sessionStorage.removeItem("authToken");
      window.location.href = "/auth.html#login";
    }
  }
}

document.addEventListener("DOMContentLoaded", init);
