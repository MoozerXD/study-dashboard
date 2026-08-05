// Server-rendered public pages (landing + one page per exam).
// These exist so search engines and first-time visitors get real content
// without logging in — the app itself stays a client-rendered SPA.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examsDir = path.join(__dirname, "../public/data/exams");

export const EXAM_IDS = ["ent", "ege", "ielts", "sat"];
const LANGS = ["ru", "en"];

/* ---------------------------------------------------------------- data --- */

const cache = { exams: null, pages: new Map() };

function loadExams() {
  if (cache.exams) return cache.exams;
  const exams = {};
  for (const id of EXAM_IDS) {
    try {
      exams[id] = JSON.parse(fs.readFileSync(path.join(examsDir, `${id}.json`), "utf8"));
    } catch {
      exams[id] = null;
    }
  }
  cache.exams = exams;
  return exams;
}

export function clearSeoCache() {
  cache.exams = null;
  cache.pages.clear();
}

// Shared with the demo endpoint so the banks are parsed once, not per request.
export function getExamBank(examId) {
  return loadExams()[examId] || null;
}

/* -------------------------------------------------------------- helpers --- */

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function pick(value, lang) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value[lang] || value.ru || value.en || "";
}

function t(lang, ru, en) {
  return lang === "en" ? en : ru;
}

function plural(n, forms, lang) {
  if (lang === "en") return forms[3];
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}
const QUESTIONS = ["вопрос", "вопроса", "вопросов", "questions"];
const TASKS = ["задание", "задания", "заданий", "tasks"];

// Fills {n} with the count and {q}/{task} with the correctly declined noun.
function fillCount(template, n, lang) {
  return String(template)
    .replaceAll("{n}", n)
    .replaceAll("{q}", plural(n, QUESTIONS, lang))
    .replaceAll("{task}", plural(n, TASKS, lang));
}

// Minimal markdown → HTML for the prep materials stored in the exam banks.
function renderMarkdown(md) {
  const lines = String(md || "").replace(/\r/g, "").split("\n");
  const out = [];
  let list = null;
  let tableRows = null;

  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const closeTable = () => {
    if (!tableRows) return;
    const [head, ...body] = tableRows;
    const cells = (row, tag) => row.map((c) => `<${tag}>${inline(c)}</${tag}>`).join("");
    out.push(`<div class="table-wrap"><table><thead><tr>${cells(head, "th")}</tr></thead><tbody>${body.map((r) => `<tr>${cells(r, "td")}</tr>`).join("")}</tbody></table></div>`);
    tableRows = null;
  };
  const inline = (text) => escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*(?!\s)([^*]+?)\*/g, "<em>$1</em>");

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (/^\|.*\|$/.test(trimmed)) {
      closeList();
      const cells = trimmed.slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      (tableRows ||= []).push(cells);
      continue;
    }
    closeTable();
    if (!trimmed) { closeList(); continue; }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) { closeList(); const level = Math.min(6, heading[1].length + 2); out.push(`<h${level}>${inline(heading[2])}</h${level}>`); continue; }
    const bullet = trimmed.match(/^[-•]\s+(.+)$/);
    if (bullet) { if (list !== "ul") { closeList(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(bullet[1])}</li>`); continue; }
    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) { if (list !== "ol") { closeList(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(numbered[1])}</li>`); continue; }
    closeList();
    out.push(`<p>${inline(trimmed)}</p>`);
  }
  closeList();
  closeTable();
  return out.join("");
}

/* ----------------------------------------------------------- exam meta --- */

