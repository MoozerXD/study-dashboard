const state = {
  me: null,
  subjects: [],
  tasks: [],
  goals: [],
  sessions: [],
  dashboard: null,
  focus: null,
  analytics: null,
  aiHistory: [],
  aiStatus: null,
  profile: null,
  aiConversation: [],
  aiAttachments: [],
  aiPendingTaskDrafts: [],
  aiBusy: false,
  taskFilter: "all",
  demoTasks: null,
  selectedSubjectId: null,
  calendarCursor: new Date(),
  calendarMode: "month",
  calendarSideView: "day",
  selectedDay: null,
  subjectTab: "progress",
  query: "",
  searchResults: [],
  activeSearchIndex: 0,
  confirmResolve: null,
  notificationsOpen: false,
};

const AI_ATTACHMENT_LIMIT = 5;
const AI_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
const AI_ATTACHMENT_TEXT_LIMIT = 18000;
const AI_ATTACHMENT_TEXT_EXTENSIONS = /\.(txt|md|csv|json|js|ts|tsx|jsx|html|css|scss|xml|yml|yaml|log|rtf)$/i;
const LANG_KEY = "studyLanguage";
const EN_TEXT = {
  "Дашборд": "Dashboard",
  "Задачи": "Tasks",
  "Предметы": "Subjects",
  "Экзамены": "Exams",
  "Подготовка к экзаменам": "Exam preparation",
  "Все экзамены": "All exams",
  "Все пробные тесты": "All mock tests",
  "Пробный тест": "Mock test",
  "Пробные тесты ЕНТ, ЕГЭ, IELTS, SAT": "Mock tests: UNT, EGE, IELTS, SAT",
  "Пробные тесты с таймером, банками вопросов и разбором ответов находятся в разделе «Экзамены».": "Timed mock tests with question banks and answer reviews live in the Exams section.",
  "Мини-тест от ИИ": "AI mini-test",
  "Короткий конспект": "Short summary",
  "Разбор сложной темы": "Tough topic breakdown",
  "Задания для практики": "Practice exercises",
  "Главные формулы, термины и примеры": "Key formulas, terms, and examples",
  "Объяснение простыми словами с примерами": "Plain-language explanation with examples",
  "Упражнения для закрепления темы": "Exercises to reinforce the topic",
  "Конспект": "Summary",
  "Разбор": "Breakdown",
  "Практика": "Practice",
  "→ ИИ": "→ AI",
  "Пробные тесты ЕНТ, ЕГЭ, IELTS и SAT: реальный формат, таймер, разбор ответов и отслеживание прогресса.": "Mock tests for UNT, EGE, IELTS and SAT: realistic format, timer, answer review and progress tracking.",
  "Календарь": "Calendar",
  "ИИ-помощник": "AI assistant",
  "Профиль": "Profile",
  "Тёмная": "Dark",
  "Светлая": "Light",
  "Поиск по задачам, предметам и материалам...": "Search tasks, subjects, and materials...",
  "Уведомления": "Notifications",
  "Выйти": "Sign out",
  "Студент": "Student",
  "Школьник": "School student",
  "Абитуриент": "Applicant",
  "Самообучение": "Self-study",
  "Аккаунт активен": "Account active",
  "Учись с": "Study with",
  "ИИ": "AI",
  "проще и эффективнее": "more simply and effectively",
  "Планируй, выполняй задачи и получай персональные рекомендации для уверенного прогресса каждый день.": "Plan, finish tasks, and get personal recommendations for steady progress every day.",
  "Создать задачу": "Create task",
  "Открыть ИИ-помощника": "Open AI assistant",
  "Сегодня": "Today",
  "Все задачи": "All tasks",
  "ИИ-план на день": "AI day plan",
  "Смотреть полный план": "View full plan",
  "Прогресс по предметам": "Subject progress",
  "Все предметы": "All subjects",
  "Личные данные": "Personal data",
  "Аватар": "Avatar",
  "Загрузи картинку профиля или оставь стандартный аватар.": "Upload a profile image or keep the default avatar.",
  "Выбрать фото": "Choose photo",
  "Убрать": "Remove",
  "Имя в профиле": "Profile name",
  "Email": "Email",
  "Роль": "Role",
  "Сохранить профиль": "Save profile",
  "Учебная статистика": "Study statistics",
  "Быстрые действия": "Quick actions",
  "Новая задача": "New task",
  "Добавить учебный блок": "Add a study block",
  "Посмотреть расписание": "View schedule",
  "Тема": "Theme",
  "Переключить оформление": "Switch appearance",
  "Обзор дня": "Day review",
  "Спросить ИИ о прогрессе": "Ask AI about progress",
  "Мои задачи": "My tasks",
  "Твой умный помощник для учебы, планирования и объяснения тем.": "Your smart assistant for studying, planning, and explaining topics.",
  "Составить план": "Make a plan",
  "Объяснить тему": "Explain topic",
  "Создать задачи": "Create tasks",
  "Я помогу тебе разобраться в теме, составить план занятий и превратить цели в конкретные задачи.": "I will help you understand topics, plan study sessions, and turn goals into concrete tasks.",
  "Объясни интегралы простыми словами": "Explain integrals in simple words",
  "Составь план подготовки к SAT": "Make a SAT prep plan",
  "Помоги с эссе по английскому": "Help with an English essay",
  "Разбей тему по физике на 5 шагов": "Break a physics topic into 5 steps",
  "Напиши запрос...": "Write a request...",
  "Прикрепить файл": "Attach file",
  "Отправить": "Send",
  "Что умеет ассистент": "Assistant capabilities",
  "Быстрые инструменты": "Quick tools",
  "Мини-тест": "Mini test",
  "Карточки": "Flashcards",
  "Конспект": "Notes",
  "План недели": "Week plan",
  "Планируй занятия, дедлайны и фокус-сессии на неделю и месяц.": "Plan lessons, deadlines, and focus sessions for the week and month.",
  "ИИ-рекомендации": "AI recommendations",
  "Управляй учебными задачами, дедлайнами и приоритетами без перегруза.": "Manage study tasks, deadlines, and priorities without overload.",
  "Фокус на сегодня": "Focus for today",
  "Смотреть день в календаре": "View day in calendar",
  "Следи за прогрессом по предметам, материалам и тестам.": "Track progress by subjects, materials, and tests.",
  "Материалы": "Materials",
  "Тесты": "Tests",
  "Прогресс": "Progress",
  "Добавить предмет": "Add subject",
  "Изменить": "Edit",
  "Удалить": "Delete",
  "Смотреть все тесты": "View all tests",
  "Лёгкий": "Easy",
  "Средний": "Medium",
  "Сложный": "Hard",
  "Нет данных": "No data",
  "Нет задач": "No tasks",
  "Задач в работе": "Active tasks",
  "Выполнено": "Done",
  "Предметов": "Subjects",
  "Фокус": "Focus",
  "Сохранить изменения": "Save changes",
  "Добавить задачи": "Add tasks",
  "Открыть календарь": "Open calendar",
  "Открыть задачи": "Open tasks",
  "Могу сразу превратить это в задачи.": "I can turn this into tasks now.",
  "Добавлю учебные блоки на сегодня и обновлю дашборд.": "I will add study blocks for today and update the dashboard.",
  "ИИ-задачи добавлены": "AI tasks added",
  "ИИ-задачи уже добавлены": "AI tasks are already added",
  "Live AI ответил": "Live AI replied",
  "AI API недоступен": "AI API is unavailable",
  "Добавь OPENAI_API_KEY": "Add OPENAI_API_KEY",
  "Предмет добавлен": "Subject added",
  "Предмет обновлен": "Subject updated",
  "Предмет удален": "Subject deleted",
  "Задача добавлена": "Task added",
  "Задача обновлена": "Task updated",
  "Задача удалена": "Task deleted",
  "Профиль обновлен": "Profile updated",
  "Закрыть меню": "Close menu",
  "Главная навигация": "Main navigation",
  "Открыть меню": "Open menu",
  "Результаты поиска": "Search results",
  ", проще и эффективнее": ", more simply and effectively",
  "Отличный фокус": "Great focus",
  "На этой неделе": "This week",
  "Дополнительно": "More options",
  "Как тебя показывать в интерфейсе": "How to show your name in the interface",
  "Темная тема": "Dark theme",
  "Светлая тема": "Light theme",
  "Составь план подготовки на сегодня": "Make a prep plan for today",
  "Объясни тему простыми словами": "Explain a topic in simple words",
  "Объясняет темы простыми словами": "Explains topics in simple words",
  "Помогает составлять планы и расписание": "Helps create plans and schedules",
  "Создает тесты и проверочные задания": "Creates tests and practice tasks",
  "Генерирует задачи и примеры": "Generates tasks and examples",
  "Контекст обучения": "Learning context",
  "Объясни интегралы простыми словами": "Explain integrals in simple words",
  "Составь план подготовки к SAT": "Make a SAT prep plan",
  "Помоги с эссе по английскому": "Help with an English essay",
  "Разбей тему по физике на 5 шагов": "Break a physics topic into 5 steps",
  "Создай мини-тест по моей слабой теме": "Create a mini test for my weak topic",
  "Сделай карточки для повторения": "Make flashcards for review",
  "Собери короткий конспект": "Make a short summary",
  "Составь план недели": "Make a weekly plan",
  "День": "Day",
  "Неделя": "Week",
  "Месяц": "Month",
  "Добавить событие": "Add event",
  "Предыдущий месяц": "Previous month",
  "Следующий месяц": "Next month",
  "Расписание дня": "Day schedule",
  "Переключить расписание": "Switch schedule",
  "Показать расписание дня": "Show day schedule",
  "Показать план недели": "Show week plan",
  "Смотреть полный день": "View full day",
  "Все": "All",
  "Важные": "Important",
  "Мои задачи": "My tasks",
  "Обзор задач": "Task overview",
  "Сфокусируйся на важном": "Focus on what matters",
  "Рекомендуем сначала закрыть задачи с высоким приоритетом, а затем перейти к повторению.": "Start with high-priority tasks, then move to review.",
  "Математика": "Mathematics",
  "Новая задача": "New task",
  "Название задачи": "Task title",
  "Без предмета": "No subject",
  "Высокий": "High",
  "Низкий": "Low",
  "Минуты": "Minutes",
  "Описание": "Description",
  "Добавить задачу": "Add task",
  "Новый предмет": "New subject",
  "Название предмета": "Subject name",
  "Цвет предмета": "Subject color",
  "Минут в неделю": "Minutes per week",
  "Подтвердить действие": "Confirm action",
  "Вы уверены?": "Are you sure?",
  "Отмена": "Cancel",
  "Проанализируй прикрепленные файлы": "Analyze the attached files",
  "ИИ анализирует запрос и учебный контекст": "AI is analyzing the request and study context",
  "Готово, я собрал ответ по твоему запросу.": "Done, I prepared an answer for your request.",
  "Готово, я добавил задачи и обновил список.": "Done, I added the tasks and refreshed the list.",
  "Запрос к AI API не прошёл. Проверь сервер, OPENAI_API_KEY и настройки модели, затем попробуй снова.": "The AI API request failed. Check the server, OPENAI_API_KEY, and model settings, then try again.",
  "Создано ИИ-помощником из текущего учебного контекста.": "Created by the AI assistant from the current study context.",
  "Создано ИИ-помощником из учебного плана.": "Created by the AI assistant from the study plan.",
  "без срока": "no due date",
  "Учеба": "Study",
  "Фокус-сессия": "Focus session",
  "пусто": "empty",
  "скоро": "soon",
  "В работе": "In progress",
  "Всего": "Total",
  "Просрочено": "Overdue",
  "Практика": "Practice",
  "Глубокая работа": "Deep work",
  "Изучение нового": "Learning new material",
  "Повторение": "Review",
  "Зона роста": "Growth area",
  "Перейти к содержимому": "Skip to content",
  "Сборник заданий": "Workbook",
  "Упражнения для закрепления темы": "Exercises to reinforce the topic",
  "Сбалансируй нагрузку": "Balance your workload",
  "Во второй половине недели добавь короткую фокус-сессию для восстановления.": "In the second half of the week, add a short focus session to recover.",
  "Подготовься к дедлайнам": "Prepare for deadlines",
  "У тебя есть задачи на ближайшие дни. Начни подготовку заранее.": "You have tasks in the next few days. Start preparing early.",
  "Оптимальное время": "Optimal time",
  "Твой пик продуктивности: 10:00 - 13:00. Планируй сложные блоки туда.": "Your productivity peak is 10:00 - 13:00. Put harder blocks there.",
  "План недели": "Week plan",
  "Расписание дня": "Day schedule",
  "Привет": "Hi",
  "Задач сегодня": "Tasks today",
  "На сегодня задач нет.": "No tasks for today.",
  "План появится из задач с дедлайном на сегодня.": "The plan will appear from tasks due today.",
  "Добавь предметы, чтобы видеть прогресс.": "Add subjects to see progress.",
  "Задач по этому фильтру нет.": "No tasks for this filter.",
  "Нет задач на сегодня.": "No tasks for today.",
  "Редактировать задачу": "Edit task",
  "Удалить задачу": "Delete task",
  "Изменить статус": "Change status",
  "Статус обновлен": "Status updated",
  "Не удалось обновить задачу": "Could not update task",
  "Не удалось добавить ИИ-задачи": "Could not add AI tasks",
  "Показаны все тесты по выбранному предмету": "All tests for the selected subject are shown",
  "Этот предмет нельзя удалить": "This subject cannot be deleted",
  "Удалить предмет?": "Delete subject?",
  "Предмет исчезнет из списка. Связанные задачи останутся без предмета.": "The subject will disappear from the list. Linked tasks will remain without a subject.",
  "Не удалось удалить предмет": "Could not delete subject",
  "Удалить задачу?": "Delete task?",
  "Задача исчезнет из списка. Это действие нельзя будет отменить.": "The task will disappear from the list. This action cannot be undone.",
  "Не удалось удалить задачу": "Could not delete task",
  "Почта не подтверждена": "Email not verified",
  "Средний фокус задач": "Average task focus",
  "Нет активных задач": "No active tasks",
  "По всем задачам": "Across all tasks",
  "Общий прогресс": "Overall progress",
  "Выполнено задач": "Tasks completed",
  "Фокус недели": "Weekly focus",
  "Попросить ИИ проанализировать": "Ask AI to analyze",
  "По этому предмету пока нет тестов для практики.": "There are no practice tests for this subject yet.",
  "Сгенерировать тест": "Generate test",
  "Учебник": "Textbook",
  "Базовая теория и ключевые правила": "Core theory and key rules",
  "Короткие конспекты": "Short notes",
  "Главные формулы, термины и примеры": "Main formulas, terms, and examples",
  "не пройдено": "not completed",
  "Учебный блок": "Study block",
  "Май 2025": "May 2025",
  "Ближайшая": "Next",
  "Открой календарь и проверь учебные блоки.": "Open the calendar and check study blocks.",
  "Есть высокий приоритет": "High priority exists",
  "лучше поставить первым учебным блоком.": "is better placed as the first study block.",
  "Разбери их первыми, чтобы план снова стал чистым.": "Handle them first to clean up the plan.",
  "Уведомлений пока нет": "No notifications yet",
  "Закрыть": "Close",
  "Убрать файл": "Remove file",
  "Добавлено": "Added",
  "из": "of",
  "файлов": "files",

  "Можно прикрепить до": "You can attach up to",
  "Не удалось прикрепить файл": "Could not attach the file",
  "ИИ сейчас недоступен": "AI is currently unavailable",
  "Можно просить планы, объяснения и разбор задач.": "You can ask for plans, explanations, and task reviews.",
  "Добавь API-ключ, чтобы ответы генерировались моделью.": "Add an API key so responses are generated by the model.",
  "AI-помощник подключен": "AI assistant connected",
  "AI-помощник в режиме настройки": "AI assistant in setup mode",
  "Не удалось сохранить задачу": "Could not save the task",
  "Не удалось обновить предмет": "Could not update the subject",
  "Не удалось добавить предмет": "Could not add the subject",
  "Выбери файл изображения": "Choose an image file",
  "Картинка слишком большая, выбери файл до 1.5 МБ": "The image is too large; choose a file up to 1.5 MB",
  "Аватар обновлен": "Avatar updated",
  "Аватар сброшен": "Avatar reset",
  "Pro-раздел скоро будет доступен": "The Pro section will be available soon",
  "Данные API недоступны, показан демо-режим": "API data is unavailable; demo mode is shown",

  "ИИ-план: глубокая работа по математике": "AI plan: deep math work",
  "ИИ-план: практика по физике": "AI plan: physics practice",
  "ИИ-план: повторение английского": "AI plan: English review",
  "Математика - уравнения и неравенства": "Mathematics - equations and inequalities",
  "Физика - механика, законы Ньютона": "Physics - mechanics, Newton's laws",
  "Практика - задачи по математике": "Practice - math problems",
  "Физика - задачи на движение": "Physics - motion problems",
  "Конечно! Вот оптимальный план на сегодня:": "Sure! Here is an optimal plan for today:",
  "Да, добавь, пожалуйста": "Yes, please add it",
  "Готово! Я добавил задачи и полезные материалы к каждому блоку плана.": "Done! I added tasks and useful materials to each plan block.",
  "Предметов пока нет. Добавьте первый предмет, чтобы отслеживать прогресс.": "No subjects yet. Add your first subject to track progress.",
  "Нет предметов": "No subjects",
  "Добавьте предмет, чтобы появились материалы, тесты и прогресс.": "Add a subject to see materials, tests, and progress.",
  "На этот день событий нет.": "No events for this day.",
  "Календарь пуст. Добавьте задачу с датой, чтобы она появилась в расписании.": "The calendar is empty. Add a task with a date to make it appear in the schedule.",
  "1 задача": "1 task",
  "Нет предметов для выбора": "No subjects to choose",
  "Конспект": "Summary",
  "Учебник по": "Textbook for",
  "20 вопросов": "20 questions",
  "25 вопросов": "25 questions",
  "15 вопросов": "15 questions",
  "10 вопросов": "10 questions",
  "18 вопросов": "18 questions",
  "22 вопроса": "22 questions",
  "12 вопросов": "12 questions",
};
const RU_TEXT = Object.fromEntries(Object.entries(EN_TEXT).map(([ru, en]) => [en, ru]));

