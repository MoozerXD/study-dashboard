// Builds public/data/exams/sat.json from the raw SAT question bank + generated math questions.
// Usage: node scripts/build-sat-exam.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bankPath = path.join(root, 'public/data/sat-question-bank.json');
const genPath = path.join(root, 'public/data/exams/sat-math-generated.json');
const outPath = path.join(root, 'public/data/exams/sat.json');

const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));

const LETTERS = { A: 0, B: 1, C: 2, D: 3 };
// Questions referencing figures/formulas lost during PDF extraction are unusable.
const refsExternal = /\b(above|shown|graphed|given (expression|equation|system|function|table|graph|figure|inequality|polynomial)|the figure|the table|the graph)\b/i;
const danglingLine = /\b(is|as|to|of|by|from|equals?|than|where|when|for|with|and|or|that|which|be|equation|expression|function|system|inequality)\s*\n/i;
const endsDangling = /\b(is|as|to|of|by|from|equals?|than|where|when|with|be)\s*[.,?]/i;
const mentionsFormula = /\b(equation|expression|function|system|inequality|polynomial)\b/i;
const hasDigit = /[0-9]/;

function usableBase(q) {
  return q.questionText && q.questionText.length > 30 &&
    Array.isArray(q.choices) && q.choices.length === 4 &&
    q.choices.every((c) => c && String(c).trim().length > 0) &&
    q.correctAnswer in LETTERS;
}

function usableMath(q) {
  const flat = q.questionText.replace(/\s+/g, ' ');
  if (refsExternal.test(flat)) return false;
  if (!hasDigit.test(flat)) return false;
  if (danglingLine.test(q.questionText)) return false;
  if (endsDangling.test(flat)) return false;
  if (mentionsFormula.test(flat)) return false; // formula itself was an image — text alone is incomplete
  return true;
}