const EXAM_META = {
  ent: {
    flag: "🇰🇿",
    accent: "#22c1a3",
    name: { ru: "ЕНТ", en: "UNT" },
    seoTitle: {
      ru: "Пробный тест ЕНТ онлайн — {n} {q} с разбором | Study Dashboard",
      en: "UNT practice test online — {n} questions with explanations | Study Dashboard",
    },
    seoDescription: {
      ru: "Бесплатный пробный ЕНТ онлайн: история Казахстана, математическая и читательская грамотность, профильные предметы. {n} {q} с объяснениями, таймер как на экзамене, подсчёт баллов и разбор ошибок.",
      en: "Free UNT practice test online: History of Kazakhstan, mathematical and reading literacy, profile subjects. {n} questions with explanations, exam timer, scoring and mistake review.",
    },
    heading: {
      ru: "Пробный тест ЕНТ онлайн",
      en: "UNT practice test online",
    },
    lede: {
      ru: "Проходи пробное ЕНТ в формате настоящего экзамена: обязательные предметы плюс профильная пара на выбор, таймер на каждую секцию, подсчёт баллов из 140 и разбор каждой ошибки.",
      en: "Take a UNT mock in the real exam format: mandatory subjects plus a profile pair of your choice, a timer for every section, scoring out of 140 and a review of every mistake.",
    },
    faq: {
      ru: [
        ["Сколько баллов нужно набрать на ЕНТ?", "Порог допуска для большинства специальностей — 50 баллов из 140. Для получения гранта обычно требуется 70–110 баллов в зависимости от конкурса, а на самые востребованные специальности проходной балл доходит до 120 и выше."],
        ["Какие предметы входят в ЕНТ?", "Три обязательных предмета — история Казахстана, математическая грамотность и грамотность чтения — плюс два профильных, которые вы выбираете под специальность. В тренажёре доступны пары «математика + физика» и «биология + химия»."],
        ["Сколько длится ЕНТ?", "Полный экзамен занимает около 4 часов. В нашем пробнике на каждую секцию отводится своё время: 20 минут на историю и математическую грамотность, 25 на грамотность чтения и по 40 минут на профильные предметы."],
        ["Бывают ли в ЕНТ вопросы с несколькими правильными ответами?", "Да, по профильным предметам и истории встречаются задания, где из шести вариантов нужно выбрать несколько верных. Балл начисляется только за полностью правильную комбинацию — в тренажёре такие вопросы работают точно так же."],
        ["Как готовиться к ЕНТ с нуля?", "Начните с диагностического пробника, чтобы увидеть слабые темы. Затем 6–8 недель работайте по плану: разбирайте темы с наибольшим числом ошибок, каждую неделю проходите один пробник целиком и обязательно читайте объяснения к неверным ответам."],
      ],
      en: [
        ["What score do you need on the UNT?", "The admission threshold for most programs is 50 points out of 140. A state grant usually requires 70–110 points depending on competition, and the most popular programs can demand 120 or more."],
        ["Which subjects are on the UNT?", "Three mandatory subjects — History of Kazakhstan, mathematical literacy and reading literacy — plus two profile subjects matching your intended program. This trainer offers the Math + Physics and Biology + Chemistry pairs."],
        ["How long does the UNT take?", "The full exam runs about 4 hours. In this mock every section is timed separately: 20 minutes for history and mathematical literacy, 25 for reading literacy and 40 minutes for each profile subject."],
        ["Does the UNT have multiple-answer questions?", "Yes. Profile subjects and history include questions where several of six options are correct. Points are awarded only for a fully correct combination, and the trainer grades them the same way."],
        ["How do you prepare for the UNT from scratch?", "Start with a diagnostic mock to reveal weak topics. Then work for 6–8 weeks: drill the topics with the most mistakes, take one full mock every week, and always read the explanation for every wrong answer."],
      ],
    },
  },
  ege: {
    flag: "🇷🇺",
    accent: "#5b8cff",
    name: { ru: "ЕГЭ", en: "EGE" },
    seoTitle: {
      ru: "Пробный ЕГЭ онлайн — {n} {task} с ответами и разбором | Study Dashboard",
      en: "EGE practice test online — {n} tasks with answers | Study Dashboard",
    },
    seoDescription: {
      ru: "Онлайн-тренажёр ЕГЭ: русский язык, математика база и профиль, физика, информатика, обществознание, история. {n} {task} с объяснениями и сочинение с проверкой по критериям К1–К12.",
      en: "EGE online trainer: Russian, basic and advanced maths, physics, informatics, social studies, history. {n} tasks with explanations plus an essay graded against the official criteria.",
    },
    heading: {
      ru: "Пробный ЕГЭ онлайн",
      en: "EGE practice test online",
    },
    lede: {
      ru: "Тренажёр ЕГЭ с таймером и разбором: выбирайте обязательные предметы и до двух по выбору, решайте задания с кратким ответом и пишите сочинение — его проверит ИИ по критериям К1–К12.",
      en: "An EGE trainer with a timer and full review: pick the mandatory subjects plus up to two optional ones, solve short-answer tasks and write the essay — graded by AI against the official criteria.",
    },
    faq: {
      ru: [
        ["Какие предметы обязательны на ЕГЭ?", "Обязательны русский язык и математика — базовая или профильная. Остальные предметы вы выбираете сами под требования вуза, обычно один или два. В тренажёре полный пробник собирается так же: обязательные плюс до двух предметов по выбору."],
        ["Как проверяется сочинение по русскому языку?", "Задание 27 оценивается по двенадцати критериям К1–К12: формулировка проблемы, комментарий с двумя примерами, позиция автора, обоснование своего мнения, а также грамотность. Максимум — 24 первичных балла. В тренажёре сочинение проверяет ИИ-экзаменатор и показывает балл по каждому критерию с цитатами ошибок."],
        ["Сколько баллов нужно, чтобы сдать ЕГЭ?", "Минимальные пороги различаются по предметам и составляют примерно 40 тестовых баллов для поступления в вуз. Результат 60–80 считается хорошим, а 80 и выше — сильным и конкурентным для бюджетных мест."],
        ["Чем отличается базовая математика от профильной?", "Базовая проверяет умение считать в практических ситуациях и нужна для получения аттестата. Профильная включает алгебру, начала анализа, стереометрию и требуется для поступления на технические, экономические и естественнонаучные направления."],
        ["Можно ли подготовиться к ЕГЭ за несколько месяцев?", "Да, если работать системно. Пройдите диагностику по каждому предмету, выпишите темы с ошибками и закрывайте их по одной, чередуя теорию и решение заданий. За месяц до экзамена переходите на полные пробники с таймером, чтобы натренировать темп."],
      ],
      en: [
        ["Which EGE subjects are mandatory?", "Russian and mathematics — basic or advanced — are mandatory. You choose the rest according to your university's requirements, usually one or two. The full mock here is assembled the same way: mandatory subjects plus up to two optional ones."],
        ["How is the Russian essay graded?", "Task 27 is assessed against twelve criteria (K1–K12): stating the problem, a commentary with two examples, the author's position, your own reasoned opinion, and language accuracy. The maximum is 24 raw points. Here an AI examiner grades the essay and shows the score for every criterion with quoted mistakes."],
        ["What score do you need to pass the EGE?", "Minimum thresholds vary by subject and sit around 40 scaled points for university admission. A result of 60–80 is considered good, and 80 or above is strong and competitive for state-funded places."],
        ["How does basic maths differ from advanced?", "Basic maths tests practical calculation and is enough for the school certificate. Advanced maths covers algebra, calculus and solid geometry, and is required for engineering, economics and science programs."],
        ["Can you prepare for the EGE in a few months?", "Yes, with a system. Run a diagnostic in each subject, list the topics you get wrong and close them one by one, alternating theory and practice. A month before the exam switch to full timed mocks to train your pacing."],
      ],
    },
  },
  ielts: {
    flag: "🌍",
    accent: "#b478ff",
    name: { ru: "IELTS", en: "IELTS" },
    seoTitle: {
      ru: "IELTS онлайн-тренажёр — Listening, Reading, Writing и Speaking | Study Dashboard",
      en: "IELTS practice online — Listening, Reading, Writing and Speaking | Study Dashboard",
    },
    seoDescription: {
      ru: "Бесплатная практика IELTS Academic: аудирование с озвучкой, академическое чтение, эссе Task 1 и Task 2 с оценкой по band-дескрипторам и говорение с распознаванием речи. {n} {q} с объяснениями.",
      en: "Free IELTS Academic practice: listening with audio, academic reading, Task 1 and Task 2 essays graded against band descriptors, and speaking with voice recognition. {n} questions with explanations.",
    },
    heading: {
      ru: "Практика IELTS: все четыре модуля",
      en: "IELTS practice: all four modules",
    },
    lede: {
      ru: "Тренируйте IELTS Academic целиком: слушайте записи с ограничением в два прослушивания, читайте академические тексты, пишите эссе и отвечайте голосом — ИИ-экзаменатор оценит по официальным критериям и объяснит каждый снятый балл.",
      en: "Practise the whole IELTS Academic test: listen to recordings limited to two plays, read academic passages, write essays and answer out loud — an AI examiner grades against the official criteria and explains every deduction.",
    },
    faq: {
      ru: [
        ["Из каких частей состоит IELTS?", "Экзамен состоит из четырёх модулей: Listening (около 30 минут), Reading (60 минут), Writing (60 минут) и Speaking (11–14 минут). Listening и Speaking одинаковы для Academic и General Training, а Reading и Writing различаются."],
        ["Что такое band score и какой балл нужен?", "Результат каждого модуля оценивается по шкале от 1 до 9 с шагом в половину балла, а итоговый балл — среднее по четырём модулям. Большинству университетов достаточно band 6.0–7.0, топовым программам нужно 7.5 и выше."],
        ["Сколько раз можно прослушать запись в Listening?", "На настоящем экзамене запись включают только один раз. В нашем тренажёре разрешено до двух прослушиваний, чтобы можно было сначала разобраться в формате, а затем тренироваться в экзаменационном режиме."],
        ["Как оценивается Writing?", "Каждое задание оценивается по четырём критериям: Task Achievement, Coherence and Cohesion, Lexical Resource и Grammatical Range and Accuracy. Task 1 требует минимум 150 слов, Task 2 — минимум 250, причём Task 2 весит вдвое больше."],
        ["Можно ли тренировать Speaking без собеседника?", "Да. В тренажёре вы отвечаете вслух на реальные вопросы всех трёх частей, браузер распознаёт речь, а ИИ оценивает содержание, словарный запас и грамматику. Произношение по расшифровке оценить нельзя, и система честно об этом сообщает."],
      ],
      en: [
        ["What parts does IELTS consist of?", "The exam has four modules: Listening (about 30 minutes), Reading (60 minutes), Writing (60 minutes) and Speaking (11–14 minutes). Listening and Speaking are identical for Academic and General Training, while Reading and Writing differ."],
        ["What is a band score and what do you need?", "Each module is scored from 1 to 9 in half-band steps, and the overall score is the average of the four. Most universities ask for band 6.0–7.0, while top programs require 7.5 or higher."],
        ["How many times can you hear the Listening audio?", "In the real exam the recording plays only once. This trainer allows up to two plays so you can first learn the format and then practise under exam conditions."],
        ["How is Writing assessed?", "Each task is graded on four criteria: Task Achievement, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy. Task 1 needs at least 150 words and Task 2 at least 250, with Task 2 carrying double weight."],
        ["Can you practise Speaking without a partner?", "Yes. You answer real questions from all three parts out loud, the browser transcribes your speech, and the AI grades content, vocabulary and grammar. Pronunciation cannot be judged from a transcript, and the system says so openly."],
      ],
    },
  },
  sat: {
    flag: "🇺🇸",
    accent: "#ffb020",
    name: { ru: "SAT", en: "SAT" },
    seoTitle: {
      ru: "SAT онлайн: {n} {task} с разбором — Reading, Writing и Math | Study Dashboard",
      en: "Digital SAT practice online — {n} questions with explanations | Study Dashboard",
    },
    seoDescription: {
      ru: "Подготовка к цифровому SAT: {n} {task} Reading and Writing и Math с объяснениями, задания с вводом ответа, таймер и оценка по шкале 400–1600.",
      en: "Digital SAT prep: {n} Reading and Writing and Math questions with explanations, student-produced response items, exam timer and 400–1600 scoring.",
    },
    heading: {
      ru: "Подготовка к SAT онлайн",
      en: "Digital SAT practice online",
    },
    lede: {
      ru: "Решайте задания цифрового SAT в формате экзамена: две секции с таймером, вопросы с выбором и вводом ответа, оценка по шкале 400–1600 и подробное объяснение к каждому заданию.",
      en: "Work through Digital SAT questions in exam format: two timed sections, multiple-choice and student-produced response items, 400–1600 scoring and a detailed explanation for every question.",
    },
    faq: {
      ru: [
        ["Как устроен цифровой SAT?", "С 2024 года SAT полностью цифровой и адаптивный. Он состоит из двух секций — Reading and Writing и Math, — каждая из которых разделена на два модуля. Сложность второго модуля зависит от того, как вы справились с первым."],
        ["Какой балл считается хорошим?", "Итоговый балл складывается из двух секций по 200–800 и составляет от 400 до 1600. Средний результат — около 1050, сильным считается 1300 и выше, а ведущие университеты ожидают 1450 и больше."],
        ["Что такое задания с вводом ответа?", "Примерно четверть заданий секции Math — student-produced response: ответ нужно ввести самому, а не выбрать из вариантов. Принимаются целые числа, десятичные дроби и обыкновенные дроби, без единиц измерения и знаков процента."],
        ["Можно ли пользоваться калькулятором?", "Да, встроенный калькулятор Desmos доступен на протяжении всей секции Math. Это не отменяет необходимости понимать сами методы решения — многие задания быстрее решаются алгебраически."],
        ["Сколько времени готовиться к SAT?", "Типичный план занимает 8 недель: диагностический тест, затем работа по слабым доменам с ежедневными 20–30 заданиями, еженедельные мини-пробники и два полных теста с таймером в предпоследнюю неделю."],
      ],
      en: [
        ["How is the Digital SAT structured?", "Since 2024 the SAT is fully digital and adaptive. It has two sections — Reading and Writing, and Math — each split into two modules. The difficulty of the second module depends on how you performed in the first."],
        ["What counts as a good score?", "The total combines two sections scored 200–800 each, for a range of 400 to 1600. The average is around 1050, a strong score is 1300 or above, and leading universities expect 1450+."],
        ["What are student-produced response questions?", "About a quarter of the Math section asks you to type the answer instead of choosing it. Integers, decimals and fractions are accepted, without units or percent signs."],
        ["Is a calculator allowed?", "Yes, the built-in Desmos calculator is available throughout the Math section. You still need to understand the methods — many questions are faster to solve algebraically."],
        ["How long does SAT prep take?", "A typical plan runs 8 weeks: a diagnostic test, then work on weak domains with 20–30 questions a day, weekly mini-mocks, and two full timed tests in the penultimate week."],
      ],
    },
  },
};