function dateAt(offsetDays, hour, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

const DEMO_TASKS_KEY = "studyDashboardDemoTasks";

const subjectIcons = {
  math: "i-target",
  physics: "i-flask",
  english: "i-book",
  sat: "i-spark",
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
  // Some errors (rate limiting) ship both languages; show the one in use.
  if (!res.ok) throw new Error((currentLanguage() === "en" && data.errorEn) || data.error || "Request failed");
  return data;
}

function toast(text) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = translateValue(text);
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function currentLanguage() {
  return localStorage.getItem(LANG_KEY) === "en" ? "en" : "ru";
}

function currentLocale() {
  return currentLanguage() === "en" ? "en-US" : "ru-RU";
}

function translateValue(value, targetLang = currentLanguage()) {
  const source = String(value ?? "");
  if (!source.trim()) return source;
  const leading = source.match(/^\s*/)?.[0] || "";
  const trailing = source.match(/\s*$/)?.[0] || "";
  const text = source.trim();
  const dictionary = targetLang === "en" ? EN_TEXT : RU_TEXT;
  if (dictionary[text]) return `${leading}${dictionary[text]}${trailing}`;

  if (targetLang === "en") {
    return `${leading}${text
      .replace(/^(\d+)\s+на сегодня$/i, "$1 today")
      .replace(/^Прогресс\s+(\d+)%$/i, "Progress $1%")
      .replace(/^Учебник по\s+(.+)$/i, "Textbook for $1")
      .replace(/^(\d+)\s+вопрос(?:ов|а)?$/i, "$1 questions")
      .replace(/^Фокус\s+(\d+)%$/i, "Focus $1%")
      .replace(/^(\d+)\s+активн\.(?:\s+·\s+(\d+)\s+готово)?$/i, (_, active, done) => done ? `${active} active · ${done} done` : `${active} active`)
      .replace(/^(\d+)\s+мин$/i, "$1 min")
      .replace(/^(\d+)\s+задач(?:а|и)?$/i, "$1 tasks")
      .replace(/^(\d+)\s+просроченных задач$/i, "$1 overdue tasks")
      .replace(/^(\d+)\s+задач на сегодня$/i, "$1 tasks for today")
      .replace(/^Добавлено\s+(\d+)\s+из\s+(\d+)\s+файлов$/i, "Added $1 of $2 files")
      .replace(/^Можно прикрепить до\s+(\d+)\s+файлов$/i, "You can attach up to $1 files")
      .replace(/^Подготовлено задач:\s+(\d+)\.\s+Добавлю их и обновлю дашборд\.$/i, "Prepared tasks: $1. I will add them and update the dashboard.")
      .replace(/^Предмет «(.+)» исчезнет из списка\. Связанные задачи останутся без предмета\.$/i, "Subject “$1” will disappear from the list. Linked tasks will remain without a subject.")
      .replace(/^(.+) лучше поставить первым учебным блоком\.$/i, "$1 is better placed as the first study block.")
      .replace(/^Ближайшая:\s+(.+)\s+в\s+(.+)\.$/i, "Next: $1 at $2.")
      .replace(/^\+\s+ещё\s+(\d+)$/i, "+ $1 more")}${trailing}`;
  }

  return `${leading}${text
    .replace(/^(\d+)\s+today$/i, "$1 на сегодня")
    .replace(/^Progress\s+(\d+)%$/i, "Прогресс $1%")
    .replace(/^Textbook for\s+(.+)$/i, "Учебник по $1")
    .replace(/^(\d+)\s+questions$/i, "$1 вопросов")
    .replace(/^Focus\s+(\d+)%$/i, "Фокус $1%")
    .replace(/^(\d+)\s+active(?:\s+·\s+(\d+)\s+done)?$/i, (_, active, done) => done ? `${active} активн. · ${done} готово` : `${active} активн.`)
    .replace(/^(\d+)\s+min$/i, "$1 мин")
    .replace(/^(\d+)\s+tasks$/i, "$1 задач")
    .replace(/^(\d+)\s+overdue tasks$/i, "$1 просроченных задач")
    .replace(/^(\d+)\s+tasks for today$/i, "$1 задач на сегодня")
    .replace(/^Added\s+(\d+)\s+of\s+(\d+)\s+files$/i, "Добавлено $1 из $2 файлов")
    .replace(/^You can attach up to\s+(\d+)\s+files$/i, "Можно прикрепить до $1 файлов")
    .replace(/^Prepared tasks:\s+(\d+)\.\s+I will add them and update the dashboard\.$/i, "Подготовлено задач: $1. Добавлю их и обновлю дашборд.")
    .replace(/^Subject “(.+)” will disappear from the list\. Linked tasks will remain without a subject\.$/i, "Предмет «$1» исчезнет из списка. Связанные задачи останутся без предмета.")
    .replace(/^(.+) is better placed as the first study block\.$/i, "$1 лучше поставить первым учебным блоком.")
    .replace(/^Next:\s+(.+)\s+at\s+(.+)\.$/i, "Ближайшая: $1 в $2.")
    .replace(/^\+\s+(\d+)\s+more$/i, "+ ещё $1")}${trailing}`;
}

function updateLanguageToggle() {
  const lang = currentLanguage();
  document.documentElement.lang = lang;
  document.getElementById("languageToggleBtn")?.setAttribute("aria-label", lang === "en" ? "Switch language" : "Сменить язык");
  document.querySelectorAll(".language-label").forEach((label) => {
    label.textContent = lang.toUpperCase();
  });
}

function applyLanguage() {
  if (!document.body) return;
  const lang = currentLanguage();
  updateLanguageToggle();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script,style,textarea")) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => {
    node.nodeValue = translateValue(node.nodeValue, lang);
  });

  document.querySelectorAll("[placeholder],[aria-label],[title],[data-prompt]").forEach((element) => {
    ["placeholder", "aria-label", "title", "data-prompt"].forEach((attr) => {
      if (element.hasAttribute(attr)) {
        element.setAttribute(attr, translateValue(element.getAttribute(attr), lang));
      }
    });
  });
}

function setLanguage(lang) {
  localStorage.setItem(LANG_KEY, lang === "en" ? "en" : "ru");
  if (state.me) renderAll();
  else applyLanguage();
}

function formatBytes(bytes = 0) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} КБ`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} МБ`;
}

function isTextAttachment(file) {
  const type = String(file?.type || "").toLowerCase();
  return type.startsWith("text/")
    || ["application/json", "application/javascript", "application/xml", "text/markdown"].includes(type)
    || AI_ATTACHMENT_TEXT_EXTENSIONS.test(file?.name || "");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Не удалось прочитать файл")));
    reader.readAsDataURL(file);
  });
}

function extensionFromMime(type = "") {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "application/pdf") return "pdf";
  return "file";
}

function nameClipboardFile(file, index = 0) {
  if (!file) return null;
  const hasUsefulName = file.name && !/^image\.(png|jpg|jpeg|webp|gif)$/i.test(file.name);
  if (hasUsefulName) return file;
  const ext = extensionFromMime(file.type || "image/png");
  return new File([file], `Вставленное изображение ${index + 1}.${ext}`, { type: file.type || "image/png" });
}

function filesFromPasteEvent(event) {
  const items = Array.from(event.clipboardData?.items || []);
  return items
    .filter((item) => item.kind === "file")
    .map((item, index) => nameClipboardFile(item.getAsFile(), index))
    .filter(Boolean);
}

async function handleAiPaste(event) {
  if (state.aiBusy) return;
  const files = filesFromPasteEvent(event);
  if (!files.length) return;
  event.preventDefault();
  event.stopPropagation();
  await addAiFiles(files);
}

function attachmentIcon(kind) {
  if (kind === "image") return "i-spark";
  if (kind === "pdf") return "i-book";
  return "i-paperclip";
}

function renderAttachmentPreview(file, className = "attachment-preview") {
  if (file.kind === "image" && file.dataUrl) {
    return `<img class="${className}" src="${escapeHtml(file.dataUrl)}" alt="${escapeHtml(file.name)}">`;
  }
  return `<span class="${className} icon-preview">${icon(attachmentIcon(file.kind))}</span>`;
}

function attachmentSummary(attachments = state.aiAttachments) {
  if (!attachments.length) return "";
  return attachments.map((file) => `${file.name} (${formatBytes(file.size)})`).join(", ");
}

async function normalizeAiAttachment(file) {
  if (!file) return null;
  if (file.size > AI_ATTACHMENT_MAX_BYTES) {
    throw new Error(`${file.name}: файл больше ${formatBytes(AI_ATTACHMENT_MAX_BYTES)}`);
  }

  const type = file.type || "application/octet-stream";
  const base = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name || "Файл",
    type,
    size: file.size || 0,
  };

  if (isTextAttachment(file)) {
    const raw = await file.text();
    const truncated = raw.length > AI_ATTACHMENT_TEXT_LIMIT;
    return {
      ...base,
      kind: "text",
      text: truncated ? `${raw.slice(0, AI_ATTACHMENT_TEXT_LIMIT)}\n\n[Файл обрезан до ${AI_ATTACHMENT_TEXT_LIMIT} символов]` : raw,
    };
  }

  if (type.startsWith("image/") || type === "application/pdf") {
    return {
      ...base,
      kind: type === "application/pdf" ? "pdf" : "image",
      dataUrl: await readFileAsDataUrl(file),
    };
  }

  throw new Error(`${file.name}: поддерживаются текст, PDF и изображения`);
}

function renderAiAttachments() {
  const root = document.getElementById("aiAttachments");
  if (!root) return;
  root.classList.toggle("hidden", !state.aiAttachments.length);
  root.innerHTML = state.aiAttachments.map((file) => `
    <span class="attachment-chip" title="${escapeHtml(file.name)}">
      ${renderAttachmentPreview(file)}
      <span>
        <strong>${escapeHtml(file.name)}</strong>
        <small>${escapeHtml(formatBytes(file.size))}</small>
      </span>
      <button class="mini-icon-button" data-action="ai-remove-attachment" data-id="${escapeHtml(file.id)}" type="button" aria-label="Убрать файл">${icon("i-x")}</button>
    </span>
  `).join("");
}

