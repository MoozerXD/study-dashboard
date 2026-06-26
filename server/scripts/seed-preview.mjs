// One-off helper: reset and seed correctly-encoded demo data for a preview account.
// Usage: node scripts/seed-preview.mjs <token> [baseUrl]
const token = process.argv[2];
const base = process.argv[3] || "http://localhost:3000";
if (!token) {
  console.error("Pass an auth token as the first argument.");
  process.exit(1);
}
const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function jget(path) {
  const r = await fetch(base + path, { headers: h });
  return r.json();
}
async function del(path) {
  await fetch(base + path, { method: "DELETE", headers: h });
}
async function post(path, body) {
  const r = await fetch(base + path, { method: "POST", headers: h, body: JSON.stringify(body) });
  return r.json();
}

// Wipe existing (possibly corrupted) data.
for (const t of await jget("/api/tasks")) await del(`/api/tasks/${t.id}`);
for (const s of await jget("/api/subjects")) await del(`/api/subjects/${s.id}`);

const now = Date.now();
const iso = (h) => new Date(now + h * 3600e3).toISOString();

const lang = (process.argv[4] || "en").toLowerCase();

const DATA = {
  ru: {
    subjects: [
      { name: "Математика", color: "#3d7bff", targetMinutes: 300, description: "Алгебра и математический анализ" },
      { name: "Физика", color: "#8b5cf6", targetMinutes: 240, description: "Механика и электричество" },
      { name: "Английский язык", color: "#36d69f", targetMinutes: 180, description: "Подготовка к SAT" },
    ],
    tasks: [
      { title: "Решить 20 задач по интегралам", subject: "Математика", dueDate: iso(3), priority: "high", estimatedMins: 60, focusScore: 80, description: "Глава 7, определённые интегралы" },
      { title: "Повторить формулы тригонометрии", subject: "Математика", priority: "low", estimatedMins: 30, focusScore: 60, status: "done" },
      { title: "Конспект по законам Ньютона", subject: "Физика", dueDate: iso(26), priority: "medium", estimatedMins: 45, focusScore: 70 },
      { title: "SAT Reading: два пассажа", subject: "Английский язык", dueDate: iso(3), priority: "high", estimatedMins: 40, focusScore: 75 },
      { title: "Эссе: черновик введения", subject: "Английский язык", dueDate: iso(26), priority: "medium", estimatedMins: 50, focusScore: 65 },
    ],
  },
  en: {
    subjects: [
      { name: "Mathematics", color: "#3d7bff", targetMinutes: 300, description: "Algebra and calculus" },
      { name: "Physics", color: "#8b5cf6", targetMinutes: 240, description: "Mechanics and electricity" },
      { name: "English", color: "#36d69f", targetMinutes: 180, description: "SAT preparation" },
    ],
    tasks: [
      { title: "Solve 20 integral problems", subject: "Mathematics", dueDate: iso(3), priority: "high", estimatedMins: 60, focusScore: 80, description: "Chapter 7, definite integrals" },
      { title: "Review trigonometry formulas", subject: "Mathematics", priority: "low", estimatedMins: 30, focusScore: 60, status: "done" },
      { title: "Notes on Newton's laws", subject: "Physics", dueDate: iso(26), priority: "medium", estimatedMins: 45, focusScore: 70 },
      { title: "SAT Reading: two passages", subject: "English", dueDate: iso(3), priority: "high", estimatedMins: 40, focusScore: 75 },
      { title: "Essay: introduction draft", subject: "English", dueDate: iso(26), priority: "medium", estimatedMins: 50, focusScore: 65 },
    ],
  },
};

const subjects = (DATA[lang] || DATA.en).subjects;
const tasks = (DATA[lang] || DATA.en).tasks;

const ids = {};
for (const s of subjects) {
  const created = await post("/api/subjects", s);
  ids[s.name] = created.id || created.subject?.id;
}

for (const t of tasks) {
  const { subject, ...rest } = t;
  await post("/api/tasks", { ...rest, subjectId: ids[subject] });
}

console.log("Seeded", subjects.length, "subjects and", tasks.length, "tasks with correct UTF-8.");