/* --------------------------------------------------------------- layout --- */

const BRAND = "Study Dashboard";

function layout({ lang, title, description, canonical, path: urlPath, jsonLd, body, appUrl }) {
  const alternates = LANGS.map((l) => {
    const href = l === "ru" ? `${appUrl}${urlPath}` : `${appUrl}/en${urlPath === "/" ? "" : urlPath}`;
    return `<link rel="alternate" hreflang="${l}" href="${escapeHtml(href)}">`;
  }).join("\n  ");

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  ${alternates}
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(appUrl + urlPath)}">
  <meta name="color-scheme" content="dark light">
  <meta name="theme-color" content="#020814">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${BRAND}">
  <meta property="og:locale" content="${lang === "en" ? "en_US" : "ru_RU"}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(appUrl)}/og-image.svg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(appUrl)}/og-image.svg">
  <link rel="icon" href="/favicon.svg?v=2" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/landing.css?v=4">
  <script defer src="/demo.js?v=1"></script>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="${lang === "en" ? "/en" : "/"}">
      <span class="brand-mark" aria-hidden="true">✦</span>
      <span>${BRAND}</span>
    </a>
    <nav class="site-nav" aria-label="${t(lang, "Экзамены", "Exams")}">
      ${EXAM_IDS.map((id) => `<a href="${lang === "en" ? "/en" : ""}/${id}">${escapeHtml(pick(EXAM_META[id].name, lang))}</a>`).join("")}
    </nav>
    <div class="site-actions">
      <a class="lang-switch" href="${lang === "en" ? urlPath : `/en${urlPath === "/" ? "" : urlPath}`}" hreflang="${lang === "en" ? "ru" : "en"}">${lang === "en" ? "RU" : "EN"}</a>
      <a class="btn ghost" href="/login" data-auth="guest">${t(lang, "Войти", "Sign in")}</a>
      <a class="btn primary" href="/register" data-auth="guest">${t(lang, "Начать бесплатно", "Start free")}</a>
      <a class="btn primary" href="/dashboard" data-auth="user" hidden>${t(lang, "Мой дашборд", "My dashboard")}</a>
    </div>
  </header>
  <script>
    // Visitors who are already signed in should not be asked to sign in again.
    try {
      if (localStorage.getItem("authToken") || sessionStorage.getItem("authToken")) {
        document.querySelectorAll("[data-auth=guest]").forEach(function (el) { el.hidden = true; });
        document.querySelectorAll("[data-auth=user]").forEach(function (el) { el.hidden = false; });
      }
    } catch (e) {}
  </script>
  <main>