async function addAiFiles(files) {
  const selected = Array.from(files || []);
  if (!selected.length) return;
  const remaining = AI_ATTACHMENT_LIMIT - state.aiAttachments.length;
  if (remaining <= 0) {
    toast(`Можно прикрепить до ${AI_ATTACHMENT_LIMIT} файлов`);
    return;
  }

  try {
    const normalized = [];
    for (const file of selected.slice(0, remaining)) {
      const item = await normalizeAiAttachment(file);
      if (item) normalized.push(item);
    }
    state.aiAttachments.push(...normalized);
    renderAiAttachments();
    if (selected.length > remaining) toast(`Добавлено ${remaining} из ${selected.length} файлов`);
  } catch (error) {
    toast(error.message || "Не удалось прикрепить файл");
  }
}

function removeAiAttachment(id) {
  state.aiAttachments = state.aiAttachments.filter((file) => file.id !== id);
  renderAiAttachments();
}

function clearAiAttachments() {
  state.aiAttachments = [];
  const input = document.getElementById("aiFileInput");
  if (input) input.value = "";
  renderAiAttachments();
}

const SUBSCRIPT_CHARS = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "=": "₌", "(": "₍", ")": "₎", "a": "ₐ", "e": "ₑ", "h": "ₕ", "i": "ᵢ", "j": "ⱼ", "k": "ₖ", "l": "ₗ", "m": "ₘ", "n": "ₙ", "o": "ₒ", "p": "ₚ", "r": "ᵣ", "s": "ₛ", "t": "ₜ", "u": "ᵤ", "v": "ᵥ", "x": "ₓ"
};
const SUPERSCRIPT_CHARS = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", "a": "ᵃ", "b": "ᵇ", "c": "ᶜ", "d": "ᵈ", "e": "ᵉ", "f": "ᶠ", "g": "ᵍ", "h": "ʰ", "i": "ⁱ", "j": "ʲ", "k": "ᵏ", "l": "ˡ", "m": "ᵐ", "n": "ⁿ", "o": "ᵒ", "p": "ᵖ", "r": "ʳ", "s": "ˢ", "t": "ᵗ", "u": "ᵘ", "v": "ᵛ", "w": "ʷ", "x": "ˣ", "y": "ʸ", "z": "ᶻ"
};

function scriptText(value, map) {
  return String(value || "").split("").map((char) => map[char] || map[char.toLowerCase()] || char).join("");
}

function latexToReadableMath(expression) {
  let text = String(expression || "").trim();
  if (!text) return "";
  text = text
    .replace(/\\left|\\right/g, "")
    .replace(/\\,/g, " ")
    .replace(/\\!/g, "")
    .replace(/\\;/g, " ")
    .replace(/\\quad/g, " ")
    .replace(/\\cdot/g, "·")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\approx/g, "≈")
    .replace(/\\infty/g, "∞")
    .replace(/\\pi/g, "π")
    .replace(/\\theta/g, "θ")
    .replace(/\\alpha/g, "α")
    .replace(/\\beta/g, "β")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\sum/g, "Σ");

  text = text.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, top, bottom) => `(${latexToReadableMath(top)})/(${latexToReadableMath(bottom)})`);
  text = text.replace(/\\sqrt\{([^{}]+)\}/g, (_, value) => `√(${latexToReadableMath(value)})`);
  text = text.replace(/\\int\s*_\{([^{}]+)\}\s*\^\{([^{}]+)\}/g, (_, lower, upper) => `∫${scriptText(lower, SUBSCRIPT_CHARS)}${scriptText(upper, SUPERSCRIPT_CHARS)}`);
  text = text.replace(/\\int\s*\^\{([^{}]+)\}\s*_\{([^{}]+)\}/g, (_, upper, lower) => `∫${scriptText(lower, SUBSCRIPT_CHARS)}${scriptText(upper, SUPERSCRIPT_CHARS)}`);
  text = text.replace(/\\int/g, "∫");
  text = text.replace(/_\{([^{}]+)\}/g, (_, value) => scriptText(latexToReadableMath(value), SUBSCRIPT_CHARS));
  text = text.replace(/\^\{([^{}]+)\}/g, (_, value) => scriptText(latexToReadableMath(value), SUPERSCRIPT_CHARS));
  text = text.replace(/_([A-Za-z0-9+-])/g, (_, value) => scriptText(value, SUBSCRIPT_CHARS));
  text = text.replace(/\^([A-Za-z0-9+-])/g, (_, value) => scriptText(value, SUPERSCRIPT_CHARS));
  text = text.replace(/\\([A-Za-z]+)/g, "$1");
  return text.replace(/\s+/g, " ").trim();
}

function renderMathExpression(expression, block = false) {
  return `<span class="ai-math${block ? " block" : ""}">${latexToReadableMath(expression)}</span>`;
}

function formatAiText(value) {
  let html = escapeHtml(value);
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, expression) => renderMathExpression(expression, true));
  html = html.replace(/\$([^$\n]+?)\$/g, (_, expression) => renderMathExpression(expression));
  html = html.replace(/\\\((.*?)\\\)/gs, (_, expression) => renderMathExpression(expression));
  html = html.replace(/\\\[(.*?)\\\]/gs, (_, expression) => renderMathExpression(expression, true));
  html = html.replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>");
  html = html.replace(/(^|<br>)-\s+/g, "$1<span class=\"ai-bullet\">•</span> ");
  return html.replaceAll("\n", "<br>");
}

function icon(id) {
  return `<svg><use href="#${id}"></use></svg>`;
}

function isDemoId(id) {
  return String(id || "").startsWith("demo-");
}

function readStoredDemoTasks() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEMO_TASKS_KEY) || "null");
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistDemoTasks(tasks) {
  state.demoTasks = Array.isArray(tasks) ? tasks : [];
  localStorage.setItem(DEMO_TASKS_KEY, JSON.stringify(state.demoTasks));
}

function getDemoTasks() {
  return [];
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  const safe = Number.isFinite(number) ? number : fallback;
  return Math.min(max, Math.max(min, safe));
}

function normalizeTaskPayload(payload) {
  const next = { ...payload };
  if (next.dueDate !== undefined) next.dueDate = next.dueDate ? new Date(next.dueDate).toISOString() : null;
  if (next.estimatedMins !== undefined) next.estimatedMins = clampNumber(next.estimatedMins, 5, 480, 45);
  if (next.focusScore !== undefined) next.focusScore = clampNumber(next.focusScore, 1, 100, 70);
  return next;
}

function updateDemoTask(id, patch) {
  const now = new Date().toISOString();
  const normalized = normalizeTaskPayload(patch);
  const nextTasks = getDemoTasks().map((task) => {
    if (String(task.id) !== String(id)) return task;
    const status = normalized.status || task.status;
    return {
      ...task,
      ...normalized,
      status,
      completedAt: status === "done" ? (task.completedAt || now) : null,
      updatedAt: now,
    };
  });
  persistDemoTasks(nextTasks);
}

function deleteDemoTask(id) {
  persistDemoTasks(getDemoTasks().filter((task) => String(task.id) !== String(id)));
}

function formatDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatTime(value) {
  if (!value) return translateValue("без срока");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return translateValue("без срока");
  return date.toLocaleTimeString(currentLocale(), { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value, options = {}) {
  if (!value) return translateValue("без срока");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return translateValue("без срока");
  return date.toLocaleDateString(currentLocale(), {
    day: "numeric",
    month: options.month || "short",
    weekday: options.weekday,
  });
}

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isSameDay(a, b) {
  return dayKey(a) === dayKey(b);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateWithTime(baseDate, hour, minute = 0) {
  const date = new Date(baseDate);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function getSubjects() {
  return state.subjects;
}

function getRealSubjects() {
  return state.subjects.filter((subject) => !isDemoId(subject.id));
}

function getBaseTasks() {
  return state.tasks;
}

function getBaseSessions() {
  return state.sessions;
}

function getSubject(subjectId) {
  return getSubjects().find((subject) => subject.id === subjectId)
    || getSubjects().find((subject) => subject.id === subjectId?.id)
    || null;
}

function getSubjectById(id) {
  return getSubjects().find((subject) => String(subject.id) === String(id)) || null;
}

function normalizeSubjectColor(subject, index = 0) {
  const colors = ["#4f8cff", "#4fd8c2", "#9b63ff", "#ff9d43", "#ff5574"];
  return subject.color || colors[index % colors.length];
}

function subjectKind(subject) {
  const name = String(subject?.name || "").toLowerCase();
  if (/math|матем/.test(name)) return "math";
  if (/phys|физ/.test(name)) return "physics";
  if (/eng|англ/.test(name)) return "english";
  if (/sat/.test(name)) return "sat";
  return "math";
}

function withSubject(task) {
  const subject = task.subject || getSubject(task.subjectId);
  return { ...task, subject };
}

function taskMatchesSearch(task) {
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  const subject = task.subject || getSubject(task.subjectId);
  return [
    task.title,
    task.description,
    subject?.name,
    task.priority,
    task.status,
  ].some((value) => String(value || "").toLowerCase().includes(q));
}

function getFilteredTasks() {
  const today = new Date();
  return getBaseTasks().map(withSubject).filter((task) => {
    if (!taskMatchesSearch(task)) return false;
    if (state.taskFilter === "today") return task.dueDate && isSameDay(task.dueDate, today);
    if (state.taskFilter === "important") return task.priority === "high";
    if (state.taskFilter === "overdue") return task.status !== "done" && task.dueDate && new Date(task.dueDate) < today;
    return true;
  });
}

function getSearchResults(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const results = [];

  getBaseTasks().map(withSubject).forEach((task) => {
    const haystack = [task.title, task.description, task.subject?.name, priorityLabel(task.priority), task.status]
      .join(" ")
      .toLowerCase();
    if (haystack.includes(q)) {
      results.push({
        type: "Задача",
        title: task.title,
        meta: `${task.subject?.name || "Без предмета"} · ${task.dueDate ? formatTime(task.dueDate) : "без срока"}`,
        icon: "i-check",
        route: "tasks",
        taskFilter: "all",
      });
    }
  });

  getSubjects().forEach((subject) => {
    const haystack = [subject.name, subject.description, subject.note].join(" ").toLowerCase();
    if (haystack.includes(q)) {
      results.push({
        type: "Предмет",
        title: subject.name,
        meta: `Прогресс ${subjectProgress(subject)}%`,
        icon: subjectIcons[subjectKind(subject)] || "i-book",
        route: "subjects",
        subjectId: subject.id,
      });
    }
  });

  [
    { title: "Дашборд", meta: "Обзор дня и прогресс", icon: "i-home", route: "dashboard", keywords: "дашборд dashboard обзор главная" },
    { title: "Экзамены", meta: "Пробные тесты ЕНТ, ЕГЭ, IELTS, SAT", icon: "i-list", route: "exams", keywords: "экзамен экзамены ент егэ ielts sat пробник тест mock подготовка unt ege" },
    { title: "Календарь", meta: "Расписание и события", icon: "i-calendar", route: "calendar", keywords: "календарь расписание план день неделя месяц" },
    { title: "ИИ-помощник", meta: "Объяснения, планы, тесты", icon: "i-spark", route: "ai", keywords: "ии ai помощник объясни план тест карточки" },
    { title: "Профиль", meta: "Аккаунт, статистика и настройки", icon: "i-user", route: "profile", keywords: "профиль аккаунт пользователь настройки имя email" },
    { title: "Создать задачу", meta: "Быстро добавить новую задачу", icon: "i-plus", action: "open-task", keywords: "создать добавить новая задача" },
  ].forEach((item) => {
    const haystack = `${item.title} ${item.meta} ${item.keywords}`.toLowerCase();
    if (haystack.includes(q)) results.push({ type: "Раздел", ...item });
  });

  if (/интеграл|производн|эссе|конспект|карточ|тест|объясн|план/.test(q)) {
    results.unshift({
      type: "ИИ",
      title: `Спросить ИИ: ${query.trim()}`,
      meta: "Открыть помощника и отправить запрос",
      icon: "i-brain",
      route: "ai",
      aiPrompt: query.trim(),
    });
  }

  return results.slice(0, 8);
}

function renderSearchResults() {
  const panel = document.getElementById("searchResults");
  if (!panel) return;
  const q = state.query.trim();
  state.searchResults = getSearchResults(q);
  state.activeSearchIndex = Math.min(state.activeSearchIndex, Math.max(0, state.searchResults.length - 1));

  if (!q) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  panel.classList.remove("hidden");
  if (!state.searchResults.length) {
    panel.innerHTML = `
      <div class="search-empty">
        Ничего не найдено. Нажми Enter, чтобы спросить ИИ: "${escapeHtml(q)}".
      </div>
    `;
    return;
  }

  panel.innerHTML = state.searchResults.map((item, index) => `
    <button class="search-result-item ${index === state.activeSearchIndex ? "active" : ""}" data-search-index="${index}" type="button" role="option">
      <span class="search-result-icon">${icon(item.icon || "i-search")}</span>
      <span>
        <span class="search-result-title">${escapeHtml(item.title)}</span>
        <span class="search-result-meta">${escapeHtml(item.meta || "")}</span>
      </span>
      <span class="search-result-type">${escapeHtml(item.type || "")}</span>
    </button>
  `).join("");
}

async function activateSearchResult(index = state.activeSearchIndex) {
  const item = state.searchResults[index];
  const input = document.getElementById("globalSearch");
  const query = state.query.trim();
  document.getElementById("searchResults")?.classList.add("hidden");

  if (!item) {
    if (query) {
      setActiveRoute("ai");
      await requestAiReply(query);
      if (input) input.value = "";
      state.query = "";
      renderSearchResults();
    }
    return;
  }

  if (item.action === "open-task") {
    openTaskModal();
  } else if (item.route) {
    setActiveRoute(item.route);
    if (item.subjectId) {
      state.selectedSubjectId = item.subjectId;
      renderSubjects();
    }
    if (item.taskFilter) {
      state.taskFilter = item.taskFilter;
      renderTasks();
    }
    if (item.aiPrompt) {
      await requestAiReply(item.aiPrompt);
    }
  }

  if (input) input.value = "";
  state.query = "";
  renderDashboard();
  renderTasks();
  renderSubjects();
  renderSearchResults();
}

function priorityLabel(priority) {
  return ({
    high: "Высокий",
    medium: "Средний",
    low: "Низкий",
  })[priority] || "Средний";
}

function priorityClass(priority) {
  return priority === "high" ? "red" : priority === "low" ? "green" : "amber";
}

function subjectPillClass(subject) {
  const kind = subjectKind(subject);
  return kind === "physics" ? "green" : kind === "english" ? "purple" : kind === "sat" ? "amber" : "blue";
}

function completionRate(tasks = getBaseTasks()) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((task) => task.status === "done").length / tasks.length) * 100);
}

function subjectProgress(subject) {
  const subjectTasks = state.tasks.filter((task) => task.subjectId === subject.id || task.subject?.id === subject.id);
  if (!subjectTasks.length) return 0;
  return completionRate(subjectTasks);
}

function getProfileEmail() {
  return state.me?.email || "Студент";
}

function getDefaultProfileName() {
  const email = getProfileEmail();
  if (email && email.includes("@")) return email.split("@")[0];
  return "Студент";
}

// The profile lives on the server so it follows the account across devices.
// localStorage is kept as an offline cache and as the source for the one-time
// migration of profiles that were only ever stored in the browser.
function getProfileName() {
  return state.profile?.displayName || localStorage.getItem("studyProfileName") || getDefaultProfileName();
}

function getProfileRole() {
  return state.profile?.role || localStorage.getItem("studyProfileRole") || "Студент";
}

function getProfileAvatar() {
  return state.profile?.avatar || localStorage.getItem("studyProfileAvatar") || "";
}

async function saveProfile(patch) {
  state.profile = { ...(state.profile || {}), ...patch };
  // Mirror locally so the interface survives a reload even if the request fails.
  if (patch.displayName !== undefined) localStorage.setItem("studyProfileName", patch.displayName);
  if (patch.role !== undefined) localStorage.setItem("studyProfileRole", patch.role);
  if (patch.avatar !== undefined) {
    if (patch.avatar) localStorage.setItem("studyProfileAvatar", patch.avatar);
    else localStorage.removeItem("studyProfileAvatar");
  }
  renderUser();
  renderProfile();
  try {
    await api("/api/profile", { method: "PUT", body: patch });
    return true;
  } catch (error) {
    toast(error.message || "Не удалось сохранить профиль на сервере");
    return false;
  }
}

function getProfileInitials() {
  const source = getProfileName() || getProfileEmail();
  const parts = String(source).replace(/@.*/, "").split(/\s+|[._-]+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return initials || "AI";
}

function setAvatarElement(el, avatarUrl, initials = getProfileInitials()) {
  if (!el) return;
  el.textContent = avatarUrl ? "" : initials;
  el.classList.toggle("has-image", Boolean(avatarUrl));
  el.style.backgroundImage = avatarUrl ? `url("${avatarUrl}")` : "";
}

function renderAvatars() {
  const avatar = getProfileAvatar();
  const initials = getProfileInitials();
  setAvatarElement(document.getElementById("userAvatar"), avatar, initials);
  setAvatarElement(document.getElementById("profileInitials"), avatar, initials);
  setAvatarElement(document.getElementById("profileAvatarPreview"), avatar, initials);
}

function renderProfile() {
  const root = document.getElementById("route-profile");
  if (!root) return;

  const tasks = state.tasks.map(withSubject);
  const subjects = getSubjects();
  const done = tasks.filter((task) => task.status === "done").length;
  const active = tasks.filter((task) => task.status !== "done").length;
  const today = tasks.filter((task) => task.dueDate && isSameDay(task.dueDate, new Date())).length;
  const progress = completionRate(tasks);
  const focusValue = state.focus?.risk ? Math.max(0, 100 - Number(state.focus.risk || 0)) : 85;
  const weakSubject = subjects
    .map((subject) => ({ subject, progress: subjectProgress(subject) }))
    .sort((a, b) => a.progress - b.progress)[0];

  const name = getProfileName();
  const email = getProfileEmail();
  const role = getProfileRole();

  renderAvatars();
  document.getElementById("profileDisplayName").textContent = name;
  document.getElementById("profileDisplayEmail").textContent = email;
  document.getElementById("profileRoleBadge").textContent = role;
  document.getElementById("profileVerifyBadge").textContent = state.me?.isEmailVerified === false ? "Почта не подтверждена" : "Аккаунт активен";
  document.getElementById("profileNameInput").value = name;
  document.getElementById("profileEmailInput").value = email;
  document.getElementById("profileRoleSelect").value = role;
  document.getElementById("profileThemeLabel").textContent = document.documentElement.classList.contains("light-theme") ? "Светлая тема" : "Темная тема";

  document.getElementById("profileStats").innerHTML = [
    ["Задач в работе", active, "i-check", "blue"],
    ["Выполнено", done, "i-target", "green"],
    ["Предметов", subjects.length, "i-book", "purple"],
    ["Сегодня", today, "i-calendar", "amber"],
    ["Прогресс", `${progress}%`, "i-chart", "blue"],
    ["Фокус", `${focusValue}%`, "i-brain", "green"],
  ].map(([label, value, iconId, tone]) => `
    <div class="profile-stat-card">
      <span class="plan-icon ${tone}">${icon(iconId)}</span>
      <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
    </div>
  `).join("");

  if (weakSubject?.subject) {
    document.getElementById("profileRoleBadge").title = `${translateValue("Зона роста")}: ${weakSubject.subject.name}`;
  }
}

function renderTaskItem(task, options = {}) {
  const subject = task.subject || getSubject(task.subjectId);
  const done = task.status === "done";
  const time = task.dueDate ? formatTime(task.dueDate) : "без срока";
  const title = options.subjectPrefix && subject ? `${subject.name} - ${task.title}` : task.title;
  const subjectName = subject?.name || "Учеба";
  const demoAttr = isDemoId(task.id) ? " data-demo=\"true\"" : "";
  const actions = options.showActions ? `
      <div class="task-actions">
        <button class="mini-icon-button" data-action="task-edit" data-id="${escapeHtml(task.id)}" type="button" aria-label="Редактировать задачу">${icon("i-pen")}</button>
        <button class="mini-icon-button danger" data-action="task-delete" data-id="${escapeHtml(task.id)}" type="button" aria-label="Удалить задачу">${icon("i-x")}</button>
      </div>
    ` : "";

  return `
    <div class="task-item ${done ? "done" : ""}" data-task-id="${escapeHtml(task.id)}">
      <button class="task-check ${done ? "done" : ""}" data-action="task-status" data-id="${escapeHtml(task.id)}" data-status="${done ? "todo" : "done"}"${demoAttr} type="button" aria-label="Изменить статус">
        ${done ? icon("i-check") : ""}
      </button>
      <div class="task-title">
        <strong>${escapeHtml(title)}</strong>
        <span class="pill ${subjectPillClass(subject)}">${escapeHtml(subjectName)}</span>
        ${options.showPriority ? `<span class="pill ${priorityClass(task.priority)}">${priorityLabel(task.priority)}</span>` : ""}
      </div>
      <div class="task-meta">${time}</div>
      ${actions}
    </div>
  `;
}

function getTaskById(id) {
  return getBaseTasks().map(withSubject).find((task) => String(task.id) === String(id)) || null;
}

function openTaskModal(task = null) {
  const form = document.getElementById("taskForm");
  if (!form) return;

  form.reset();
  fillSubjectSelects();
  const editing = Boolean(task);
  form.dataset.mode = editing ? "edit" : "create";
  form.elements.taskId.value = editing ? task.id : "";
  form.elements.title.value = editing ? task.title || "" : "";
  form.elements.subjectId.value = editing ? task.subjectId || task.subject?.id || "" : "";
  form.elements.dueDate.value = editing ? formatDateTimeLocal(task.dueDate) : "";
  form.elements.priority.value = editing ? task.priority || "medium" : "medium";
  form.elements.estimatedMins.value = editing ? task.estimatedMins || 45 : 45;
  form.elements.focusScore.value = editing ? task.focusScore || 70 : 70;
  form.elements.description.value = editing ? task.description || "" : "";

  document.getElementById("taskModalTitle").textContent = editing ? "Редактировать задачу" : "Новая задача";
  document.getElementById("taskSubmitBtn").textContent = editing ? "Сохранить изменения" : "Добавить задачу";
  document.getElementById("taskDeleteBtn")?.classList.toggle("hidden", !editing);
  toggleModal("taskModal", true);
}

function openSubjectModal(subject = null) {
  const form = document.getElementById("subjectForm");
  if (!form) return;

  const editing = Boolean(subject) && !isDemoId(subject.id);
  form.reset();
  form.dataset.mode = editing ? "edit" : "create";
  form.elements.subjectId.value = editing ? subject.id : "";
  form.elements.name.value = editing ? subject.name || "" : "";
  form.elements.color.value = editing ? normalizeSubjectColor(subject) : "#4f8cff";
  form.elements.targetMinutes.value = editing ? subject.targetMinutes || 240 : 240;
  form.elements.description.value = editing ? subject.description || "" : "";

  document.getElementById("subjectModalTitle").textContent = editing ? "Редактировать предмет" : "Новый предмет";
  document.getElementById("subjectSubmitBtn").textContent = editing ? "Сохранить изменения" : "Добавить предмет";
  document.getElementById("subjectDeleteBtn")?.classList.toggle("hidden", !editing);
  toggleModal("subjectModal", true);
  form.elements.name?.focus();
}

async function saveTask(taskId, payload) {
  if (isDemoId(taskId)) {
    updateDemoTask(taskId, payload);
    renderAll();
    return;
  }
  await api(`/api/tasks/${taskId}`, { method: "PATCH", body: payload });
  await refresh();
}

async function removeTask(taskId) {
  if (!taskId) return;
  if (isDemoId(taskId)) {
    deleteDemoTask(taskId);
    renderAll();
    return;
  }
  await api(`/api/tasks/${taskId}`, { method: "DELETE" });
  await refresh();
}

async function removeSubject(subjectId) {
  if (!subjectId || isDemoId(subjectId)) return;
  await api(`/api/subjects/${subjectId}`, { method: "DELETE" });
  if (String(state.selectedSubjectId) === String(subjectId)) state.selectedSubjectId = null;
  await refresh();
}

function buildPlanItems() {
  const todayTasks = state.tasks
    .map(withSubject)
    .filter((task) => task.status !== "done" && task.dueDate && isSameDay(task.dueDate, new Date()))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  const labels = ["Глубокая работа", "Изучение нового", "Практика", "Повторение"];
  const iconClasses = ["blue", "purple", "green", "amber"];
  const icons = ["i-target", "i-flask", "i-pen", "i-book"];

  return todayTasks.slice(0, 4).map((task, index) => {
    const subject = task.subject || getSubject(task.subjectId);
    const start = task.dueDate ? new Date(task.dueDate) : null;
    const duration = Math.max(30, Number(task.estimatedMins || 60));
    const end = start ? new Date(start.getTime() + duration * 60_000) : null;
    const time = start && end ? `${formatTime(start)} - ${formatTime(end)}` : "без времени";
    return {
      taskId: task.id,
      time,
      label: labels[index] || "Учебный блок",
      detail: subject ? `${subject.name} - ${task.title}` : task.title,
      icon: icons[index] || "i-target",
      tone: iconClasses[index] || "blue",
    };
  });
}

function renderDashboard() {
  const tasks = state.tasks.map(withSubject);
  const activeTasks = tasks.filter((task) => task.status !== "done");
  const todayTasks = activeTasks.filter((task) => task.dueDate && isSameDay(task.dueDate, new Date()));
  const total = tasks.length;
  const focusValue = activeTasks.length
    ? Math.round(activeTasks.reduce((sum, task) => sum + Number(task.focusScore || 0), 0) / activeTasks.length)
    : 0;
  const progress = tasks.length ? completionRate(tasks) : 0;

  document.getElementById("metricTotalTasks").textContent = total;
  document.getElementById("metricFocus").textContent = `${focusValue}%`;
  document.getElementById("metricProgress").textContent = `${progress}%`;
  document.getElementById("metricTodayTasks").textContent = `${todayTasks.length} на сегодня`;
  document.getElementById("metricFocusNote").textContent = activeTasks.length ? "Средний фокус задач" : "Нет активных задач";
  document.getElementById("metricProgressNote").textContent = tasks.length ? "По всем задачам" : "Нет данных";

  const todayWrap = document.getElementById("dashboardTodayTasks");
  const todaySource = (todayTasks.length ? todayTasks : getDemoTasks().map(withSubject).slice(0, 4));
  todayWrap.innerHTML = todaySource.slice(0, 4).map((task) => renderTaskItem(task, { subjectPrefix: true })).join("");
  if (!todayTasks.length) {
    todayWrap.innerHTML = `<div class="empty dashboard-empty"><strong>На сегодня задач нет.</strong><button class="primary-button open-task-modal" type="button">Создать задачу</button></div>`;
  }

  document.getElementById("dashboardPlan").innerHTML = buildPlanItems().map((item) => `
    <button class="plan-item" data-action="plan-item" data-id="${escapeHtml(item.taskId)}" type="button">
      <div class="plan-time">${escapeHtml(item.time)}</div>
      <span class="plan-icon ${item.tone}">${icon(item.icon)}</span>
      <div class="plan-text">
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.detail)}</span>
      </div>
    </button>
  `).join("");
  if (!buildPlanItems().length) {
    document.getElementById("dashboardPlan").innerHTML = `<div class="empty dashboard-empty"><strong>План появится из задач с дедлайном на сегодня.</strong><button class="primary-button open-task-modal" type="button">Добавить задачу</button></div>`;
  }

  const subjects = state.subjects.slice(0, 3);
  document.getElementById("dashboardSubjectProgress").innerHTML = subjects.map((subject, index) => {
    const color = normalizeSubjectColor(subject, index);
    const progressValue = subjectProgress(subject);
    return `
      <button class="subject-progress" data-action="subject-progress" data-subject-id="${escapeHtml(subject.id)}" type="button">
        <div class="subject-progress-head"><span>${escapeHtml(subject.name)}</span><strong>${progressValue}%</strong></div>
        <div class="progress-track"><span class="progress-fill" style="width:${progressValue}%;background:${color}"></span></div>
      </button>
    `;
  }).join("");
  if (!subjects.length) {
    document.getElementById("dashboardSubjectProgress").innerHTML = `<div class="empty dashboard-empty"><strong>Добавь предметы, чтобы видеть прогресс.</strong><button class="primary-button open-subject-modal" type="button">Добавить предмет</button></div>`;
  }
}

function renderTasks() {
  const tasks = getFilteredTasks();
  const allTasks = getBaseTasks().map(withSubject);
  const todayTasks = allTasks.filter((task) => task.dueDate && isSameDay(task.dueDate, new Date()));
  const overdue = allTasks.filter((task) => task.status !== "done" && task.dueDate && new Date(task.dueDate) < new Date()).length;
  const inProgress = allTasks.filter((task) => task.status !== "done").length;
  const doneTasks = allTasks.filter((task) => task.status === "done").length;

  const list = document.getElementById("taskList");
  list.innerHTML = tasks.length
    ? tasks.map((task) => renderTaskItem(task, { showPriority: true, showActions: true })).join("")
    : `<div class="empty">Задач по этому фильтру нет.</div>`;

  document.getElementById("taskOverview").innerHTML = [
    ["Всего", allTasks.length, "i-calendar", "blue"],
    ["В работе", inProgress, "i-chart", "blue"],
    ["Выполнено", doneTasks, "i-check", "green"],
    ["Просрочено", overdue, "i-bell", "red"],
  ].map(([label, value, iconId, tone]) => `
    <div class="overview-card">
      <span class="plan-icon ${tone}">${icon(iconId)}</span>
      <div><span>${label}</span><strong>${value}</strong></div>
    </div>
  `).join("");

  const focusSource = todayTasks;
  document.getElementById("taskFocus").innerHTML = focusSource.length ? focusSource.slice(0, 3).map((task) => `
    <div class="focus-item">
      <div class="focus-time">${formatTime(task.dueDate)}</div>
      <div>
        <strong>${escapeHtml(task.subject?.name || "Учеба")}</strong>
        <span>${escapeHtml(task.title)}</span>
      </div>
    </div>
  `).join("") : `<div class="empty">${translateValue("Нет задач на сегодня.")}</div>`;
  applyLanguage();
}

function getSubjectTasks(subject) {
  if (!subject) return [];
  return state.tasks
    .map(withSubject)
    .filter((task) => task.subjectId === subject.id || task.subject?.id === subject.id)
    .sort((a, b) => {
      const doneA = a.status === "done" ? 1 : 0;
      const doneB = b.status === "done" ? 1 : 0;
      return doneA - doneB || String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999"));
    });
}

function renderSubjectEmpty(message, actionHtml = "") {
  return `
    <div class="empty subject-empty">
      <strong>${escapeHtml(message)}</strong>
      ${actionHtml || '<button class="primary-button open-task-modal" type="button">Создать задачу</button>'}
    </div>
  `;
}

function renderMaterialPlaceholders(selected) {
  const subjectName = selected?.name || "предмету";
  const actions = [
    ["Конспект", "Короткий конспект", "Главные формулы, термины и примеры", `Собери короткий конспект по предмету ${subjectName}`],
    ["Разбор", "Разбор сложной темы", "Объяснение простыми словами с примерами", `Объясни самую сложную тему по предмету ${subjectName} простыми словами`],
    ["Практика", "Задания для практики", "Упражнения для закрепления темы", `Составь 5 практических заданий по предмету ${subjectName} с ответами`],
  ];

  return actions.map(([kind, title, meta, prompt]) => `
    <button class="test-item ai-quick" data-prompt="${escapeHtml(prompt)}" type="button">
      <span class="test-icon ${subjectPillClass(selected)}">${icon("i-book")}</span>
      <strong>${escapeHtml(title)}</strong>
      <span class="pill ${subjectPillClass(selected)}">${escapeHtml(kind)}</span>
      <span class="test-meta">${escapeHtml(meta)}</span>
      <span class="score muted">→ ИИ</span>
    </button>
  `).join("");
}

function renderSubjectTabContent(selected, tests, selectedKind) {
  const wrap = document.getElementById("subjectTests");
  document.querySelectorAll("[data-subject-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.subjectTab === state.subjectTab);
  });

  if (state.subjectTab === "materials") {
    wrap.innerHTML = renderMaterialPlaceholders(selected);
    return;
  }

  if (state.subjectTab === "progress") {
    const progress = subjectProgress(selected);
    const subjectTasks = state.tasks.filter((task) => task.subjectId === selected.id || task.subject?.id === selected.id);
    const done = subjectTasks.filter((task) => task.status === "done").length;
    wrap.innerHTML = `
      <div class="subject-progress-detail">
        <div class="overview-card">
          <span class="plan-icon blue">${icon("i-chart")}</span>
          <div><span>Общий прогресс</span><strong>${progress}%</strong></div>
        </div>
        <div class="overview-card">
          <span class="plan-icon green">${icon("i-check")}</span>
          <div><span>Выполнено задач</span><strong>${done}/${subjectTasks.length}</strong></div>
        </div>
        <div class="overview-card">
          <span class="plan-icon purple">${icon("i-target")}</span>
          <div><span>Фокус недели</span><strong>${subjectTasks.length ? progress : 0}%</strong></div>
        </div>
        <button class="primary-button ai-quick" data-prompt="Проанализируй прогресс по предмету ${escapeHtml(selected.name)} и дай план улучшения" type="button">Попросить ИИ проанализировать</button>
      </div>
    `;
    return;
  }

  // Вкладка «Тесты»: настоящие пробники живут в разделе «Экзамены»
  wrap.innerHTML = `
    <div class="subject-exams-cta">
      <p>${translateValue("Пробные тесты с таймером, банками вопросов и разбором ответов находятся в разделе «Экзамены».")}</p>
      <div class="subject-exams-buttons">
        <button class="ghost-button" data-action="exam-open" data-exam="ent" type="button">🇰🇿 ЕНТ</button>
        <button class="ghost-button" data-action="exam-open" data-exam="ege" type="button">🇷🇺 ЕГЭ</button>
        <button class="ghost-button" data-action="exam-open" data-exam="ielts" type="button">🌍 IELTS</button>
        <button class="ghost-button" data-action="exam-open" data-exam="sat" type="button">🇺🇸 SAT</button>
        <button class="primary-button ai-quick" data-prompt="Создай мини-тест по предмету ${escapeHtml(selected.name)}" type="button">${translateValue("Мини-тест от ИИ")}</button>
      </div>
    </div>`;
}

function renderSubjects() {
  const subjects = getSubjects();
  const selected = subjects.find((subject) => subject.id === state.selectedSubjectId) || subjects[0];
  if (selected && state.selectedSubjectId !== selected.id) state.selectedSubjectId = selected.id;

  const cardsRoot = document.getElementById("subjectCards");
  const titleRoot = document.getElementById("activeSubjectTitle");
  const testsRoot = document.getElementById("subjectTests");
  const allTestsButton = document.querySelector("[data-action='all-tests']");

  if (!subjects.length) {
    if (cardsRoot) cardsRoot.innerHTML = `<div class="empty subject-empty-card">${translateValue("Предметов пока нет. Добавьте первый предмет, чтобы отслеживать прогресс.")}</div>`;
    if (titleRoot) titleRoot.textContent = translateValue("Нет предметов");
    if (testsRoot) testsRoot.innerHTML = `<div class="empty">${translateValue("Добавьте предмет, чтобы появились материалы, тесты и прогресс.")}</div>`;
    if (allTestsButton) allTestsButton.classList.add("hidden");
    const subjectActions = document.getElementById("subjectActions");
    if (subjectActions) subjectActions.innerHTML = "";
    return;
  }

  if (allTestsButton) allTestsButton.classList.remove("hidden");

  cardsRoot.innerHTML = subjects.map((subject, index) => {
    const color = normalizeSubjectColor(subject, index);
    const progressValue = subjectProgress(subject);
    const kind = subjectKind(subject);
    const taskCount = state.tasks.filter((task) => task.subjectId === subject.id || task.subject?.id === subject.id).length;
    const note = taskCount ? translateValue(`${taskCount} ${taskCount === 1 ? "задача" : "задач"}`) : translateValue("Нет данных");
    return `
      <button class="subject-card ${subject.id === state.selectedSubjectId ? "active" : ""}" data-subject-id="${escapeHtml(subject.id)}" style="--subject-color:${color}" type="button">
        <span class="subject-icon">${icon(subjectIcons[kind] || "i-book")}</span>
        <span>
          <h3>${escapeHtml(subject.name)}</h3>
          <span class="subject-percent">${progressValue}%</span>
          <span class="progress-track"><span class="progress-fill" style="width:${progressValue}%;background:${color}"></span></span>
          <span class="subject-note">${escapeHtml(note)}</span>
        </span>
        ${icon("i-chevron")}
      </button>
    `;
  }).join("");

  const subjectActions = document.getElementById("subjectActions");
  if (subjectActions) {
    const canManage = selected && !isDemoId(selected.id);
    subjectActions.innerHTML = canManage ? `
      <button class="ghost-button subject-action-button" data-action="subject-edit" data-subject-id="${escapeHtml(selected.id)}" type="button">${icon("i-pen")}${translateValue("Изменить")}</button>
      <button class="ghost-button danger-button subject-action-button" data-action="subject-delete" data-subject-id="${escapeHtml(selected.id)}" type="button">${icon("i-x")}${translateValue("Удалить")}</button>
    ` : "";
  }

  if (!selected) return;
  const selectedKind = subjectKind(selected);
  document.getElementById("activeSubjectTitle").textContent = selected.name;
  renderSubjectTabContent(selected, [], selectedKind);
}

function calendarEvents() {
  const taskEvents = getBaseTasks().map(withSubject).filter((task) => task.dueDate).map((task) => ({
    id: task.id,
    date: task.dueDate,
    title: task.title,
    subject: task.subject,
    kind: "task",
    color: task.subject?.color || "#4f8cff",
  }));

  const sessionEvents = getBaseSessions().map((session) => {
    const subject = getSubject(session.subjectId) || session.subject;
    return {
      id: session.id,
      date: session.startedAt || session.createdAt,
      title: "Фокус-сессия",
      subject,
      kind: "session",
      color: subject?.color || "#ff9d43",
    };
  });

  return [...taskEvents, ...sessionEvents].filter((event) => event.date);
}

function renderCalendar() {
  const cursor = state.calendarCursor;
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthStartOffset = (first.getDay() + 6) % 7;
  const start = addDays(first, -monthStartOffset);
  const events = calendarEvents();
  const today = new Date();
  if (!state.selectedDay) state.selectedDay = dayKey(today);

  document.getElementById("calendarMonthTitle").textContent = first.toLocaleDateString(currentLocale(), { month: "long", year: "numeric" }).replace(/^./, (char) => char.toUpperCase());
  document.querySelectorAll("[data-calendar-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.calendarMode === state.calendarMode);
  });

  if (state.calendarMode === "day") {
    const selectedDate = new Date(`${state.selectedDay}T12:00:00`);
    const dayEvents = events.filter((event) => dayKey(event.date) === state.selectedDay);
    const source = dayEvents;
    document.getElementById("calendarGrid").innerHTML = `
      <div class="calendar-day-view">
        <h3>${selectedDate.toLocaleDateString(currentLocale(), { weekday: "long", day: "numeric", month: "long" })}</h3>
        <div class="calendar-mode-list">
          ${source.length ? source.map((event, index) => {
            const subject = event.subject || getSubjects()[index % getSubjects().length];
            return `
              <button class="calendar-mode-item" data-action="event-ai" data-prompt="${escapeHtml(currentLanguage() === "en" ? `Help me prepare for this event: ${translateValue(event.title)}` : `Помоги подготовиться к событию: ${event.title}`)}" type="button">
                <span class="event-dot" style="background:${event.color || subject?.color || "#4f8cff"}"></span>
                <strong>${formatTime(event.date)}</strong>
                <span>${escapeHtml(subject?.name || translateValue("Учеба"))} - ${escapeHtml(translateValue(event.title))}</span>
              </button>
            `;
          }).join("") : `<div class="empty">${translateValue("На этот день событий нет.")}</div>`}
        </div>
      </div>
    `;
    renderSelectedDay();
    renderRecommendations();
    renderWeekPlan();
    return;
  }

  if (state.calendarMode === "week") {
    const selectedDate = new Date(`${state.selectedDay}T12:00:00`);
    const weekStart = addDays(selectedDate, -((selectedDate.getDay() + 6) % 7));
    document.getElementById("calendarGrid").innerHTML = `
      <div class="calendar-week-view">
        ${Array.from({ length: 7 }, (_, index) => {
          const date = addDays(weekStart, index);
          const key = dayKey(date);
          const dayEvents = events.filter((event) => dayKey(event.date) === key).slice(0, 4);
          return `
            <button class="week-column ${state.selectedDay === key ? "active" : ""}" data-date="${key}" type="button">
              <strong>${date.toLocaleDateString(currentLocale(), { weekday: "short" })}</strong>
              <span>${date.getDate()}</span>
              <div>
                ${dayEvents.length ? dayEvents.map((event) => `<small style="border-left-color:${event.color}">${escapeHtml(event.subject?.name || translateValue(event.title))}</small>`).join("") : `<small>${translateValue("пусто")}</small>`}
              </div>
            </button>
          `;
        }).join("")}
      </div>
    `;
    renderSelectedDay();
    renderRecommendations();
    renderWeekPlan();
    return;
  }

  const weekdayLabels = currentLanguage() === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const cells = [];
  weekdayLabels.forEach((label) => cells.push(`<div class="weekday">${label}</div>`));

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(start, index);
    const key = dayKey(date);
    const dayEvents = events.filter((event) => dayKey(event.date) === key).slice(0, 2);
    cells.push(`
      <button class="calendar-cell ${date.getMonth() !== cursor.getMonth() ? "muted" : ""} ${isSameDay(date, today) ? "today" : ""} ${state.selectedDay === key ? "active" : ""}" data-date="${key}" type="button">
        <span class="calendar-day-num">${date.getDate()}</span>
        <span class="calendar-events">
          ${dayEvents.map((event) => `
            <span class="calendar-event"><span class="event-dot" style="background:${event.color}"></span>${escapeHtml(event.subject?.name || translateValue(event.title))}</span>
          `).join("")}
        </span>
      </button>
    `);
  }

  document.getElementById("calendarGrid").innerHTML = cells.join("");
  renderSelectedDay();
  renderRecommendations();
  renderWeekPlan();
}