function cleanText(text) {
  return String(text).replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function convert(q) {
  return {
    id: q.id,
    sectionId: q.subject === 'math' ? 'math' : 'rw',
    type: 'mcq',
    domain: q.domain || null,
    topic: q.subsection || q.topic || q.domain || '',
    difficulty: String(q.difficulty || 'medium').toLowerCase(),
    text: cleanText(q.questionText),
    choices: q.choices.map((c) => cleanText(c)),
    correctIndex: LETTERS[q.correctAnswer],
    explanation: cleanText(q.rationale || ''),
  };
}

const rw = bank.questions.filter((q) => q.subject === 'rw' && usableBase(q)).map(convert);
const mathBank = bank.questions.filter((q) => q.subject === 'math' && usableBase(q) && usableMath(q)).map(convert);

let mathGen = [];
if (fs.existsSync(genPath)) {
  const gen = JSON.parse(fs.readFileSync(genPath, 'utf8'));
  mathGen = gen.questions.map((q) => ({
    id: q.id,
    sectionId: 'math',
    type: 'mcq',
    domain: q.domain || null,
    topic: q.topic || q.domain || '',
    difficulty: q.difficulty || 'medium',
    text: cleanText(q.text),
    choices: q.choices.map(cleanText),
    correctIndex: q.correctIndex,
    explanation: cleanText(q.explanation || ''),
  }));
} else {
  console.warn('WARN: sat-math-generated.json not found — building without generated math questions');
}

const materials = [
  {
    id: 'overview',
    title: { ru: 'Что такое SAT', en: 'SAT Overview' },
    body: {
      ru: `## Что такое SAT\n\nSAT — стандартизированный тест для поступления в университеты США (и многие вузы по всему миру). С 2024 года тест полностью цифровой (Digital SAT) и адаптивный.\n\n**Структура:**\n- **Reading and Writing** — 2 модуля по 32 минуты, 27 вопросов в каждом\n- **Math** — 2 модуля по 35 минут, 22 вопроса в каждом\n\n**Баллы:** каждая секция оценивается от 200 до 800, итог — от 400 до 1600.\n\n**Адаптивность:** сложность второго модуля зависит от результата первого.\n\nКалькулятор (встроенный Desmos) разрешён во всей секции Math.`,
      en: `## SAT Overview\n\nThe SAT is a standardized test for university admissions in the US (and many universities worldwide). Since 2024 it is fully digital and adaptive.\n\n**Structure:**\n- **Reading and Writing** — 2 modules × 32 min, 27 questions each\n- **Math** — 2 modules × 35 min, 22 questions each\n\n**Scoring:** each section is scored 200–800, total 400–1600.\n\n**Adaptive:** the difficulty of the second module depends on your first-module performance.\n\nA built-in Desmos calculator is allowed throughout the Math section.`,
    },
  },
  {
    id: 'format',
    title: { ru: 'Формат и типы заданий', en: 'Format & Question Types' },
    body: {
      ru: `## Reading and Writing\n\nКороткие тексты (25–150 слов), один вопрос на текст. Домены:\n- **Information and Ideas** — главная мысль, детали, выводы, работа с данными\n- **Craft and Structure** — словарный запас в контексте, структура текста, связи между текстами\n- **Expression of Ideas** — риторический синтез, переходы\n- **Standard English Conventions** — грамматика и пунктуация\n\n## Math\n\n- **Algebra** — линейные уравнения, системы, неравенства\n- **Advanced Math** — квадратные и нелинейные функции\n- **Problem-Solving and Data Analysis** — проценты, статистика, вероятность\n- **Geometry and Trigonometry** — площади, объёмы, тригонометрия\n\n~75% вопросов — с выбором ответа, ~25% — с вводом ответа (в нашем тренажёре все вопросы с выбором).`,
      en: `## Reading and Writing\n\nShort passages (25–150 words), one question per passage. Domains:\n- **Information and Ideas** — main idea, details, inferences, data\n- **Craft and Structure** — vocabulary in context, text structure, cross-text connections\n- **Expression of Ideas** — rhetorical synthesis, transitions\n- **Standard English Conventions** — grammar and punctuation\n\n## Math\n\n- **Algebra** — linear equations, systems, inequalities\n- **Advanced Math** — quadratic and nonlinear functions\n- **Problem-Solving and Data Analysis** — percentages, statistics, probability\n- **Geometry and Trigonometry** — area, volume, trigonometry\n\n~75% multiple choice, ~25% student-produced response (all multiple choice in this trainer).`,
    },
  },
  {
    id: 'tips',
    title: { ru: 'Стратегия сдачи', en: 'Test-Day Strategy' },
    body: {
      ru: `## Стратегия\n\n1. **Не застревай.** ~71 секунда на вопрос в RW и ~95 в Math. Помечай сложные и возвращайся.\n2. **Метод исключения.** Отбрасывай явно неверные варианты — шанс угадать растёт с 25% до 50%.\n3. **Нет штрафа за ошибки** — отвечай на всё.\n4. **В RW сначала читай вопрос**, потом текст: будешь знать, что искать.\n5. **В Math подставляй числа** из вариантов ответов, если уравнение сложное.\n6. **Тренируйся с таймером** — темп важнее знаний на высоких баллах.\n7. За неделю до экзамена — только повторение и полные пробники, без новых тем.`,
      en: `## Strategy\n\n1. **Don't get stuck.** ~71 seconds per RW question, ~95 for Math. Flag and return.\n2. **Process of elimination.** Cutting two wrong choices doubles your guessing odds.\n3. **No wrong-answer penalty** — answer everything.\n4. **In RW read the question first**, then the passage — you'll know what to look for.\n5. **In Math, plug in answer choices** when the algebra gets messy.\n6. **Practice with a timer** — pacing matters more than knowledge at high scores.\n7. Final week: review and full mocks only, no new topics.`,
    },
  },
  {
    id: 'plan',
    title: { ru: 'План подготовки на 8 недель', en: '8-Week Study Plan' },
    body: {
      ru: `## План на 8 недель\n\n**Нед. 1:** диагностический пробник → определи слабые домены.\n**Нед. 2–3:** Math — алгебра и advanced math; RW — грамматика (Conventions). 20–30 вопросов в день.\n**Нед. 4–5:** Math — данные и статистика; RW — Craft and Structure (словарь в контексте). Один мини-пробник в неделю.\n**Нед. 6:** геометрия и тригонометрия; RW — Information and Ideas. Разбор всех ошибок.\n**Нед. 7:** два полных пробника с таймером, работа над темпом.\n**Нед. 8:** лёгкое повторение, сон, логистика экзамена.\n\n**Правило:** каждый неверный ответ — карточка с объяснением. Повторяй карточки каждые 2–3 дня.`,
      en: `## 8-Week Plan\n\n**Wk 1:** diagnostic mock → identify weak domains.\n**Wk 2–3:** Math — algebra & advanced math; RW — conventions (grammar). 20–30 questions/day.\n**Wk 4–5:** Math — data & statistics; RW — craft and structure (vocab in context). One mini-mock per week.\n**Wk 6:** geometry & trig; RW — information and ideas. Review every mistake.\n**Wk 7:** two full timed mocks, focus on pacing.\n**Wk 8:** light review, sleep, test-day logistics.\n\n**Rule:** every wrong answer becomes a flashcard with the explanation. Review cards every 2–3 days.`,
    },
  },
];

const exam = {
  examId: 'sat',
  version: 1,
  lang: 'en',
  title: { ru: 'SAT', en: 'SAT' },
  description: {
    ru: 'Цифровой SAT: Reading and Writing + Math. Баллы 400–1600.',
    en: 'Digital SAT: Reading and Writing + Math. Scored 400–1600.',
  },
  scoreScale: {
    type: 'sat1600',
    max: 1600,
    note: {
      ru: 'Каждая секция: 200–800. Оценка приблизительная, по доле верных ответов.',
      en: 'Each section: 200–800. Estimated from the share of correct answers.',
    },
  },
  sections: [
    { id: 'rw', title: { ru: 'Reading and Writing', en: 'Reading and Writing' }, durationMin: 32, questionsPerAttempt: 27 },
    { id: 'math', title: { ru: 'Math', en: 'Math' }, durationMin: 35, questionsPerAttempt: 22 },
  ],
  materials,
  questions: [...rw, ...mathBank, ...mathGen],
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(exam));

const counts = {};
for (const q of exam.questions) counts[q.sectionId] = (counts[q.sectionId] || 0) + 1;
console.log('sat.json written:', outPath);
console.log('questions:', counts, 'total:', exam.questions.length);
console.log('rw from bank:', rw.length, '| math from bank:', mathBank.length, '| math generated:', mathGen.length);
// sanity checks
let bad = 0;
for (const q of exam.questions) {
  if (!['rw', 'math'].includes(q.sectionId)) bad++;
  if (q.type === 'mcq' && (q.correctIndex < 0 || q.correctIndex >= q.choices.length)) bad++;
}
console.log(bad === 0 ? 'validation OK' : `VALIDATION FAILED: ${bad} problems`);