${body}
  </main>
  <footer class="site-footer">
    <div class="footer-cols">
      <div>
        <strong>${BRAND}</strong>
        <p>${t(lang,
          "Онлайн-тренажёр для подготовки к ЕНТ, ЕГЭ, IELTS и SAT с разбором каждого задания.",
          "An online trainer for UNT, EGE, IELTS and SAT preparation with an explanation for every question.")}</p>
      </div>
      <div>
        <strong>${t(lang, "Экзамены", "Exams")}</strong>
        <ul>${EXAM_IDS.map((id) => `<li><a href="${lang === "en" ? "/en" : ""}/${id}">${escapeHtml(pick(EXAM_META[id].name, lang))}</a></li>`).join("")}</ul>
      </div>
      <div>
        <strong>${t(lang, "Аккаунт", "Account")}</strong>
        <ul>
          <li><a href="/login">${t(lang, "Вход", "Sign in")}</a></li>
          <li><a href="/register">${t(lang, "Регистрация", "Create account")}</a></li>
        </ul>
      </div>
    </div>
    <p class="footer-legal">© ${new Date().getFullYear()} ${BRAND}</p>
  </footer>
</body>
</html>`;
}

/* ------------------------------------------------------- page fragments --- */

function statsFor(exam) {
  const sections = exam.sections.filter((s) => s.kind !== "writing" && s.kind !== "speaking");
  return {
    questions: exam.questions.length,
    sections: exam.sections.length,
    quizSections: sections.length,
    minutes: sections.reduce((sum, s) => sum + (s.durationMin || 0), 0),
    writingTasks: (exam.writingTasks || []).length + (exam.speakingTasks || []).length,
  };
}

// Deterministic sample: the first well-explained question of each section,
// so the page content is stable between crawls.
function sampleQuestions(exam, limit = 8) {
  const picked = [];
  const bySection = new Map();
  for (const q of exam.questions) {
    if (!q.explanation || q.explanation.length < 40) continue;
    if (q.passageId) continue; // needs its passage to make sense
    if (q.type === "input") continue;
    const list = bySection.get(q.sectionId) || [];
    if (list.length >= 3) continue;
    list.push(q);
    bySection.set(q.sectionId, list);
  }
  let round = 0;
  while (picked.length < limit && round < 3) {
    for (const list of bySection.values()) {
      if (list[round] && picked.length < limit) picked.push(list[round]);
    }
    round += 1;
  }
  return picked;
}

function renderSampleQuestion(q, exam, lang) {
  const sectionTitle = pick(exam.sections.find((s) => s.id === q.sectionId)?.title, lang) || q.sectionId;
  const correct = q.type === "multi"
    ? (q.correctIndices || []).map((i) => String.fromCharCode(65 + i)).join(", ")
    : String.fromCharCode(65 + Number(q.correctIndex));
  return `
      <article class="sample">
        <div class="sample-meta">
          <span class="pill">${escapeHtml(sectionTitle)}</span>
          ${q.topic ? `<span class="pill soft">${escapeHtml(q.topic)}</span>` : ""}
          ${q.difficulty ? `<span class="pill soft">${escapeHtml(q.difficulty)}</span>` : ""}
        </div>
        <p class="sample-question">${escapeHtml(q.text).replace(/\n/g, "<br>")}</p>
        <ol class="sample-choices" type="A">
          ${q.choices.map((choice, i) => {
            const isCorrect = q.type === "multi"
              ? (q.correctIndices || []).includes(i)
              : i === Number(q.correctIndex);
            return `<li${isCorrect ? ' class="correct"' : ""}>${escapeHtml(choice)}</li>`;
          }).join("")}
        </ol>
        <details class="sample-answer">
          <summary>${t(lang, "Показать ответ и разбор", "Show answer and explanation")}</summary>
          <p><strong>${t(lang, "Ответ", "Answer")}: ${escapeHtml(correct)}.</strong> ${escapeHtml(q.explanation)}</p>
        </details>
      </article>`;
}

/* ---------------------------------------------------------- exam pages --- */

export function renderExamPage(examId, lang, appUrl) {
  const key = `exam:${examId}:${lang}:${appUrl}`;
  if (cache.pages.has(key)) return cache.pages.get(key);

  const exam = loadExams()[examId];
  const meta = EXAM_META[examId];
  if (!exam || !meta) return null;

  const stats = statsFor(exam);
  const urlPath = `/${examId}`;
  const canonical = `${appUrl}${lang === "en" ? "/en" : ""}${urlPath}`;
  const title = fillCount(pick(meta.seoTitle, lang), stats.questions, lang);
  const description = fillCount(pick(meta.seoDescription, lang), stats.questions, lang);
  const faq = meta.faq[lang] || meta.faq.ru;

  const sectionRows = exam.sections.map((s) => {
    const open = s.kind === "writing" || s.kind === "speaking";
    const count = open
      ? `${((s.kind === "speaking" ? exam.speakingTasks : exam.writingTasks) || []).filter((task) => task.sectionId === s.id).length} ${t(lang, "заданий", "tasks")}`
      : `${s.questionsPerAttempt} ${plural(s.questionsPerAttempt, QUESTIONS, lang)}`;
    const check = open
      ? t(lang, "Проверка ИИ по критериям", "AI-graded on the criteria")
      : t(lang, "Автопроверка с объяснением", "Auto-graded with explanations");
    return `<tr><td>${escapeHtml(pick(s.title, lang))}</td><td>${escapeHtml(count)}</td><td>${s.durationMin} ${t(lang, "мин", "min")}</td><td>${escapeHtml(check)}</td></tr>`;
  }).join("");

  const materials = (exam.materials || []).map((m) => `
      <section class="material" id="material-${escapeHtml(m.id)}">
        <h3>${escapeHtml(pick(m.title, lang))}</h3>
        <div class="prose">${renderMarkdown(pick(m.body, lang))}</div>
      </section>`).join("");

  const samples = sampleQuestions(exam).map((q) => renderSampleQuestion(q, exam, lang)).join("");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Course",
        name: title.split("|")[0].trim(),
        description,
        url: canonical,
        inLanguage: lang,
        teaches: pick(meta.name, lang),
        provider: { "@type": "Organization", name: BRAND, url: appUrl },
        isAccessibleForFree: true,
        hasCourseInstance: {
          "@type": "CourseInstance",
          courseMode: "online",
          courseWorkload: `PT${Math.max(1, Math.round(stats.minutes / 60))}H`,
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map(([question, answer]) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: BRAND, item: appUrl + (lang === "en" ? "/en" : "/") },
          { "@type": "ListItem", position: 2, name: pick(meta.name, lang), item: canonical },
        ],
      },
    ],
  };

  const body = `
    <section class="hero exam-hero" style="--accent:${meta.accent}">
      <div class="hero-copy">
        <span class="eyebrow">${meta.flag} ${escapeHtml(pick(meta.name, lang))}</span>
        <h1>${escapeHtml(pick(meta.heading, lang))}</h1>
        <p>${escapeHtml(pick(meta.lede, lang))}</p>
        <div class="hero-actions">
          <a class="btn primary lg" href="#demo">${t(lang, "Пройти демо-тест бесплатно", "Try the free demo test")}</a>
          <a class="btn ghost lg" href="#materials">${t(lang, "Материалы по подготовке", "Prep materials")}</a>
        </div>
      </div>
      <dl class="hero-stats">
        <div><dt>${t(lang, "Вопросов в банке", "Questions in bank")}</dt><dd>${stats.questions}</dd></div>
        <div><dt>${t(lang, "Секций", "Sections")}</dt><dd>${stats.sections}</dd></div>
        ${stats.writingTasks ? `<div><dt>${t(lang, "Заданий с проверкой ИИ", "AI-graded tasks")}</dt><dd>${stats.writingTasks}</dd></div>` : ""}
        <div><dt>${t(lang, "Стоимость", "Price")}</dt><dd>${t(lang, "Бесплатно", "Free")}</dd></div>
      </dl>
    </section>

    <section class="block" id="demo">
      <h2>${t(lang, "Демо-тест без регистрации", "Demo test — no sign-up")}</h2>
      <p class="block-lede">${t(lang,
        "Десять вопросов из настоящего банка с мгновенным разбором. Каждый запуск — новый вариант.",
        "Ten questions from the real bank with instant explanations. Every run is a new variant.")}</p>
      <div data-demo="${escapeHtml(examId)}"></div>
    </section>

    <section class="block">
      <h2>${t(lang, "Что входит в пробный тест", "What the practice test covers")}</h2>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>${t(lang, "Секция", "Section")}</th>
            <th>${t(lang, "Объём", "Length")}</th>
            <th>${t(lang, "Время", "Time")}</th>
            <th>${t(lang, "Как проверяется", "How it is graded")}</th>
          </tr></thead>
          <tbody>${sectionRows}</tbody>
        </table>
      </div>
    </section>

    <section class="block">
      <h2>${t(lang, "Примеры заданий с разбором", "Sample questions with explanations")}</h2>
      <p class="block-lede">${t(lang,
        "Эти задания взяты из банка тренажёра. Правильный ответ и объяснение открываются по клику — как и после каждого вопроса в самом тесте.",
        "These questions come from the trainer's bank. The correct answer and explanation open on click, exactly as they do after every question in the test.")}</p>
      <div class="samples">${samples}</div>
      <a class="btn primary" href="/register">${t(lang, "Решать все", "Practise them all")} ${stats.questions} ${plural(stats.questions, QUESTIONS, lang)} →</a>
    </section>

    <section class="block" id="materials">
      <h2>${t(lang, "Материалы по подготовке", "Preparation materials")}</h2>
      ${materials || `<p>${t(lang, "Материалы скоро появятся.", "Materials coming soon.")}</p>`}
    </section>

    <section class="block">
      <h2>${t(lang, "Частые вопросы", "Frequently asked questions")}</h2>
      <div class="faq">
        ${faq.map(([question, answer]) => `
          <details>
            <summary>${escapeHtml(question)}</summary>
            <p>${escapeHtml(answer)}</p>
          </details>`).join("")}
      </div>
    </section>

    <section class="cta">
      <h2>${t(lang, "Начни готовиться сегодня", "Start preparing today")}</h2>
      <p>${t(lang,
        "Регистрация занимает минуту. Результаты попыток сохраняются, слабые темы определяются автоматически.",
        "Signing up takes a minute. Your attempts are saved and weak topics are detected automatically.")}</p>
      <a class="btn primary lg" href="/register">${t(lang, "Создать аккаунт бесплатно", "Create a free account")}</a>
    </section>

    <nav class="other-exams" aria-label="${t(lang, "Другие экзамены", "Other exams")}">
      <h2>${t(lang, "Другие экзамены", "Other exams")}</h2>
      <div class="exam-links">
        ${EXAM_IDS.filter((id) => id !== examId).map((id) => {
          const other = EXAM_META[id];
          const otherExam = loadExams()[id];
          return `<a class="exam-link" href="${lang === "en" ? "/en" : ""}/${id}" style="--accent:${other.accent}">
            <span class="flag">${other.flag}</span>
            <strong>${escapeHtml(pick(other.name, lang))}</strong>
            <small>${otherExam ? `${otherExam.questions.length} ${plural(otherExam.questions.length, QUESTIONS, lang)}` : ""}</small>
          </a>`;
        }).join("")}
      </div>
    </nav>`;

  const html = layout({ lang, title, description, canonical, path: urlPath, jsonLd, body, appUrl });
  cache.pages.set(key, html);
  return html;
}

/* ------------------------------------------------------------- landing --- */

export function renderLanding(lang, appUrl) {
  const key = `landing:${lang}:${appUrl}`;
  if (cache.pages.has(key)) return cache.pages.get(key);

  const exams = loadExams();
  const totalQuestions = EXAM_IDS.reduce((sum, id) => sum + (exams[id]?.questions.length || 0), 0);
  const canonical = `${appUrl}${lang === "en" ? "/en" : "/"}`;
  const title = t(lang,
    `Подготовка к ЕНТ, ЕГЭ, IELTS и SAT онлайн — ${totalQuestions} заданий с разбором | ${BRAND}`,
    `UNT, EGE, IELTS and SAT preparation online — ${totalQuestions} questions with explanations | ${BRAND}`);
  const description = t(lang,
    `Бесплатные пробные тесты ЕНТ, ЕГЭ, IELTS и SAT с таймером, подсчётом баллов и объяснением к каждому заданию. Аудирование с озвучкой, сочинения и устная речь с проверкой ИИ, отслеживание слабых тем.`,
    `Free UNT, EGE, IELTS and SAT practice tests with a timer, scoring and an explanation for every question. Listening with audio, essays and speaking graded by AI, automatic weak-topic tracking.`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: BRAND,
        url: appUrl,
        inLanguage: lang,
        description,
        potentialAction: {
          "@type": "SearchAction",
          target: `${appUrl}/{search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        name: BRAND,
        url: appUrl,
        logo: `${appUrl}/favicon.svg`,
      },
      {
        "@type": "ItemList",
        itemListElement: EXAM_IDS.map((id, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: pick(EXAM_META[id].name, lang),
          url: `${appUrl}${lang === "en" ? "/en" : ""}/${id}`,
        })),
      },
    ],
  };

  const cards = EXAM_IDS.map((id) => {
    const meta = EXAM_META[id];
    const exam = exams[id];
    if (!exam) return "";
    const stats = statsFor(exam);
    return `
      <a class="exam-card" href="${lang === "en" ? "/en" : ""}/${id}" style="--accent:${meta.accent}">
        <span class="flag">${meta.flag}</span>
        <h3>${escapeHtml(pick(meta.name, lang))}</h3>
        <p>${escapeHtml(pick(meta.lede, lang).split(/[.:]/)[0])}.</p>
        <ul class="card-stats">
          <li>${stats.questions} ${plural(stats.questions, QUESTIONS, lang)}</li>
          <li>${stats.sections} ${t(lang, "секций", "sections")}</li>
          ${stats.writingTasks ? `<li>${t(lang, "проверка ИИ", "AI grading")}</li>` : ""}
        </ul>
        <span class="card-cta">${t(lang, "Подробнее", "Learn more")} →</span>
      </a>`;
  }).join("");

  const features = [
    ["⏱", t(lang, "Формат настоящего экзамена", "Real exam format"),
      t(lang, "Таймер на каждую секцию, палитра вопросов, флажки и автозавершение по времени. Полный пробник собирается из тех предметов, которые вы реально сдаёте.",
        "A timer for every section, a question palette, flags and auto-submit when time runs out. The full mock is assembled from the subjects you actually sit.")],
    ["🎧", t(lang, "Аудирование с озвучкой", "Listening with real audio"),
      t(lang, "Записи IELTS Listening проигрываются прямо в браузере, не больше двух раз — как на экзамене. После теста открывается полный скрипт.",
        "IELTS Listening recordings play right in the browser, at most twice, just like the exam. The full transcript opens after the test.")],
    ["✍️", t(lang, "Сочинения и речь проверяет ИИ", "AI-graded essays and speaking"),
      t(lang, "Эссе IELTS и сочинение ЕГЭ оцениваются по официальным критериям: балл по каждому пункту, цитаты ошибок и советы, что исправить.",
        "IELTS essays and the EGE composition are graded against the official criteria: a score per criterion, quoted mistakes and advice on what to fix.")],
    ["📈", t(lang, "Слабые темы находятся сами", "Weak topics find themselves"),
      t(lang, "После каждой попытки видно, в каких темах теряются баллы. Одна кнопка — и вы тренируете именно их.",
        "After every attempt you see exactly which topics cost you points. One click and you drill those.")],
    ["📚", t(lang, "Объяснение к каждому заданию", "An explanation for every question"),
      t(lang, "Не просто «неверно», а разбор: почему правильный ответ такой и в чём подвох неправильных вариантов.",
        "Not just “wrong”, but a breakdown: why the correct answer works and what makes the distractors tempting.")],
    ["🆓", t(lang, "Бесплатно и без установки", "Free, nothing to install"),
      t(lang, "Всё работает в браузере на телефоне и компьютере. Прогресс сохраняется в аккаунте.",
        "Everything runs in the browser on phone and desktop. Your progress is saved to your account.")],
  ].map(([icon, heading, text]) => `
      <article class="feature">
        <span class="feature-icon" aria-hidden="true">${icon}</span>
        <h3>${escapeHtml(heading)}</h3>
        <p>${escapeHtml(text)}</p>
      </article>`).join("");

  const steps = [
    [t(lang, "Пройди диагностику", "Take a diagnostic"), t(lang, "Одна секция с таймером покажет реальный уровень и слабые темы.", "One timed section reveals your real level and weak topics.")],
    [t(lang, "Закрывай пробелы", "Close the gaps"), t(lang, "Тренируй слабые темы в режиме практики с мгновенным разбором.", "Drill weak topics in practice mode with instant explanations.")],
    [t(lang, "Проверяй прогресс", "Track progress"), t(lang, "Полный пробник раз в неделю — график покажет динамику балла.", "A full mock once a week — the chart shows how your score moves.")],
  ].map(([heading, text], i) => `
      <li class="step">
        <span class="step-num">${i + 1}</span>
        <div><strong>${escapeHtml(heading)}</strong><p>${escapeHtml(text)}</p></div>
      </li>`).join("");

  const body = `
    <section class="hero landing-hero">
      <div class="hero-copy">
        <span class="eyebrow">${t(lang, "Бесплатный онлайн-тренажёр", "Free online trainer")}</span>
        <h1>${t(lang, "Подготовка к ЕНТ, ЕГЭ, IELTS и SAT", "Prepare for UNT, EGE, IELTS and SAT")}</h1>
        <p>${t(lang,
          `${totalQuestions} заданий с объяснением к каждому, пробные тесты в формате настоящего экзамена и проверка сочинений и устной речи искусственным интеллектом.`,
          `${totalQuestions} questions with an explanation for every one, mock tests in the real exam format, and AI grading for essays and speaking.`)}</p>
        <div class="hero-actions">
          <a class="btn primary lg" href="#try">${t(lang, "Попробовать без регистрации", "Try it without signing up")}</a>
          <a class="btn ghost lg" href="/register">${t(lang, "Создать аккаунт", "Create an account")}</a>
        </div>
      </div>
    </section>

    <section class="block" id="try">
      <h2>${t(lang, "Попробуй прямо сейчас — регистрация не нужна", "Try it right now — no sign-up needed")}</h2>
      <p class="block-lede">${t(lang,
        "Выбери экзамен и пройди демо-тест из 10 вопросов с разбором каждого ответа.",
        "Pick an exam and take a 10-question demo test with an explanation for every answer.")}</p>
      <div class="demo-links">
        ${EXAM_IDS.map((id) => {
          const meta = EXAM_META[id];
          const exam = exams[id];
          if (!exam) return "";
          return `<a class="demo-link" href="${lang === "en" ? "/en" : ""}/${id}#demo" style="--accent:${meta.accent}">
            <span class="flag">${meta.flag}</span>
            <span>${escapeHtml(pick(meta.name, lang))}
              <small>${exam.questions.length} ${plural(exam.questions.length, QUESTIONS, lang)}</small>
            </span>
          </a>`;
        }).join("")}
      </div>
    </section>

    <section class="block" id="exams">
      <h2>${t(lang, "Выбери свой экзамен", "Choose your exam")}</h2>
      <div class="exam-cards">${cards}</div>
    </section>

    <section class="block">
      <h2>${t(lang, "Почему этот тренажёр работает", "Why this trainer works")}</h2>
      <div class="features">${features}</div>
    </section>

    <section class="block">
      <h2>${t(lang, "Как готовиться", "How to prepare")}</h2>
      <ol class="steps">${steps}</ol>
    </section>

    <section class="cta">
      <h2>${t(lang, "Первый пробник — прямо сейчас", "Your first mock, right now")}</h2>
      <p>${t(lang, "Регистрация занимает минуту, а результаты сохраняются навсегда.", "Signing up takes a minute and your results are saved for good.")}</p>
      <a class="btn primary lg" href="/register">${t(lang, "Создать аккаунт", "Create an account")}</a>
    </section>`;

  const html = layout({ lang, title, description, canonical, path: "/", jsonLd, body, appUrl });
  cache.pages.set(key, html);
  return html;
}