function renderSelectedDay() {
  const selectedDate = new Date(`${state.selectedDay}T12:00:00`);
  const events = calendarEvents()
    .filter((event) => dayKey(event.date) === state.selectedDay)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const source = events;

  document.getElementById("selectedDayLabel").textContent = selectedDate.toLocaleDateString(currentLocale(), { day: "numeric", month: "long", weekday: "long" });
  const daySchedule = document.getElementById("daySchedule");
  daySchedule.innerHTML = source.length ? source.slice(0, 5).map((event, index) => {
    const end = new Date(new Date(event.date).getTime() + 90 * 60_000);
    const subject = event.subject || getSubjects()[index % Math.max(getSubjects().length, 1)];
    const color = subject?.color || event.color || "#4f8cff";
    return `
      <div class="day-item" style="border-left-color:${color}">
        <div class="day-time">${formatTime(event.date)} - ${formatTime(end)}</div>
        <span class="subject-icon" style="--subject-color:${color}">${icon(subjectIcons[subjectKind(subject)] || "i-calendar")}</span>
        <div><strong>${escapeHtml(subject?.name || translateValue(event.title))}</strong><span>${escapeHtml(translateValue(event.title))}</span></div>
      </div>
    `;
  }).join("") : `<div class="empty">${translateValue("На этот день событий нет.")}</div>`;
}

function renderScheduleSwitcher() {
  const isWeek = state.calendarSideView === "week";
  const title = document.getElementById("schedulePanelTitle");
  const dayView = document.getElementById("dayScheduleView");
  const weekView = document.getElementById("weekPlanView");
  const label = document.getElementById("selectedDayLabel");
  if (!title || !dayView || !weekView) return;

  title.textContent = translateValue(isWeek ? "План недели" : "Расписание дня");
  dayView.classList.toggle("hidden", isWeek);
  weekView.classList.toggle("hidden", !isWeek);
  label?.classList.toggle("muted", isWeek);
  document.querySelectorAll(".schedule-switcher-controls button").forEach((button) => {
    const pointsToWeek = button.dataset.action === "schedule-next";
    button.classList.toggle("active", pointsToWeek === isWeek);
  });
}

function renderRecommendations() {
  const root = document.getElementById("calendarRecommendations");
  if (!root) return;
  if (!calendarEvents().length) {
    root.innerHTML = `<div class="empty">${translateValue("Календарь пуст. Добавьте задачу с датой, чтобы она появилась в расписании.")}</div>`;
    return;
  }
  const cards = [
    ["Сбалансируй нагрузку", "Во второй половине недели добавь короткую фокус-сессию для восстановления.", "i-target", "blue"],
    ["Подготовься к дедлайнам", "У тебя есть задачи на ближайшие дни. Начни подготовку заранее.", "i-chart", "purple"],
    ["Оптимальное время", "Твой пик продуктивности: 10:00 - 13:00. Планируй сложные блоки туда.", "i-brain", "green"],
  ];
  root.innerHTML = cards.map(([title, text, iconId, tone]) => `
    <div class="rec-card">
      <span class="plan-icon ${tone}">${icon(iconId)}</span>
      <div><h3>${escapeHtml(translateValue(title))}</h3><p>${escapeHtml(translateValue(text))}</p></div>
    </div>
  `).join("");
}

function renderWeekPlan() {
  const selected = state.selectedDay ? new Date(`${state.selectedDay}T12:00:00`) : new Date();
  const weekStart = addDays(selected, -((selected.getDay() + 6) % 7));
  const tasks = getBaseTasks()
    .map(withSubject)
    .filter((task) => task.dueDate)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  document.getElementById("weekPlan").innerHTML = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const key = dayKey(date);
    const dayTasks = tasks.filter((task) => dayKey(task.dueDate) === key);
    const activeCount = dayTasks.filter((task) => task.status !== "done").length;
    const doneCount = dayTasks.length - activeCount;
    const label = date.toLocaleDateString(currentLocale(), { weekday: "short" }).replace(".", "");
    return `
      <div class="week-day ${isSameDay(date, new Date()) ? "today" : ""}">
        <div class="week-day-head">
          <span>${escapeHtml(label)}</span>
          <strong>${date.getDate()}</strong>
        </div>
        <div class="week-day-body">
          ${dayTasks.length ? `
            <span class="week-count">${translateValue(`${activeCount} активн.${doneCount ? ` · ${doneCount} готово` : ""}`)}</span>
            ${dayTasks.slice(0, 2).map((task) => `
              <button class="week-task" data-action="plan-item" data-id="${escapeHtml(task.id)}" type="button">
                <span style="background:${task.subject?.color || "#4f8cff"}"></span>
                ${escapeHtml(task.title)}
              </button>
            `).join("")}
            ${dayTasks.length > 2 ? `<span class="week-more">${translateValue(`+ ещё ${dayTasks.length - 2}`)}</span>` : ""}
          ` : `<span class="week-empty">${translateValue("Нет задач")}</span>`}
        </div>
      </div>
    `;
  }).join("");
  renderScheduleSwitcher();
}