/* ------------------------------------------------------ robots/sitemap --- */

export function renderSitemap(appUrl) {
  const urls = [];
  const add = (loc, priority, changefreq) => urls.push({ loc, priority, changefreq });
  add(`${appUrl}/`, "1.0", "weekly");
  add(`${appUrl}/en`, "0.9", "weekly");
  for (const id of EXAM_IDS) {
    add(`${appUrl}/${id}`, "0.9", "weekly");
    add(`${appUrl}/en/${id}`, "0.8", "weekly");
  }
  add(`${appUrl}/register`, "0.5", "monthly");
  add(`${appUrl}/login`, "0.3", "monthly");

  const body = urls.map(({ loc, priority, changefreq }) => {
    const isExam = EXAM_IDS.some((id) => loc.endsWith(`/${id}`));
    const alternates = isExam
      ? LANGS.map((l) => {
          const id = loc.split("/").pop();
          const href = l === "ru" ? `${appUrl}/${id}` : `${appUrl}/en/${id}`;
          return `    <xhtml:link rel="alternate" hreflang="${l}" href="${escapeHtml(href)}"/>`;
        }).join("\n")
      : "";
    return `  <url>
    <loc>${escapeHtml(loc)}</loc>
${alternates ? alternates + "\n" : ""}    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${body}
</urlset>`;
}

export function renderRobots(appUrl) {
  return `User-agent: *
Allow: /$
Allow: /en
${EXAM_IDS.map((id) => `Allow: /${id}\nAllow: /en/${id}`).join("\n")}
Allow: /login
Allow: /register

# The application itself is behind authentication and has nothing to index
Disallow: /dashboard
Disallow: /tasks
Disallow: /subjects
Disallow: /exams
Disallow: /calendar
Disallow: /ai
Disallow: /profile
Disallow: /goals
Disallow: /insights
Disallow: /materials
Disallow: /api/
Disallow: /data/

Sitemap: ${appUrl}/sitemap.xml
`;
}