function renderAi() {
  const context = [
    ["Предметы", getSubjects().length, "i-target", "green"],
    ["Задач сегодня", getBaseTasks().filter((task) => task.dueDate && isSameDay(task.dueDate, new Date())).length, "i-calendar", "blue"],
    ["Фокус", `${state.focus?.risk ? Math.max(0, 100 - Number(state.focus.risk || 0)) : 85}%`, "i-flask", "purple"],
    ["ИИ", state.aiStatus?.configured ? "Live" : "Fallback", "i-brain", state.aiStatus?.configured ? "green" : "blue"],
  ];

  context[3][1] = state.aiStatus?.configured ? "Live" : "Setup";
  context[3][3] = state.aiStatus?.configured ? "green" : "amber";

  document.getElementById("aiContext").innerHTML = context.map(([label, value, iconId, tone]) => `
    <div class="context-row">
      <span class="context-icon ${tone}">${icon(iconId)}</span>
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");

  const box = document.getElementById("aiMessages");
  if (!box || box.children.length) return;
  return;
  addAiMessage("Помоги составить план на сегодня по математике и физике", "user", { track: false });
  addAiMessage("Конечно! Вот оптимальный план на сегодня:\n10:00 - 11:30 Математика - уравнения и неравенства\n11:45 - 13:15 Физика - механика, законы Ньютона\n14:30 - 15:30 Практика - задачи по математике\n16:00 - 17:00 Физика - задачи на движение\n\nХочешь, добавлю задачи и материалы к каждому блоку?", "bot", { track: false });
  addAiMessage("Да, добавь, пожалуйста", "user", { track: false });
  addAiMessage("Готово! Я добавил задачи и полезные материалы к каждому блоку плана.", "bot", { track: false });
}

function addAiMessage(text, role = "bot", options = {}) {
  const box = document.getElementById("aiMessages");
  if (!box) return null;
  const normalized = role === "user" ? "user" : "bot";
  const attachments = Array.isArray(options.attachments) ? options.attachments : [];
  if (options.track !== false) {
    const attachmentNote = attachmentSummary(attachments);
    state.aiConversation.push({
      role: normalized === "user" ? "user" : "assistant",
      content: attachmentNote ? `${String(text || "")}\n\nПрикреплено: ${attachmentNote}` : String(text || ""),
    });
  }
  const div = document.createElement("div");
  div.className = `msg ${normalized}${options.thinking ? " thinking" : ""}`;
  if (options.thinking) {
    div.setAttribute("aria-live", "polite");
    div.innerHTML = `
      <span class="ai-thinking-loader" aria-hidden="true">
        <span class="ai-thinking-mark">AI</span>
        <span class="ai-thinking-dots">
          <span></span><span></span><span></span>
        </span>
      </span>
      <span class="ai-thinking-text">${escapeHtml(translateValue(text))}</span>
    `;
  } else {
    const messageHtml = normalized === "bot" ? formatAiText(text) : escapeHtml(text).replaceAll("\n", "<br>");
    const attachmentHtml = attachments.length ? `
      <span class="msg-attachments">
        ${attachments.map((file) => `
          <span class="msg-attachment ${file.kind === "image" && file.dataUrl ? "image" : ""}">
            ${renderAttachmentPreview(file, "msg-attachment-preview")}
            <span>${escapeHtml(file.name)}</span>
          </span>
        `).join("")}
      </span>
    ` : "";
    div.innerHTML = `${messageHtml}${attachmentHtml}`;
  }
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function setAiBusy(value) {
  state.aiBusy = value;
  const submit = document.getElementById("aiSubmitBtn");
  const prompt = document.getElementById("aiPrompt");
  const attach = document.querySelector(".attach-button");
  const fileInput = document.getElementById("aiFileInput");
  if (submit) submit.disabled = value;
  if (prompt) prompt.disabled = value;
  if (attach) attach.disabled = value;
  if (fileInput) fileInput.disabled = value;
  document.querySelectorAll(".ai-quick").forEach((button) => {
    button.disabled = value;
  });
}

function addAiActionMessage(result, prompt) {
  const box = document.getElementById("aiMessages");
  if (!box) return;
  const drafts = Array.isArray(result?.actions?.taskDrafts) ? result.actions.taskDrafts : [];
  const text = `${prompt}\n${result?.response || ""}`.toLowerCase();
  if (!drafts.length && !/план|распис|задач|дедлайн|подготов|plan|task|schedule|deadline|prepare/.test(text)) return;
  state.aiPendingTaskDrafts = drafts;

  const div = document.createElement("div");
  div.className = "msg bot ai-action-card";
  div.innerHTML = `
    <strong>Могу сразу превратить это в задачи.</strong>
    <span>${drafts.length ? `Подготовлено задач: ${drafts.length}. Добавлю их и обновлю дашборд.` : "Добавлю учебные блоки на сегодня и обновлю дашборд."}</span>
    <div class="ai-action-row">
      <button class="primary-button" data-action="create-ai-plan-tasks" type="button">Добавить задачи</button>
      <button class="ghost-button nav-jump" data-route="tasks" type="button">Открыть задачи</button>
      <button class="ghost-button nav-jump" data-route="calendar" type="button">Открыть календарь</button>
    </div>
  `;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  applyLanguage();
}

async function createAiPlanTasks(drafts = state.aiPendingTaskDrafts) {
  if (Array.isArray(drafts) && drafts.length) {
    const existingTitles = new Set(state.tasks.map((task) => String(task.title || "").toLowerCase()));
    const toCreate = drafts.filter((item) => item?.title && !existingTitles.has(String(item.title).toLowerCase()));
    if (!toCreate.length) {
      toast("ИИ-задачи уже добавлены");
      return;
    }
    await Promise.all(toCreate.map((item) => api("/api/tasks", {
      method: "POST",
      body: {
        title: item.title,
        subjectId: item.subjectId || null,
        dueDate: item.dueDate || null,
        priority: item.priority || "medium",
        estimatedMins: Number(item.estimatedMins || 45),
        focusScore: Number(item.focusScore || 80),
        description: item.description || "Создано ИИ-помощником из текущего учебного контекста.",
      },
    })));
    state.aiPendingTaskDrafts = [];
    toast("ИИ-задачи добавлены");
    await refresh();
    return;
  }

  const realSubjects = getRealSubjects();
  const subjects = realSubjects.length ? realSubjects : [];
  const subjectByKind = (kind) => subjects.find((subject) => subjectKind(subject) === kind) || null;
  const baseDate = new Date();
  const planned = [
    { title: "ИИ-план: глубокая работа по математике", kind: "math", hour: 10, minute: 0, estimatedMins: 90, priority: "high" },
    { title: "ИИ-план: практика по физике", kind: "physics", hour: 12, minute: 0, estimatedMins: 75, priority: "medium" },
    { title: "ИИ-план: повторение английского", kind: "english", hour: 15, minute: 0, estimatedMins: 45, priority: "medium" },
  ];

  const existingTitles = new Set(state.tasks.map((task) => task.title));
  const toCreate = planned.filter((item) => !existingTitles.has(item.title));
  if (!toCreate.length) {
    toast("ИИ-задачи уже добавлены");
    return;
  }

  await Promise.all(toCreate.map((item) => {
    const subject = subjectByKind(item.kind);
    return api("/api/tasks", {
      method: "POST",
      body: {
        title: item.title,
        subjectId: subject?.id || null,
        dueDate: dateWithTime(baseDate, item.hour, item.minute),
        priority: item.priority,
        estimatedMins: item.estimatedMins,
        focusScore: 80,
        description: "Создано ИИ-помощником из учебного плана.",
      },
    });
  }));
  toast("ИИ-задачи добавлены");
  await refresh();
}

async function requestAiReply(prompt) {
  const typedText = String(prompt || "").trim();
  const attachments = state.aiAttachments.map((file) => ({ ...file }));
  const text = typedText || (attachments.length ? translateValue("Проанализируй прикрепленные файлы") : "");
  if (!text || state.aiBusy) return;
  const history = state.aiConversation.slice(-8);
  addAiMessage(text, "user", { attachments });
  const input = document.getElementById("aiPrompt");
  if (input) input.value = "";
  clearAiAttachments();
  setAiBusy(true);
  const thinking = addAiMessage("ИИ анализирует запрос и учебный контекст", "bot", { track: false, thinking: true });

  try {
    const result = await api("/api/ai-plan", { method: "POST", body: { prompt: text, history, attachments, language: currentLanguage() } });
    thinking?.remove();
    addAiMessage(result.response || "Готово, я собрал ответ по твоему запросу.", "bot");
    if (result.actions?.autoCreateTasks && Array.isArray(result.actions?.taskDrafts) && result.actions.taskDrafts.length) {
      await createAiPlanTasks(result.actions.taskDrafts);
      addAiMessage("Готово, я добавил задачи и обновил список.", "bot", { track: false });
    } else {
      addAiActionMessage(result, text);
    }
    if (result.aiMode === "unconfigured") toast("Добавь OPENAI_API_KEY");
    if (result.aiMode === "error") toast("AI API недоступен");
    if (result.aiMode === "live") toast("Live AI ответил");
  } catch (error) {
    thinking?.remove();
    addAiMessage("Запрос к AI API не прошёл. Проверь сервер, OPENAI_API_KEY и настройки модели, затем попробуй снова.", "bot");
    toast(error.message || "AI API недоступен");
    return;
    addAiMessage("Я могу помочь с этим так: выбери 1-2 главные задачи, поставь их в первый учебный блок, а повторение оставь на конец дня. Если тема сложная, разбей ее на объяснение, пример и короткий тест.", "bot");
    toast(error.message || "ИИ сейчас недоступен");
  } finally {
    setAiBusy(false);
  }
}

function fillSubjectSelects() {
  const options = `<option value="">Без предмета</option>` + getSubjects().map((subject) => `<option value="${escapeHtml(subject.id)}">${escapeHtml(subject.name)}</option>`).join("");
  document.querySelectorAll("#taskSubjectSelect").forEach((select) => {
    const current = select.value;
    select.innerHTML = options;
    if (current) select.value = current;
  });
}

function renderUser() {
  const email = getProfileEmail();
  const name = getProfileName();
  document.getElementById("userEmail").textContent = email === "Студент" ? getProfileRole() : email;
  document.getElementById("userName").textContent = name.length > 14 ? `${name.slice(0, 12)}...` : name;
  const greeting = document.getElementById("assistantGreetingName");
  if (greeting) greeting.textContent = `${translateValue("Привет")}, ${name}! 👋`;
  renderAvatars();
}

function getNotificationItems() {
  const now = new Date();
  const activeTasks = getBaseTasks()
    .map(withSubject)
    .filter((task) => task.status !== "done");
  const overdue = activeTasks.filter((task) => task.dueDate && new Date(task.dueDate) < now);
  const today = activeTasks.filter((task) => task.dueDate && isSameDay(task.dueDate, now));
  const highPriority = activeTasks.filter((task) => task.priority === "high");
  const items = [];

  if (overdue.length) {
    items.push({
      tone: "red",
      iconId: "i-bell",
      title: `${overdue.length} просроченных задач`,
      text: "Разбери их первыми, чтобы план снова стал чистым.",
      action: "notification-overdue",
    });
  }
  if (today.length) {
    const nextTask = today
      .slice()
      .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0))[0];
    items.push({
      tone: "blue",
      iconId: "i-calendar",
      title: `${today.length} задач на сегодня`,
      text: nextTask ? `Ближайшая: ${nextTask.title} в ${formatTime(nextTask.dueDate)}.` : "Открой календарь и проверь учебные блоки.",
      action: "notification-today",
    });
  }
  if (!overdue.length && highPriority.length) {
    items.push({
      tone: "amber",
      iconId: "i-target",
      title: "Есть высокий приоритет",
      text: `${highPriority[0].title} лучше поставить первым учебным блоком.`,
      action: "notification-focus",
    });
  }
  items.push({
    tone: state.aiStatus?.configured ? "green" : "blue",
    iconId: "i-spark",
    title: state.aiStatus?.configured ? "AI-помощник подключен" : "AI-помощник в режиме настройки",
    text: state.aiStatus?.configured ? "Можно просить планы, объяснения и разбор задач." : "Добавь API-ключ, чтобы ответы генерировались моделью.",
    action: "notification-ai",
  });

  return items;
}

function renderNotifications() {
  const panel = document.getElementById("notificationPanel");
  const button = document.querySelector("[data-action='notifications']");
  if (!panel || !button) return;

  const items = getNotificationItems();
  const hasTaskAlerts = items.some((item) => ["notification-overdue", "notification-today", "notification-focus"].includes(item.action));
  button.classList.toggle("has-notifications", hasTaskAlerts);
  button.setAttribute("aria-expanded", String(state.notificationsOpen));
  panel.innerHTML = `
    <div class="notification-head">
      <strong>Уведомления</strong>
      <button class="link-button" data-action="notification-close" type="button">Закрыть</button>
    </div>
    <div class="notification-list">
      ${items.map((item) => `
        <button class="notification-item" data-action="${item.action}" type="button">
          <span class="plan-icon ${item.tone}">${icon(item.iconId)}</span>
          <span>
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.text)}</small>
          </span>
        </button>
      `).join("")}
    </div>
  `;
}

function setNotificationsOpen(open) {
  state.notificationsOpen = Boolean(open);
  const panel = document.getElementById("notificationPanel");
  const button = document.querySelector("[data-action='notifications']");
  if (panel) panel.classList.toggle("hidden", !state.notificationsOpen);
  if (button) button.setAttribute("aria-expanded", String(state.notificationsOpen));
}

function renderAll() {
  fillSubjectSelects();
  renderUser();
  renderNotifications();
  renderDashboard();
  renderTasks();
  renderSubjects();
  renderCalendar();
  renderAi();
  renderProfile();
  window.StudyExams?.refresh();
  applyLanguage();
}

async function loadAll() {
  const endpoints = [
    api("/api/auth/me"),
    api("/api/subjects"),
    api("/api/tasks"),
    api("/api/goals"),
    api("/api/sessions"),
    api("/api/dashboard"),
    api("/api/focus-mode"),
    api("/api/analytics"),
    api("/api/ai-history"),
    api("/api/ai-status"),
    api("/api/profile"),
  ];

  const results = await Promise.allSettled(endpoints);
  const value = (index, fallback) => results[index].status === "fulfilled" ? results[index].value : fallback;
  const authError = results[0].status === "rejected" ? results[0].reason : null;
  if (authError && getToken()) throw authError;

  state.me = value(0, {}).user || state.me;
  state.subjects = Array.isArray(value(1, [])) ? value(1, []) : [];
  state.tasks = Array.isArray(value(2, [])) ? value(2, []) : [];
  state.goals = Array.isArray(value(3, [])) ? value(3, []) : [];
  state.sessions = Array.isArray(value(4, [])) ? value(4, []) : [];
  state.dashboard = value(5, null);
  state.focus = value(6, null);
  state.analytics = value(7, null);
  state.aiHistory = Array.isArray(value(8, [])) ? value(8, []) : [];
  state.aiStatus = value(9, null);
  state.profile = value(10, null);
  await migrateLocalProfile();
  renderAll();
}

// Profiles used to live only in this browser. The first time an account loads
// an empty server profile, push whatever is stored locally so nothing is lost.
async function migrateLocalProfile() {
  if (!state.profile || state.profile.displayName || state.profile.role || state.profile.avatar) return;
  const local = {
    displayName: localStorage.getItem("studyProfileName") || "",
    role: localStorage.getItem("studyProfileRole") || "",
    avatar: localStorage.getItem("studyProfileAvatar") || "",
  };
  if (!local.displayName && !local.role && !local.avatar) return;
  try {
    state.profile = await api("/api/profile", { method: "PUT", body: local });
  } catch { /* keep using the local copy until the next load */ }
}

async function refresh() {
  await loadAll();
}

function routePaths() {
  return {
    dashboard: "/dashboard",
    tasks: "/tasks",
    subjects: "/subjects",
    exams: "/exams",
    calendar: "/calendar",
    ai: "/ai",
    profile: "/profile",
  };
}

function getRouteFromPath() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (path === "/" || path === "/index.html") return "dashboard";
  const legacyMap = { "/goals": "calendar", "/insights": "calendar", "/materials": "subjects" };
  if (legacyMap[path]) return legacyMap[path];
  return Object.entries(routePaths()).find(([, routePath]) => routePath === path)?.[0] || "dashboard";
}

function setActiveRoute(route, options = {}) {
  const routes = routePaths();
  const nextRoute = routes[route] ? route : "dashboard";
  document.querySelectorAll(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.route === nextRoute));
  document.querySelectorAll(".route").forEach((section) => section.classList.add("hidden"));
  document.getElementById(`route-${nextRoute}`)?.classList.remove("hidden");
  if (nextRoute === "profile") renderProfile();
  if (nextRoute === "exams") {
    // Explicit nav click opens the catalog; Back/forward and deep links keep the #exam hash
    if (options.push !== false && window.location.hash) {
      window.history.replaceState({ route: "exams" }, "", "/exams");
    }
    window.StudyExams?.onEnter();
  }
  if (options.push !== false && window.location.pathname !== routes[nextRoute]) {
    window.history.pushState({ route: nextRoute }, "", routes[nextRoute]);
  }
  setSidebarOpen(false);
}

function setSidebarOpen(open) {
  const compact = window.matchMedia("(max-width: 1120px)").matches;
  const active = compact && open;
  document.body.classList.toggle("menu-open", active);
  document.getElementById("sidebar")?.setAttribute("aria-hidden", compact ? String(!active) : "false");
  document.getElementById("sidebarToggleBtn")?.setAttribute("aria-expanded", String(active));
  document.getElementById("sidebarBackdrop")?.setAttribute("aria-hidden", String(!active));
}

function setTheme(theme) {
  const isLight = theme === "light";
  document.documentElement.classList.toggle("light-theme", isLight);
  localStorage.setItem("studyTheme", isLight ? "light" : "dark");
  document.querySelectorAll(".theme-label").forEach((label) => {
    label.textContent = isLight ? "Светлая" : "Тёмная";
  });
  const profileThemeLabel = document.getElementById("profileThemeLabel");
  if (profileThemeLabel) profileThemeLabel.textContent = isLight ? "Светлая тема" : "Темная тема";
  applyLanguage();
}

function toggleModal(id, open) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.toggle("hidden", !open);
  modal.setAttribute("aria-hidden", String(!open));
  // Translate any dynamically-set modal text (titles, buttons) into the active language.
  if (open) applyLanguage();
}

function closeConfirmModal(result = false) {
  toggleModal("confirmModal", false);
  if (state.confirmResolve) {
    state.confirmResolve(result);
    state.confirmResolve = null;
  }
}

function confirmAction({ title = "Подтвердить действие", text = "Вы уверены?", okText = "Удалить" } = {}) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmText").textContent = text;
  document.getElementById("confirmOkBtn").textContent = okText;
  toggleModal("confirmModal", true);
  document.getElementById("confirmCancelBtn")?.focus();
  return new Promise((resolve) => {
    state.confirmResolve = resolve;
  });
}

async function handleLogout() {
  try { await api("/api/auth/logout", { method: "POST" }); } catch {}
  localStorage.removeItem("authToken");
  sessionStorage.removeItem("authToken");
  window.location.href = "/login";
}

function bindEvents() {
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.addEventListener("click", () => setActiveRoute(button.dataset.route));
  });
  window.addEventListener("popstate", () => setActiveRoute(getRouteFromPath(), { push: false }));

  document.getElementById("sidebarToggleBtn")?.addEventListener("click", () => setSidebarOpen(!document.body.classList.contains("menu-open")));
  document.getElementById("sidebarCloseBtn")?.addEventListener("click", () => setSidebarOpen(false));
  document.getElementById("sidebarBackdrop")?.addEventListener("click", () => setSidebarOpen(false));
  window.addEventListener("resize", () => setSidebarOpen(document.body.classList.contains("menu-open")));

  document.getElementById("themeToggleBtn")?.addEventListener("click", () => {
    const next = document.documentElement.classList.contains("light-theme") ? "dark" : "light";
    setTheme(next);
  });
  document.getElementById("languageToggleBtn")?.addEventListener("click", () => {
    setLanguage(currentLanguage() === "en" ? "ru" : "en");
  });

  document.getElementById("globalSearch")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    state.activeSearchIndex = 0;
    renderDashboard();
    renderTasks();
    renderSubjects();
    renderSearchResults();
  });
  document.getElementById("globalSearch")?.addEventListener("focus", () => {
    renderSearchResults();
  });
  document.getElementById("globalSearch")?.addEventListener("keydown", async (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.activeSearchIndex = Math.min(state.searchResults.length - 1, state.activeSearchIndex + 1);
      renderSearchResults();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      state.activeSearchIndex = Math.max(0, state.activeSearchIndex - 1);
      renderSearchResults();
    } else if (event.key === "Enter") {
      event.preventDefault();
      await activateSearchResult();
    } else if (event.key === "Escape") {
      document.getElementById("searchResults")?.classList.add("hidden");
    }
  });

  document.getElementById("prevMonthBtn")?.addEventListener("click", () => {
    state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() - 1, 1);
    renderCalendar();
  });
  document.getElementById("nextMonthBtn")?.addEventListener("click", () => {
    state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() + 1, 1);
    renderCalendar();
  });

  document.querySelectorAll("[data-calendar-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.calendarMode = button.dataset.calendarMode || "month";
      renderCalendar();
    });
  });

  document.querySelectorAll(".task-filter").forEach((button) => {
    button.addEventListener("click", () => {
      state.taskFilter = button.dataset.filter;
      document.querySelectorAll(".task-filter").forEach((filter) => filter.classList.toggle("active", filter === button));
      renderTasks();
    });
  });

  document.getElementById("aiForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await requestAiReply(document.getElementById("aiPrompt")?.value);
  });
  document.getElementById("aiPrompt")?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await requestAiReply(event.currentTarget.value);
    }
  });
  document.querySelector(".attach-button")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (state.aiBusy) return;
    document.getElementById("aiFileInput")?.click();
  });
  document.getElementById("aiFileInput")?.addEventListener("change", async (event) => {
    await addAiFiles(event.currentTarget.files);
    event.currentTarget.value = "";
  });
  document.getElementById("aiPrompt")?.addEventListener("paste", handleAiPaste);
  document.getElementById("route-ai")?.addEventListener("paste", handleAiPaste);
  document.addEventListener("paste", async (event) => {
    const route = document.getElementById("route-ai");
    if (!route || route.classList.contains("hidden")) return;
    if (event.target.closest?.("#aiPrompt, #aiForm, #route-ai")) return;
    await handleAiPaste(event);
  });

  document.getElementById("taskForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const taskId = String(form.get("taskId") || "");
    const payload = {
      title: form.get("title"),
      subjectId: form.get("subjectId") || null,
      dueDate: form.get("dueDate") || null,
      priority: form.get("priority") || "medium",
      estimatedMins: Number(form.get("estimatedMins") || 45),
      focusScore: Number(form.get("focusScore") || 70),
      description: form.get("description") || "",
    };
    try {
      if (taskId) {
        await saveTask(taskId, payload);
      } else {
        await api("/api/tasks", { method: "POST", body: payload });
        await refresh();
      }
      formEl.reset();
      toggleModal("taskModal", false);
      toast(taskId ? "Задача обновлена" : "Задача добавлена");
    } catch (error) {
      toast(error.message || "Не удалось сохранить задачу");
    }
  });

  document.getElementById("subjectForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const subjectId = String(form.get("subjectId") || "");
    const payload = {
      name: form.get("name"),
      color: form.get("color") || "#4f8cff",
      targetMinutes: Number(form.get("targetMinutes") || 240),
      description: form.get("description") || "",
    };
    try {
      if (subjectId) {
        const updated = await api(`/api/subjects/${subjectId}`, { method: "PATCH", body: payload });
        if (updated?.id) state.selectedSubjectId = updated.id;
      } else {
        const created = await api("/api/subjects", { method: "POST", body: payload });
        if (created?.id) state.selectedSubjectId = created.id;
        state.subjectTab = "materials";
      }
      formEl.reset();
      toggleModal("subjectModal", false);
      toast(subjectId ? "Предмет обновлен" : "Предмет добавлен");
      await refresh();
    } catch (error) {
      toast(error.message || (subjectId ? "Не удалось обновить предмет" : "Не удалось добавить предмет"));
    }
  });

  document.getElementById("profileForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") || "").trim() || getDefaultProfileName();
    const role = String(form.get("role") || "Студент").trim() || "Студент";
    if (await saveProfile({ displayName, role })) toast("Профиль обновлен");
  });
  document.getElementById("profileAvatarInput")?.addEventListener("change", (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Выбери файл изображения");
      event.currentTarget.value = "";
      return;
    }
    if (file.size > 1_500_000) {
      toast("Картинка слишком большая, выбери файл до 1.5 МБ");
      event.currentTarget.value = "";
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", async () => {
      if (await saveProfile({ avatar: String(reader.result || "") })) toast("Аватар обновлен");
    });
    reader.readAsDataURL(file);
  });
  document.getElementById("profileAvatarRemoveBtn")?.addEventListener("click", async () => {
    const input = document.getElementById("profileAvatarInput");
    if (input) input.value = "";
    if (await saveProfile({ avatar: "" })) toast("Аватар сброшен");
  });

  document.body.addEventListener("click", async (event) => {
    if (!event.target.closest(".notification-wrap")) {
      setNotificationsOpen(false);
    }

    const jump = event.target.closest(".nav-jump");
    if (jump) {
      setActiveRoute(jump.dataset.route);
      return;
    }

    const searchItem = event.target.closest("[data-search-index]");
    if (searchItem) {
      await activateSearchResult(Number(searchItem.dataset.searchIndex || 0));
      return;
    }

    const subjectTab = event.target.closest("[data-subject-tab]");
    if (subjectTab) {
      state.subjectTab = subjectTab.dataset.subjectTab || "tests";
      renderSubjects();
      return;
    }

    const action = event.target.closest("[data-action]");
    if (action) {
      const actionName = action.dataset.action;
      if (actionName === "pro") {
        toast("Pro-раздел скоро будет доступен");
        return;
      }
      if (actionName === "notifications") {
        renderNotifications();
        applyLanguage();
        setNotificationsOpen(!state.notificationsOpen);
        return;
      }
      if (actionName === "notification-close") {
        setNotificationsOpen(false);
        return;
      }
      if (actionName === "notification-overdue") {
        state.taskFilter = "overdue";
        document.querySelectorAll(".task-filter").forEach((filter) => filter.classList.toggle("active", filter.dataset.filter === "overdue"));
        setNotificationsOpen(false);
        setActiveRoute("tasks");
        renderTasks();
        return;
      }
      if (actionName === "notification-today") {
        state.calendarMode = "day";
        state.selectedDay = dayKey(new Date());
        setNotificationsOpen(false);
        setActiveRoute("calendar");
        renderCalendar();
        return;
      }
      if (actionName === "notification-focus") {
        setNotificationsOpen(false);
        setActiveRoute("ai");
        await requestAiReply("Помоги выбрать первую задачу на сегодня с учетом приоритета и дедлайна");
        return;
      }
      if (actionName === "notification-ai") {
        setNotificationsOpen(false);
        setActiveRoute("ai");
        return;
      }
      if (actionName === "profile-open") {
        document.getElementById("profileMenu")?.classList.add("hidden");
        setActiveRoute("profile");
        renderProfile();
        return;
      }
      if (actionName === "profile-open-tasks") {
        setActiveRoute("tasks");
        renderTasks();
        return;
      }
      if (actionName === "profile-open-ai") {
        setActiveRoute("ai");
        return;
      }
      if (actionName === "profile-create-task") {
        openTaskModal();
        return;
      }
      if (actionName === "profile-open-calendar") {
        state.calendarMode = "month";
        setActiveRoute("calendar");
        renderCalendar();
        return;
      }
      if (actionName === "profile-theme") {
        const next = document.documentElement.classList.contains("light-theme") ? "dark" : "light";
        setTheme(next);
        renderProfile();
        return;
      }
      if (actionName === "profile-review") {
        setActiveRoute("ai");
        await requestAiReply("Сделай краткий обзор моего профиля обучения: прогресс, задачи, фокус и главный следующий шаг");
        return;
      }
      if (actionName === "metric-tasks") {
        state.taskFilter = "all";
        document.querySelectorAll(".task-filter").forEach((filter) => filter.classList.toggle("active", filter.dataset.filter === "all"));
        setActiveRoute("tasks");
        renderTasks();
        return;
      }
      if (actionName === "metric-focus") {
        setActiveRoute("ai");
        await requestAiReply("Оцени мой фокус на сегодня и предложи 3 коротких шага, чтобы учиться без перегруза");
        return;
      }
      if (actionName === "metric-progress") {
        setActiveRoute("subjects");
        renderSubjects();
        return;
      }
      if (actionName === "today-menu") {
        setActiveRoute("ai");
        await requestAiReply("Сделай краткий обзор сегодняшних задач и скажи, с чего начать");
        return;
      }
      if (actionName === "task-menu" || actionName === "all-tasks") {
        state.taskFilter = "all";
        document.querySelectorAll(".task-filter").forEach((filter) => filter.classList.toggle("active", filter.dataset.filter === "all"));
        setActiveRoute("tasks");
        renderTasks();
        return;
      }
      if (actionName === "full-day") {
        state.calendarMode = "day";
        setActiveRoute("calendar");
        renderCalendar();
        return;
      }
      if (actionName === "schedule-prev" || actionName === "schedule-next") {
        state.calendarSideView = actionName === "schedule-next" ? "week" : "day";
        renderScheduleSwitcher();
        return;
      }
      if (actionName === "all-tests") {
        setActiveRoute("exams");
        return;
      }
      if (actionName === "start-test" || actionName === "event-ai") {
        setActiveRoute("ai");
        await requestAiReply(action.dataset.prompt || action.textContent);
        return;
      }
      if (actionName === "create-ai-plan-tasks") {
        try {
          await createAiPlanTasks();
        } catch (error) {
          toast(error.message || "Не удалось добавить ИИ-задачи");
        }
        return;
      }
      if (actionName === "ai-send") {
        await requestAiReply(document.getElementById("aiPrompt")?.value);
        return;
      }
      if (actionName === "ai-remove-attachment") {
        removeAiAttachment(action.dataset.id);
        return;
      }
      if (actionName === "plan-item") {
        const task = getTaskById(action.dataset.id);
        if (task) {
          openTaskModal(task);
        } else {
          state.calendarMode = "day";
          setActiveRoute("calendar");
          renderCalendar();
        }
        return;
      }
      if (actionName === "subject-progress") {
        state.selectedSubjectId = action.dataset.subjectId;
        setActiveRoute("subjects");
        renderSubjects();
        return;
      }
      if (actionName === "task-status") {
        try {
          await saveTask(action.dataset.id, { status: action.dataset.status });
          toast("Статус обновлен");
        } catch (error) {
          toast(error.message || "Не удалось обновить задачу");
        }
        return;
      }
      if (actionName === "subject-edit") {
        const subject = getSubjectById(action.dataset.subjectId || state.selectedSubjectId);
        if (subject && !isDemoId(subject.id)) openSubjectModal(subject);
        return;
      }
      if (actionName === "subject-delete") {
        const subjectId = action.dataset.subjectId || document.getElementById("subjectId")?.value || state.selectedSubjectId;
        const subject = getSubjectById(subjectId);
        if (!subject || isDemoId(subject.id)) {
          toast("Этот предмет нельзя удалить");
          return;
        }
        const confirmed = await confirmAction({
          title: "Удалить предмет?",
          text: `Предмет «${subject.name}» исчезнет из списка. Связанные задачи останутся без предмета.`,
          okText: "Удалить",
        });
        if (!confirmed) return;
        try {
          await removeSubject(subject.id);
          toggleModal("subjectModal", false);
          toast("Предмет удален");
        } catch (error) {
          toast(error.message || "Не удалось удалить предмет");
        }
        return;
      }
      if (actionName === "task-edit") {
        const task = getTaskById(action.dataset.id);
        if (task) openTaskModal(task);
        return;
      }
      if (actionName === "task-delete") {
        const taskId = action.dataset.id || document.getElementById("taskId")?.value;
        const confirmed = await confirmAction({
          title: "Удалить задачу?",
          text: "Задача исчезнет из списка. Это действие нельзя будет отменить.",
          okText: "Удалить",
        });
        if (!confirmed) return;
        try {
          await removeTask(taskId);
          toggleModal("taskModal", false);
          toast("Задача удалена");
        } catch (error) {
          toast(error.message || "Не удалось удалить задачу");
        }
        return;
      }
    }

    if (event.target.closest(".open-task-modal")) {
      openTaskModal();
      return;
    }
    if (event.target.closest(".open-subject-modal")) {
      openSubjectModal();
      return;
    }
    if (event.target.closest(".close-modal")) {
      toggleModal("taskModal", false);
      toggleModal("subjectModal", false);
      return;
    }
    if (event.target.id === "confirmModal") {
      closeConfirmModal(false);
      return;
    }
    if (event.target.id === "taskModal") toggleModal("taskModal", false);
    if (event.target.id === "subjectModal") toggleModal("subjectModal", false);

    const taskRow = event.target.closest(".task-item[data-task-id]");
    if (taskRow && !event.target.closest("button")) {
      const task = getTaskById(taskRow.dataset.taskId);
      if (task) openTaskModal(task);
      return;
    }

    const subjectCard = event.target.closest(".subject-card");
    if (subjectCard) {
      state.selectedSubjectId = subjectCard.dataset.subjectId;
      renderSubjects();
      return;
    }

    const calendarCell = event.target.closest(".calendar-cell");
    if (calendarCell) {
      state.selectedDay = calendarCell.dataset.date;
      renderCalendar();
      return;
    }

    const weekColumn = event.target.closest(".week-column");
    if (weekColumn) {
      state.selectedDay = weekColumn.dataset.date;
      renderCalendar();
      return;
    }

    const quick = event.target.closest(".ai-quick");
    if (quick) {
      const prompt = quick.dataset.prompt || quick.textContent;
      setActiveRoute("ai");
      const input = document.getElementById("aiPrompt");
      if (input) input.value = prompt;
      await requestAiReply(prompt);
    }
  });

  document.getElementById("logoutBtn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    document.getElementById("profileMenu")?.classList.toggle("hidden");
  });
  document.getElementById("logoutMenuBtn")?.addEventListener("click", handleLogout);
  document.getElementById("confirmCancelBtn")?.addEventListener("click", () => closeConfirmModal(false));
  document.getElementById("confirmCloseBtn")?.addEventListener("click", () => closeConfirmModal(false));
  document.getElementById("confirmOkBtn")?.addEventListener("click", () => closeConfirmModal(true));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.getElementById("confirmModal")?.classList.contains("hidden")) {
      closeConfirmModal(false);
    }
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".profile-chip") && !event.target.closest(".profile-menu")) {
      document.getElementById("profileMenu")?.classList.add("hidden");
    }
    if (!event.target.closest(".search-box") && !event.target.closest("#searchResults")) {
      document.getElementById("searchResults")?.classList.add("hidden");
    }
  });
}

async function init() {
  localStorage.removeItem("aiStudyDemoTasks");
  state.demoTasks = [];
  setTheme(localStorage.getItem("studyTheme") === "light" ? "light" : "dark");
  bindEvents();
  if (window.location.pathname === "/index.html") {
    window.history.replaceState({ route: "dashboard" }, "", "/dashboard");
  }
  setActiveRoute(getRouteFromPath(), { push: false });

  try {
    await loadAll();
  } catch (error) {
    console.error(error);
    if (/not authorized|invalid token|unauthorized/i.test(String(error.message))) {
      localStorage.removeItem("authToken");
      sessionStorage.removeItem("authToken");
      window.location.href = "/login";
      return;
    }
    renderAll();
    toast("Данные API недоступны, показан демо-режим");
  }
}

document.addEventListener("DOMContentLoaded", init);
