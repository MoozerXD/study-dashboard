import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

function normalizeAppUrl(value, fallback) {
  const text = String(value || "").trim();
  if (!text) return fallback;

  const withoutTrailingSlash = text.replace(/\/$/, "");
  if (/^https?:\/\//i.test(withoutTrailingSlash)) return withoutTrailingSlash;
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(?:\/.*)?$/i.test(withoutTrailingSlash)) {
    return `http://${withoutTrailingSlash}`.replace(/\/$/, "");
  }

  return `https://${withoutTrailingSlash}`.replace(/\/$/, "");
}

const PORT = Number(process.env.PORT || 3000);
const HOST = String(process.env.HOST || "0.0.0.0").trim();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";
const AI_PROVIDER = String(process.env.AI_PROVIDER || "auto").trim().toLowerCase();
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || "gpt-5-mini").trim();
const OPENAI_REASONING_EFFORT = String(process.env.OPENAI_REASONING_EFFORT || "low").trim().toLowerCase();
const OPENROUTER_API_KEY = String(process.env.OPENROUTER_API_KEY || "").trim();
const OPENROUTER_MODEL = String(process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini").trim();
const OPENROUTER_FALLBACK_MODELS = String(process.env.OPENROUTER_FALLBACK_MODELS || "openai/gpt-4.1-nano").split(",").map((x) => x.trim()).filter(Boolean);
const GEMINI_API_KEY = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
const GEMINI_MODEL = String(process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();
const GEMINI_FALLBACK_MODELS = String(process.env.GEMINI_FALLBACK_MODELS || "").split(",").map((x) => x.trim()).filter(Boolean);
const AI_MAX_OUTPUT_TOKENS = Math.min(4096, Math.max(900, Number(process.env.AI_MAX_OUTPUT_TOKENS || 2200)));
const AI_ATTACHMENT_LIMIT = 5;
const AI_ATTACHMENT_TEXT_LIMIT = 18000;
const AI_ATTACHMENT_DATA_LIMIT = 8 * 1024 * 1024;
const DATABASE_URL = String(process.env.DATABASE_URL || "file:./prisma/dev.db").trim();
const DEFAULT_APP_URL = `http://localhost:${PORT}`;
const APP_URL = normalizeAppUrl(process.env.APP_URL, DEFAULT_APP_URL);
const HAS_EXPLICIT_APP_URL = Boolean(String(process.env.APP_URL || "").trim());
const APP_NAME = String(process.env.APP_NAME || "Study Dashboard MVP").trim();
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const RESEND_API_BASE_URL = String(process.env.RESEND_API_BASE_URL || "https://api.resend.com").trim().replace(/\/$/, "");
const RESEND_FROM = String(process.env.RESEND_FROM || "").trim();
const RESEND_REPLY_TO = String(process.env.RESEND_REPLY_TO || "").trim();
const SMTP_HOST = String(process.env.SMTP_HOST || "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || (SMTP_PORT === 465 ? "true" : "false")).trim().toLowerCase() === "true";
const SMTP_USER = String(process.env.SMTP_USER || "").trim();
const SMTP_PASS = String(process.env.SMTP_PASS || "").replace(/\s+/g, "").trim();
const SMTP_FROM = String(process.env.SMTP_FROM || SMTP_USER || "").trim();
const dataFile = path.join(__dirname, "data.json");
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: DATABASE_URL,
  }),
});

let mailTransport = null;

function createEmptyStore() {
  return {
    users: [],
    emailCodes: [],
    resetTokens: [],
    subjects: [],
    goals: [],
    tasks: [],
    materials: [],
    studySessions: [],
    aiRequests: [],
    examAttempts: [],
  };
}

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify(createEmptyStore(), null, 2));
}

function loadStore() {
  try {
    const raw = fs.readFileSync(dataFile, "utf8");
    return { ...createEmptyStore(), ...JSON.parse(raw || "{}") };
  } catch {
    return createEmptyStore();
  }
}

function saveStore(store) {
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
}

function isEmailDeliveryConfigured() {
  return getEmailDeliveryMode() !== "dev";
}

function isResendConfigured() {
  return Boolean(RESEND_API_KEY);
}

function isSmtpConfigured() {
  return Boolean(SMTP_HOST && Number.isFinite(SMTP_PORT) && SMTP_FROM);
}

function getEmailDeliveryMode() {
  if (isResendConfigured()) return "resend";
  if (isSmtpConfigured()) return "smtp";
  return "dev";
}

function getMailTransport() {
  if (mailTransport) return mailTransport;

  const config = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
  };

  if (SMTP_USER || SMTP_PASS) {
    config.auth = {
      user: SMTP_USER,
      pass: SMTP_PASS,
    };
  }

  mailTransport = nodemailer.createTransport(config);
  return mailTransport;
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getRequestOrigin(req) {
  const host = String(req.get("x-forwarded-host") || req.get("host") || "").trim();
  if (!host) return null;

  const forwardedProto = String(req.get("x-forwarded-proto") || req.protocol || "").split(",")[0].trim().toLowerCase();
  const protocol = /^https?$/.test(forwardedProto)
    ? forwardedProto
    : /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(host)
      ? "http"
      : "https";

  return normalizeAppUrl(`${protocol}://${host}`, APP_URL);
}

function getPublicAppUrl(req) {
  if (HAS_EXPLICIT_APP_URL && !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(APP_URL)) {
    return APP_URL;
  }

  return getRequestOrigin(req) || APP_URL;
}

function getAuthUrl(hash, appUrl = APP_URL) {
  const view = String(hash || "").replace("#", "").replace(/^\/+/, "") || "login";
  return `${appUrl.replace(/\/$/, "")}/${view}`;
}

async function sendMailMessage({ to, subject, text, html }) {
  const mode = getEmailDeliveryMode();
  if (mode === "dev") {
    return { delivery: "dev" };
  }

  if (mode === "resend") {
    if (!RESEND_FROM) {
      throw new Error("RESEND_FROM is not configured");
    }

    const response = await fetch(`${RESEND_API_BASE_URL}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        text,
        html,
        ...(RESEND_REPLY_TO ? { reply_to: RESEND_REPLY_TO } : {}),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        payload?.message || payload?.error || `Resend error: HTTP `
      );
    }

    return { delivery: "resend", id: payload?.id || null };
  }

  await getMailTransport().sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
    html,
  });

  return { delivery: "smtp" };
}

async function sendVerificationCodeEmail(email, code, appUrl = APP_URL) {
  const confirmUrl = getAuthUrl("#confirm", appUrl);
  return sendMailMessage({
    to: email,
    subject: `${APP_NAME}: confirm your email`,
    text: [
      `Your ${APP_NAME} confirmation code: ${code}`,
      "",
      "The code is valid for 15 minutes.",
      `Open ${confirmUrl} and enter the code to activate your account.`,
    ].join("\n"),
    html: [
      `<p>Your confirmation code for <strong>${APP_NAME}</strong>:</p>`,
      `<p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p>`,
      "<p>The code is valid for 15 minutes.</p>",
      `<p><a href="${confirmUrl}">Open the confirmation page</a> and enter the code to activate your account.</p>`,
    ].join(""),
  });
}

async function sendPasswordResetEmail(email, token, appUrl = APP_URL) {
  const resetUrl = getAuthUrl("#reset", appUrl);
  return sendMailMessage({
    to: email,
    subject: `${APP_NAME}: password reset`,
    text: [
      `Your ${APP_NAME} password reset token: ${token}`,
      "",
      "The token is valid for 30 minutes.",
      `Open ${resetUrl} to continue the reset flow.`,
    ].join("\n"),
    html: [
      `<p>Your password reset token for <strong>${APP_NAME}</strong>:</p>`,
      `<p style="font-size:20px;font-weight:700;word-break:break-all">${token}</p>`,
      "<p>The token is valid for 30 minutes.</p>",
      `<p><a href="${resetUrl}">Open the reset page</a> to continue.</p>`,
    ].join(""),
  });
}

async function getAuthUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}

async function getAuthUserByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

async function issueVerificationCode(userId) {
  const now = new Date();
  await prisma.emailVerificationCode.updateMany({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now },
  });

  const code = generateVerificationCode();
  await prisma.emailVerificationCode.create({
    data: {
      userId,
      code,
      expiresAt: addMinutes(now, 15),
    },
  });

  return code;
}

async function issuePasswordResetToken(userId) {
  const now = new Date();
  await prisma.passwordResetToken.updateMany({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now },
  });

  const token = crypto.randomBytes(16).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      token,
      expiresAt: addMinutes(now, 30),
    },
  });

  return token;
}

function buildDevDeliveryPayload(message, key, value) {
  return { ok: true, message, delivery: "dev", [key]: value };
}

async function syncLegacyAuthToDatabase() {
  const store = loadStore();
  const legacyUsers = Array.isArray(store.users) ? store.users : [];
  const legacyEmailCodes = Array.isArray(store.emailCodes) ? store.emailCodes : [];
  const legacyResetTokens = Array.isArray(store.resetTokens) ? store.resetTokens : [];

  if (!legacyUsers.length && !legacyEmailCodes.length && !legacyResetTokens.length) {
    return { migrated: false, users: 0 };
  }

  for (const user of legacyUsers) {
    const payload = {
      email: user.email,
      passwordHash: user.passwordHash,
      isEmailVerified: !!user.isEmailVerified,
      createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
      updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(),
    };
    const existingById = await prisma.user.findUnique({ where: { id: user.id } });
    if (existingById) {
      await prisma.user.update({
        where: { id: user.id },
        data: payload,
      });
      continue;
    }

    const existingByEmail = await prisma.user.findUnique({ where: { email: user.email } });
    if (existingByEmail) {
      await prisma.emailVerificationCode.deleteMany({ where: { userId: existingByEmail.id } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: existingByEmail.id } });
      await prisma.user.delete({ where: { id: existingByEmail.id } });
    }

    await prisma.user.create({
      data: {
        id: user.id,
        ...payload,
      },
    });
  }

  for (const row of legacyEmailCodes) {
    const user = legacyUsers.find((entry) => entry.id === row.userId);
    if (!user) continue;
    await prisma.emailVerificationCode.upsert({
      where: { id: row.id },
      update: {
        userId: row.userId,
        code: row.code,
        expiresAt: row.expiresAt ? new Date(row.expiresAt) : addMinutes(new Date(), 15),
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        usedAt: row.usedAt ? new Date(row.usedAt) : null,
      },
      create: {
        id: row.id,
        userId: row.userId,
        code: row.code,
        expiresAt: row.expiresAt ? new Date(row.expiresAt) : addMinutes(new Date(), 15),
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        usedAt: row.usedAt ? new Date(row.usedAt) : null,
      },
    });
  }

  for (const row of legacyResetTokens) {
    const user = legacyUsers.find((entry) => entry.id === row.userId);
    if (!user) continue;
    await prisma.passwordResetToken.upsert({
      where: { id: row.id },
      update: {
        userId: row.userId,
        token: row.token,
        expiresAt: row.expiresAt ? new Date(row.expiresAt) : addMinutes(new Date(), 30),
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        usedAt: row.usedAt ? new Date(row.usedAt) : null,
      },
      create: {
        id: row.id,
        userId: row.userId,
        token: row.token,
        expiresAt: row.expiresAt ? new Date(row.expiresAt) : addMinutes(new Date(), 30),
        createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
        usedAt: row.usedAt ? new Date(row.usedAt) : null,
      },
    });
  }

  store.users = [];
  store.emailCodes = [];
  store.resetTokens = [];
  saveStore(store);

  return { migrated: true, users: legacyUsers.length };
}

const publicDir = path.join(__dirname, "../public");
const dashboardRoutes = ["/dashboard", "/tasks", "/subjects", "/calendar", "/profile", "/goals", "/insights", "/ai", "/materials", "/exams"];
const authRoutes = ["/login", "/register", "/reset", "/confirm", "/almost", "/auth"];

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "48mb" }));
app.use(cookieParser());

app.get("/index.html", (req, res) => {
  res.redirect(302, "/dashboard");
});

app.get("/auth.html", (req, res) => {
  res.redirect(302, "/login");
});

app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "auth.html"));
});

app.get(authRoutes, (req, res) => {
  res.sendFile(path.join(publicDir, "auth.html"));
});

app.get(dashboardRoutes, (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    status: "ok",
    appUrl: getPublicAppUrl(req),
    timestamp: new Date().toISOString(),
  });
});

function uid() { return crypto.randomUUID(); }
function nowIso() { return new Date().toISOString(); }
function addMinutes(date, minutes) { return new Date(date.getTime() + minutes * 60_000); }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function signToken(userId) { return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: "7d" }); }
function normalizeEmail(email) { return String(email || "").trim().toLowerCase(); }
function clamp(value, min, max) {
  value = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}
function startOfDay(date = new Date()) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
function endOfDay(date = new Date()) { const d = new Date(date); d.setHours(23, 59, 59, 999); return d; }
function startOfToday() { return startOfDay(new Date()); }
function endOfToday() { return endOfDay(new Date()); }
function startOfWeek(date = new Date()) {
  const d = startOfDay(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}
function authMiddleware(req, res, next) {
  const token = req.cookies?.token || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
  if (!token) return res.status(401).json({ error: "Not authorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.uid;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
function ensureSubjectOwner(store, subjectId, userId) { return subjectId ? store.subjects.find((x) => x.id === subjectId && x.userId === userId) : null; }
function publicUser(user) { return user ? { id: user.id, email: user.email, isEmailVerified: !!user.isEmailVerified } : null; }
function normalizeColor(color) {
  const text = String(color || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text : "#5b8cff";
}
function normalizeMaterialKind(kind) {
  const value = String(kind || "").trim().toLowerCase();
  return ["note", "article", "video", "book", "practice", "link"].includes(value) ? value : "note";
}
function normalizeMaterialUrl(url) {
  const text = String(url || "").trim();
  if (!text) return null;
  try {
    const parsed = new URL(text);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}
function sortByCreatedDesc(list) {
  return list.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
function enrichTask(store, task) {
  const subject = task.subjectId ? store.subjects.find((s) => s.id === task.subjectId) : null;
  return { ...task, subject: subject ? { id: subject.id, name: subject.name, color: subject.color } : null };
}
function enrichGoal(store, goal) {
  const subject = goal.subjectId ? store.subjects.find((s) => s.id === goal.subjectId) : null;
  return { ...goal, subject: subject ? { id: subject.id, name: subject.name, color: subject.color } : null };
}
function enrichSubject(store, subject) {
  return {
    ...subject,
    _count: {
      tasks: store.tasks.filter((t) => t.subjectId === subject.id).length,
      goals: store.goals.filter((g) => g.subjectId === subject.id).length,
      materials: store.materials.filter((m) => m.subjectId === subject.id).length,
      studySessions: store.studySessions.filter((s) => s.subjectId === subject.id).length,
    },
  };
}
function enrichSession(store, session) {
  const subject = session.subjectId ? store.subjects.find((s) => s.id === session.subjectId) : null;
  return { ...session, subject: subject ? { id: subject.id, name: subject.name, color: subject.color } : null };
}
function enrichMaterial(store, material) {
  const subject = material.subjectId ? store.subjects.find((s) => s.id === material.subjectId) : null;
  return { ...material, subject: subject ? { id: subject.id, name: subject.name, color: subject.color } : null };
}
function getUserData(store, userId) {
  const tasks = store.tasks.filter((x) => x.userId === userId);
  const subjects = store.subjects.filter((x) => x.userId === userId);
  const goals = store.goals.filter((x) => x.userId === userId);
  const sessions = store.studySessions.filter((x) => x.userId === userId);
  const aiRequests = store.aiRequests.filter((x) => x.userId === userId);
  return { tasks, subjects, goals, sessions, aiRequests };
}
function getSubjectBreakdown(store, userId) {
  const { tasks, subjects, sessions } = getUserData(store, userId);
  return subjects.map((subject) => {
    const subjectTasks = tasks.filter((t) => t.subjectId === subject.id);
    const subjectSessions = sessions.filter((s) => s.subjectId === subject.id);
    const doneTasks = subjectTasks.filter((t) => t.status === "done").length;
    const minutes = subjectSessions.reduce((sum, s) => sum + s.minutes, 0);
    const weekMinutes = subjectSessions.filter((s) => new Date(s.createdAt) >= startOfWeek()).reduce((sum, s) => sum + s.minutes, 0);
    return {
      id: subject.id,
      name: subject.name,
      color: subject.color,
      tasks: subjectTasks.length,
      doneTasks,
      progress: subjectTasks.length ? Math.round((doneTasks / subjectTasks.length) * 100) : 0,
      minutes,
      weekMinutes,
      targetMinutes: subject.targetMinutes || 0,
      weeklyTargetHit: subject.targetMinutes ? Math.round((weekMinutes / subject.targetMinutes) * 100) : 0,
    };
  }).sort((a, b) => b.minutes - a.minutes || b.tasks - a.tasks);
}
function getHeatmap(sessions, days = 28) {
  const result = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = startOfDay(addDays(new Date(), -i));
    const next = addDays(day, 1);
    const minutes = sessions.filter((s) => {
      const created = new Date(s.createdAt);
      return created >= day && created < next;
    }).reduce((sum, s) => sum + s.minutes, 0);
    result.push({ date: day.toISOString(), minutes, level: minutes >= 120 ? 4 : minutes >= 75 ? 3 : minutes >= 35 ? 2 : minutes > 0 ? 1 : 0 });
  }
  return result;
}
function getWeeklyTrend(sessions, weeks = 6) {
  const result = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const base = addDays(new Date(), -(i * 7));
    const weekStart = startOfWeek(base);
    const weekEnd = addDays(weekStart, 7);
    const minutes = sessions.filter((s) => {
      const created = new Date(s.createdAt);
      return created >= weekStart && created < weekEnd;
    }).reduce((sum, s) => sum + s.minutes, 0);
    result.push({
      label: `${weekStart.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}`,
      minutes,
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
    });
  }
  return result;
}
function getStreak(sessions) {
  const today = startOfToday();
  const activeDays = new Set(
    sessions.map((s) => startOfDay(new Date(s.createdAt)).toISOString().slice(0, 10))
  );
  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const dayKey = startOfDay(addDays(today, -offset)).toISOString().slice(0, 10);
    if (activeDays.has(dayKey)) streak += 1;
    else break;
  }
  return streak;
}
function buildCalendar(store, userId, days = 10) {
  const { tasks } = getUserData(store, userId);
  const result = [];
  for (let i = 0; i < days; i += 1) {
    const day = startOfDay(addDays(new Date(), i));
    const next = addDays(day, 1);
    const dayTasks = tasks
      .filter((t) => t.dueDate && new Date(t.dueDate) >= day && new Date(t.dueDate) < next)
      .sort((a, b) => String(a.dueDate || "").localeCompare(String(b.dueDate || "")))
      .map((t) => enrichTask(store, t));
    result.push({ date: day.toISOString(), items: dayTasks });
  }
  return result;
}
function buildDailyReview(store, userId) {
  const { tasks, sessions, goals } = getUserData(store, userId);
  const today = startOfToday();
  const doneToday = tasks.filter((t) => t.status === "done" && t.completedAt && new Date(t.completedAt) >= today).length;
  const todayMinutes = sessions.filter((s) => new Date(s.createdAt) >= today).reduce((sum, s) => sum + s.minutes, 0);
  const overdue = tasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < today).length;
  const activeGoals = goals.filter((g) => g.status === "active");
  const weakSubject = getSubjectBreakdown(store, userId).sort((a, b) => a.weeklyTargetHit - b.weeklyTargetHit)[0] || null;
  const lines = [];
  if (todayMinutes >= 90) lines.push("Сегодня был хороший учебный объём, а не декоративная занятость.");
  else if (todayMinutes > 0) lines.push("День начат, но пока не выглядит устойчивым: нужен завершённый результат, а не только вход в работу.");
  else lines.push("Сегодня пока не было ни одной учебной сессии.");
  if (doneToday > 0) lines.push(`Закрыто задач сегодня: ${doneToday}. Это хороший индикатор темпа.`);
  if (overdue > 0) lines.push(`Просроченных задач: ${overdue}. Их нужно либо закрыть, либо заново перепланировать.`);
  if (weakSubject) lines.push(`Слабый предмет недели: ${weakSubject.name}. Выполнение недельной цели: ${weakSubject.weeklyTargetHit}%.`);
  if (activeGoals.length) lines.push(`Активных целей: ${activeGoals.length}. Не держи больше трёх приоритетов одновременно.`);
  return {
    doneToday,
    todayMinutes,
    overdue,
    weakSubject,
    summary: lines.join(" "),
    verdict: overdue >= 3 ? "critical" : todayMinutes >= 90 ? "strong" : "watch",
  };
}
function buildTodayPlan(store, userId) {
  const { tasks, sessions } = getUserData(store, userId);
  const openTasks = tasks
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const aOverdue = a.dueDate && new Date(a.dueDate) < startOfToday() ? 1 : 0;
      const bOverdue = b.dueDate && new Date(b.dueDate) < startOfToday() ? 1 : 0;
      return bOverdue - aOverdue || (b.focusScore || 0) - (a.focusScore || 0) || String(a.dueDate || "").localeCompare(String(b.dueDate || ""));
    })
    .slice(0, 3)
    .map((t) => enrichTask(store, t));

  let cursor = new Date();
  cursor.setMinutes(Math.ceil(cursor.getMinutes() / 15) * 15, 0, 0);
  const blocks = openTasks.map((task, index) => {
    const duration = clamp(task.estimatedMins || 30, 20, 90);
    const start = new Date(cursor);
    const end = addMinutes(start, duration);
    cursor = addMinutes(end, index < openTasks.length - 1 ? 10 : 0);
    return {
      label: task.title,
      subject: task.subject,
      start: start.toISOString(),
      end: end.toISOString(),
      duration,
      type: task.dueDate && new Date(task.dueDate) < startOfToday() ? "recovery" : "focus",
    };
  });

  const todayMinutes = sessions.filter((s) => new Date(s.createdAt) >= startOfToday()).reduce((sum, s) => sum + s.minutes, 0);
  const recoveryBias = tasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < startOfToday()).length;
  return {
    blocks,
    todayMinutes,
    headline: blocks.length
      ? "План собран из самых важных открытых задач и рассчитан на реальную концентрацию."
      : "Открытых задач нет. Можно использовать день для повторения или отдыха.",
    mode: recoveryBias > 0 ? "recovery" : todayMinutes >= 90 ? "maintenance" : "push",
  };
}
function buildFocusMode(store, userId) {
  const { tasks, sessions } = getUserData(store, userId);
  const recentSessions = sortByCreatedDesc(sessions).slice(0, 5);
  const overdueTasks = tasks.filter((x) => x.status !== "done" && x.dueDate && new Date(x.dueDate) < startOfToday()).length;
  const todayDone = tasks.filter((x) => x.status === "done" && x.completedAt && new Date(x.completedAt) >= startOfToday()).length;
  const todayMinutes = sessions.filter((x) => new Date(x.createdAt) >= startOfToday()).reduce((sum, x) => sum + x.minutes, 0);
  const avgMood = recentSessions.length ? recentSessions.reduce((sum, x) => sum + x.mood, 0) / recentSessions.length : 3;
  const risk = clamp(Math.round(overdueTasks * 18 + (3.5 - avgMood) * 20 - todayDone * 10 + Math.max(0, 45 - todayMinutes) / 3), 0, 100);
  const recommendation = risk >= 70
    ? "Риск перегруза высокий. Сузь фронт работы: один главный блок и один короткий блок поддержки."
    : risk >= 40
      ? "Нагрузка заметная. Лучше сделать несколько коротких фокус-сессий и не расширять список задач."
      : "Режим устойчивый. Можно идти через 2–3 фокус-сессии по 25–45 минут.";
  return { risk, avgMood: Number(avgMood.toFixed(1)), overdueTasks, todayDone, todayMinutes, recommendation };
}
function buildExamReply() {
  return [
    "Экзаменационная стратегия:",
    "— сначала диагностика: один тайм-блок под реальный лимит времени;",
    "— затем разложи ошибки на знание, невнимательность и темп;",
    "— 70% времени трать на повторяющиеся ошибки, а не на любимые темы;",
    "— за 48 часов до теста не учи новое, а только закрепляй шаблоны."
  ].join("\n");
}
function isSuspiciousLiveReply(prompt, text) {
  const normalizedPrompt = String(prompt || "").trim().toLowerCase();
  const normalizedText = String(text || "").trim().toLowerCase();
  if (!normalizedText) return true;
  if (["cat", "sat", "ielts", "toefl", "gmat", "gre"].some((token) => normalizedPrompt.includes(token))) {
    const mentionsAnimalCat = /(^|[^а-яёa-z])кот(а|у|ом|е|ы|ов|ам|ами|ах)?([^а-яёa-z]|$)/i.test(normalizedText);
    if (normalizedText.includes("изображени") || normalizedText.includes("фото") || mentionsAnimalCat) {
      return true;
    }
  }
  return false;
}
function extractPromptBlock(text, startLabel, endLabels = []) {
  const value = String(text || "");
  const startIndex = value.indexOf(startLabel);
  if (startIndex === -1) return "";

  const contentStart = startIndex + startLabel.length;
  let contentEnd = value.length;
  for (const label of endLabels) {
    const nextIndex = value.indexOf(label, contentStart);
    if (nextIndex !== -1 && nextIndex < contentEnd) contentEnd = nextIndex;
  }
  return value.slice(contentStart, contentEnd).trim();
}

function cleanPromptLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseSatQuestionPrompt(prompt) {
  const text = String(prompt || "");
  if (!text.includes("SAT section:") || !text.includes("Question:") || !text.includes("Choices:")) {
    return null;
  }

  const selectedMatch = text.match(/(?:Мой ответ|Ответ ученика|My answer|Student answer)\s*:\s*([^\n]+)/i);
  const correctAnswer = cleanPromptLine(extractPromptBlock(text, "Correct answer:", ["Official explanation:"]));
  return {
    section: cleanPromptLine(extractPromptBlock(text, "SAT section:", ["Topic:"])),
    topic: cleanPromptLine(extractPromptBlock(text, "Topic:", ["Question ID:", "Source:", "Question:"])),
    questionText: extractPromptBlock(text, "Question:", ["Choices:"]),
    choicesText: extractPromptBlock(text, "Choices:", ["Correct answer:", "Official explanation:"]),
    correctAnswer: correctAnswer && correctAnswer !== "Not available" ? correctAnswer : "",
    rationale: extractPromptBlock(text, "Official explanation:", []),
    selectedAnswer: selectedMatch ? cleanPromptLine(selectedMatch[1]) : "",
  };
}

function findChoiceForAnswer(choicesText, correctAnswer) {
  const answer = cleanPromptLine(correctAnswer).toLowerCase();
  if (!answer) return "";
  return String(choicesText || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith(`${answer}.`)) || "";
}

function buildSatQuestionReply(sat) {
  const answerChoice = findChoiceForAnswer(sat.choicesText, sat.correctAnswer);
  const selected = sat.selectedAnswer && !/не выбрал|not selected/i.test(sat.selectedAnswer)
    ? sat.selectedAnswer
    : "";
  const selectedLine = selected
    ? selected.toLowerCase() === sat.correctAnswer.toLowerCase()
      ? `Твой ответ: ${selected}. Это правильно.`
      : `Твой ответ: ${selected}. Правильный ответ: ${sat.correctAnswer}.`
    : "Ты пока не выбрал ответ.";
  const rationale = sat.rationale && sat.rationale !== "Not available"
    ? sat.rationale.slice(0, 900)
    : "В локальных данных нет официального объяснения, но ключ ответа есть.";

  if (!sat.correctAnswer) {
    return [
      "Я вижу SAT-вопрос и варианты ответа.",
      "Но в данных для этого вопроса нет ключа, поэтому локальный режим не должен угадывать ответ.",
      "",
      `Вопрос: ${cleanPromptLine(sat.questionText).slice(0, 500)}`,
      "",
      "Лучше включить Live AI или добавить правильный ответ в question bank."
    ].join("\n");
  }

  return [
    `Я вижу этот SAT-вопрос. Правильный ответ: ${sat.correctAnswer}.`,
    answerChoice ? `Полный вариант: ${answerChoice}.` : "",
    selectedLine,
    "",
    "Почему:",
    rationale,
    "",
    "Как думать на похожих вопросах:",
    "1. Сначала определи, что именно проверяется: смысл, грамматика, переход, пунктуация или структура.",
    "2. Подставь каждый вариант в предложение и проверь, не ломает ли он логику текста.",
    "3. Убери ответы, которые добавляют лишний смысл или грамматически не подходят.",
  ].filter(Boolean).join("\n");
}

function buildAiReply(prompt, context = {}) {
  const text = String(prompt || "").trim();
  if (!text) return "Напиши, что нужно разобрать: тему, предмет или цель. Например: \"объясни интегралы\", \"составь план по физике\" или \"сделай мини-тест\".";
  const lowered = text.toLowerCase();
  const subjectName = context.topSubject?.name || "ключевому предмету";
  const overdue = context.metrics?.overdueTasks || 0;
  const completion = context.metrics?.completionRate || 0;
  const streak = context.analytics?.streak || 0;
  const weakSubject = context.analytics?.dailyReview?.weakSubject?.name || subjectName;
  const satQuestion = parseSatQuestionPrompt(text);
  if (satQuestion) return buildSatQuestionReply(satQuestion);

  if (/^(привет|салам|здравствуй|здравствуйте|hello|hi|hey)[!.\s]*$/i.test(lowered)) {
    return [
      "Привет! Я на месте.",
      "Могу помочь с учебой: объяснить тему простыми словами, составить план, сделать мини-тест, карточки или разобрать задачу.",
      `Сейчас в фокусе: ${subjectName}.`,
      "Напиши тему или нажми быстрый инструмент справа."
    ].join("\n");
  }

  if (lowered.includes("интеграл")) {
    return [
      "Интеграл простыми словами — это способ сложить много маленьких кусочков в один общий результат.",
      "",
      "Главная идея:",
      "1. Производная отвечает на вопрос: как быстро меняется функция.",
      "2. Интеграл отвечает на вопрос: сколько всего накопилось.",
      "",
      "Картинка в голове: если график показывает скорость, то интеграл показывает пройденный путь. Если график показывает высоту кривой, то определенный интеграл показывает площадь под этой кривой.",
      "",
      "Пример:",
      "Интеграл от 2x равен x^2 + C, потому что производная x^2 снова дает 2x.",
      "",
      "Как учить:",
      "1. Повтори производные.",
      "2. Выучи базовые формулы интегралов.",
      "3. Реши 5 простых примеров на обратную производную.",
      "4. Потом переходи к площадям под графиком."
    ].join("\n");
  }

  if (lowered.includes("производн")) {
    return [
      "Производная показывает, как быстро меняется функция в конкретной точке.",
      "Если функция — это путь, то производная — это скорость.",
      "",
      "Пример: у функции x^2 производная равна 2x. Значит, чем больше x, тем быстрее растет график.",
      "",
      "Мини-план:",
      "1. Разобрать смысл наклона касательной.",
      "2. Выучить базовые правила: степень, сумма, произведение.",
      "3. Решить 10 примеров от простых к сложным."
    ].join("\n");
  }

  if (lowered.includes("мини-тест") || lowered.includes("тест")) {
    return [
      "Мини-тест на 5 вопросов:",
      "1. Объясни тему одним предложением.",
      "2. Назови главную формулу или правило.",
      "3. Реши один базовый пример без подсказки.",
      "4. Найди типичную ошибку в решении.",
      "5. Составь похожую задачу сам.",
      "",
      "Если хочешь, напиши конкретную тему, и я сделаю тест уже по ней."
    ].join("\n");
  }

  if (lowered.includes("карточ")) {
    return [
      "Карточки для повторения:",
      "1. Термин -> короткое определение.",
      "2. Формула -> когда применяется.",
      "3. Тип задачи -> первый шаг решения.",
      "4. Частая ошибка -> как проверить себя.",
      "5. Пример -> ответ без полного решения.",
      "",
      "Лучший режим: 10 карточек утром, 10 вечером, ошибки переносить на следующий день."
    ].join("\n");
  }

  if (lowered.includes("конспект")) {
    return [
      "Структура короткого конспекта:",
      "1. Что это за тема.",
      "2. Главная идея в 2-3 строках.",
      "3. Формулы или правила.",
      "4. Один разобранный пример.",
      "5. Типичные ошибки.",
      "6. Что решить для закрепления.",
      "",
      "Напиши тему, и я соберу конспект прямо по ней."
    ].join("\n");
  }

  if (lowered.includes("эссе") || lowered.includes("essay")) {
    return [
      "Для эссе держи простую структуру:",
      "1. Вступление: перефразируй тему и дай позицию.",
      "2. Аргумент 1: тезис, объяснение, пример.",
      "3. Аргумент 2: тезис, объяснение, пример.",
      "4. Контраргумент, если формат требует.",
      "5. Вывод: коротко повтори позицию.",
      "",
      "Скинь тему эссе, и я помогу собрать план и сильные аргументы."
    ].join("\n");
  }

  if (lowered.includes("что такое cat") || lowered === "cat") {
    return [
      "CAT чаще всего означает Common Admission Test — экзамен для поступления в бизнес-школы.",
      "Обычно в нём проверяют математику, логику, чтение и скорость решения.",
      "Если ты имел в виду другой CAT, уточни контекст: экзамен, сертификат, курс или термин.",
      "Могу дальше сразу помочь: объяснить структуру экзамена или составить план подготовки."
    ].join("\n");
  }
  if (["экзам", "sat", "ielts", "test", "cat"].some((x) => lowered.includes(x))) return buildExamReply();
  if (lowered.includes("план") || lowered.includes("schedule") || lowered.includes("roadmap")) {
    const blocks = (context.analytics?.todayPlan?.blocks || []).map((b, i) => `${i + 1}) ${b.label} — ${b.duration} мин.`).join("\n") || "1) 25 минут теория.\n2) 40 минут практика.\n3) 15 минут разбор ошибок.";
    return [
      `План по ${subjectName}:`,
      blocks,
      overdue > 0 ? `Сначала закрой ${overdue} просроченных задач(и).` : "Просроченных задач нет — это хороший старт.",
      `Серия учебных дней подряд: ${streak}.`,
      "Итог дня должен быть измеримым: решённый сет, конспект или тест."
    ].join("\n");
  }
  if (lowered.includes("мотива") || lowered.includes("устал") || lowered.includes("выгор")) {
    return [
      "Проблема выглядит как перегрузка, а не как отсутствие характера.",
      `Текущий уровень исполнения задач: ${completion}%.`,
      `Самый недокормленный предмет недели: ${weakSubject}.`,
      "Сократи план до двух обязательных блоков на день.",
      "Удали декоративные задачи, которые не двигают к экзамену или дедлайну."
    ].join("\n");
  }
  return [
    `Понял запрос: ${text}.`,
    "Я могу помочь, но мне нужно чуть больше контекста.",
    "",
    "Напиши одним сообщением:",
    "1. Предмет.",
    "2. Тему.",
    "3. Что нужно получить: объяснение, план, тест, карточки или решение.",
    "",
    `По текущему дашборду главный фокус: ${subjectName}.`,
    overdue > 0 ? `Еще есть ${overdue} просроченных задач — их лучше разобрать первыми.` : "Критических просрочек нет.",
    `Серия дней с учебой: ${streak}.`
  ].join("\n");
}

function normalizeAiHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => ({
      role: entry?.role === "assistant" ? "assistant" : "user",
      content: String(entry?.content || "").trim(),
    }))
    .filter((entry) => entry.content)
    .slice(-8);
}

function normalizeAiAttachments(attachments = []) {
  if (!Array.isArray(attachments)) return [];
  return attachments.slice(0, AI_ATTACHMENT_LIMIT).map((item) => {
    const name = String(item?.name || "Файл").trim().slice(0, 160);
    const type = String(item?.type || "application/octet-stream").trim().toLowerCase();
    const size = Math.max(0, Number(item?.size || 0));
    const kind = ["text", "image", "pdf"].includes(item?.kind) ? item.kind : type.startsWith("image/") ? "image" : type === "application/pdf" ? "pdf" : "text";
    const normalized = { name, type, size, kind };
    const text = String(item?.text || "").trim();
    if (text) {
      normalized.kind = "text";
      normalized.text = text.length > AI_ATTACHMENT_TEXT_LIMIT
        ? `${text.slice(0, AI_ATTACHMENT_TEXT_LIMIT)}\n\n[Файл обрезан до ${AI_ATTACHMENT_TEXT_LIMIT} символов]`
        : text;
      return normalized;
    }

    const dataUrl = String(item?.dataUrl || "").trim();
    const match = dataUrl.match(/^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i);
    if (!match) return null;
    const mimeType = String(match[1] || type || "application/octet-stream").toLowerCase();
    const base64 = String(match[2] || "").replace(/\s+/g, "");
    const byteLength = Buffer.byteLength(base64, "base64");
    if (byteLength > AI_ATTACHMENT_DATA_LIMIT) return null;
    if (!mimeType.startsWith("image/") && mimeType !== "application/pdf") return null;
    return {
      ...normalized,
      kind: mimeType === "application/pdf" ? "pdf" : "image",
      type: mimeType,
      size: size || byteLength,
      dataUrl: `data:${mimeType};base64,${base64}`,
      base64,
    };
  }).filter(Boolean);
}

function formatAttachmentSize(bytes = 0) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function buildAttachmentTextBlock(attachments = []) {
  if (!attachments.length) return "";
  const sections = attachments.map((file, index) => {
    const header = `Файл ${index + 1}: ${file.name} (${file.type || "unknown"}, ${formatAttachmentSize(file.size)})`;
    if (file.text) return `${header}\n${file.text}`;
    return `${header}\nБинарный файл приложен к запросу. Если модель не умеет читать этот тип напрямую, используй имя, тип и размер как контекст.`;
  });
  return `\n\nПрикрепленные файлы пользователя:\n${sections.join("\n\n---\n\n")}`;
}

function buildPromptWithAttachments(prompt, attachments = []) {
  return `${prompt}${buildAttachmentTextBlock(attachments)}`.trim();
}

function normalizeLanguage(value) {
  return String(value || "").toLowerCase() === "en" ? "en" : "ru";
}

function buildGeminiUserParts(prompt, attachments = []) {
  const parts = [{ text: buildPromptWithAttachments(prompt, attachments) }];
  attachments.forEach((file) => {
    if (file.base64 && (file.type.startsWith("image/") || file.type === "application/pdf")) {
      parts.push({
        inlineData: {
          mimeType: file.type,
          data: file.base64,
        },
      });
    }
  });
  return parts;
}

function subjectKindFromName(name = "") {
  const lower = String(name || "").toLowerCase();
  if (/sat/.test(lower)) return "sat";
  if (/eng|англ|ielts|toefl|essay|writing|reading/.test(lower)) return "english";
  if (/phys|физ|mechanic|механ/.test(lower)) return "physics";
  if (/math|матем|algebra|geometry|calculus|интеграл|производн/.test(lower)) return "math";
  return "general";
}

function aiSubjectKindFromText(text = "") {
  const lower = String(text || "").toLowerCase();
  if (/sat/.test(lower)) return "sat";
  if (/essay|english|англ|writing|reading|ielts|toefl/.test(lower)) return "english";
  if (/phys|физ|mechanic|механ|электр|newton|ньютон/.test(lower)) return "physics";
  if (/math|матем|algebra|geometry|calculus|интеграл|производн|уравнен/.test(lower)) return "math";
  return "general";
}

function pickAiSubject(store, userId, text = "") {
  const subjects = store.subjects.filter((subject) => subject.userId === userId);
  const kind = aiSubjectKindFromText(text);
  return subjects.find((subject) => subjectKindFromName(subject.name) === kind)
    || subjects.find((subject) => String(text).toLowerCase().includes(String(subject.name || "").toLowerCase()))
    || subjects[0]
    || null;
}

function nextTaskDueDate(index = 0) {
  const now = new Date();
  const baseHour = now.getHours() >= 19 ? 9 : Math.max(now.getHours() + 1, 9);
  const date = new Date(now);
  if (now.getHours() >= 19) date.setDate(date.getDate() + 1);
  date.setHours(Math.min(20, baseHour + index * 2), index % 2 ? 30 : 0, 0, 0);
  return date.toISOString();
}

function shouldOfferAiTasks(prompt = "", response = "") {
  const text = `${prompt}\n${response}`.toLowerCase();
  return /задач|task|todo|to-do|план|распис|schedule|deadline|дедлайн|подготов/.test(text);
}

function shouldAutoCreateAiTasks(prompt = "") {
  const text = String(prompt || "").toLowerCase();
  return /(добав|созд|заплан|постав|сделай|add|create|schedule)/i.test(text)
    && /(зада|task|todo|to-do|план|распис)/i.test(text);
}

function buildAiTaskDrafts(prompt, response, store, userId) {
  if (!shouldOfferAiTasks(prompt, response)) return [];
  const subject = pickAiSubject(store, userId, `${prompt}\n${response}`);
  const kind = aiSubjectKindFromText(`${prompt}\n${response}`);
  const templates = {
    sat: [
      ["SAT: диагностический блок", "Пройти короткий timed set и отметить слабые типы вопросов.", 45, "high"],
      ["SAT: разбор ошибок", "Разобрать ошибки, выписать правила и сделать 5 похожих задач.", 40, "high"],
      ["SAT: повторение формул", "Повторить формулы и сделать мини-проверку без подсказок.", 30, "medium"],
    ],
    english: [
      ["Английский: план эссе", "Собрать thesis, 2 аргумента и примеры перед написанием.", 35, "high"],
      ["Английский: черновик", "Написать черновик и проверить структуру абзацев.", 50, "medium"],
      ["Английский: правка", "Проверить грамматику, связки и финальную версию.", 30, "medium"],
    ],
    physics: [
      ["Физика: разобрать теорию", "Коротко выписать формулы, условия применения и типовые ошибки.", 40, "high"],
      ["Физика: практика задач", "Решить 6-8 задач по теме и отметить сложные шаги.", 60, "medium"],
      ["Физика: проверка понимания", "Сделать мини-тест и повторить ошибки.", 30, "medium"],
    ],
    math: [
      ["Математика: разобрать пример", "Разобрать один полный пример с объяснением каждого шага.", 35, "high"],
      ["Математика: практика", "Решить 8-10 задач от простых к сложным.", 55, "medium"],
      ["Математика: ошибки и повторение", "Выписать ошибки и повторить нужные формулы.", 30, "medium"],
    ],
    general: [
      ["ИИ-план: уточнить цель", "Сформулировать тему, срок и критерий готовности.", 20, "high"],
      ["ИИ-план: учебный блок", "Выполнить основной блок работы по плану ассистента.", 50, "medium"],
      ["ИИ-план: закрепление", "Сделать короткую проверку и записать ошибки.", 25, "medium"],
    ],
  };

  return (templates[kind] || templates.general).map(([title, description, estimatedMins, priority], index) => ({
    title,
    description,
    subjectId: subject?.id || null,
    dueDate: nextTaskDueDate(index),
    priority,
    estimatedMins,
    focusScore: priority === "high" ? 88 : 78,
  }));
}

function getAiProviderChain() {
  const chain = [];
  if ((AI_PROVIDER === "auto" || AI_PROVIDER === "openai") && OPENAI_API_KEY) {
    chain.push({ provider: "openai", models: [OPENAI_MODEL].filter(Boolean) });
  }
  if ((AI_PROVIDER === "auto" || AI_PROVIDER === "openrouter") && OPENROUTER_API_KEY) {
    chain.push({
      provider: "openrouter",
      models: [OPENROUTER_MODEL, ...OPENROUTER_FALLBACK_MODELS]
        .filter(Boolean)
        .filter((model, index, list) => list.indexOf(model) === index),
    });
  }
  if ((AI_PROVIDER === "auto" || AI_PROVIDER === "gemini" || AI_PROVIDER === "google") && GEMINI_API_KEY) {
    chain.push({
      provider: "gemini",
      models: [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]
        .filter(Boolean)
        .filter((model, index, list) => list.indexOf(model) === index),
    });
  }
  return chain;
}

function extractTextFromOpenAiPayload(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  if (!Array.isArray(payload?.output)) return "";
  return payload.output
    .flatMap((item) => {
      if (Array.isArray(item?.content)) {
        return item.content.map((part) => {
          if (typeof part?.text === "string") return part.text;
          if (typeof part?.content === "string") return part.content;
          return "";
        });
      }
      if (typeof item?.text === "string") return [item.text];
      return [];
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractTextFromGeminiPayload(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function humanizeAiApiError(reason) {
  const text = String(reason || "").trim();
  const lowered = text.toLowerCase();
  if (lowered.includes("quota") || lowered.includes("billing") || lowered.includes("plan")) {
    return "У выбранного AI-провайдера закончилась квота или не подключена оплата. Проверь billing у провайдера или настрой другой провайдер в server/.env.";
  }
  if (lowered.includes("incorrect api key") || lowered.includes("invalid api key") || lowered.includes("401")) {
    return "AI API ключ неверный или отключён. Замени ключ выбранного провайдера в server/.env и перезапусти сервер.";
  }
  if (lowered.includes("model") && (lowered.includes("not found") || lowered.includes("does not exist"))) {
    return "Выбранная AI-модель недоступна для этого провайдера. Проверь OPENAI_MODEL, OPENROUTER_MODEL или GEMINI_MODEL в server/.env.";
  }
  if (lowered.includes("rate limit") || lowered.includes("429")) {
    return "Слишком много запросов подряд. Подожди немного и попробуй снова.";
  }
  return text || "Неизвестная ошибка AI API.";
}

async function callOpenAiForModel(model, prompt, history, context = {}, attachments = []) {
  if (!OPENAI_API_KEY) {
    return { ok: false, reason: "missing_api_key", provider: "openai", model };
  }

  try {
    const reasoningEffort = ["low", "medium", "high"].includes(OPENAI_REASONING_EFFORT)
      ? OPENAI_REASONING_EFFORT
      : "low";
    const userContent = [{ type: "input_text", text: buildPromptWithAttachments(prompt, attachments) }];
    attachments.forEach((file) => {
      if (file.dataUrl && file.type.startsWith("image/")) {
        userContent.push({ type: "input_image", image_url: file.dataUrl });
      }
    });

    const body = {
      model,
      instructions: buildAiSystemPrompt(context),
      max_output_tokens: AI_MAX_OUTPUT_TOKENS,
      input: [
        ...history.map((entry) => ({
          role: entry.role,
          content: [{ type: "input_text", text: entry.content }],
        })),
        { role: "user", content: userContent },
      ],
    };
    if (model.startsWith("gpt-5")) {
      body.reasoning = { effort: reasoningEffort };
    }
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        reason: payload?.error?.message || payload?.message || `HTTP ${response.status}`,
        provider: "openai",
        model,
        raw: payload,
      };
    }

    const normalized = extractTextFromOpenAiPayload(payload);
    if (!normalized) {
      return { ok: false, reason: "empty_response", provider: "openai", model, raw: payload };
    }

    return {
      ok: true,
      provider: "openai",
      model: payload?.model || model,
      text: normalized,
      requestId: response.headers.get("x-request-id") || null,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error?.message || "network_error",
      provider: "openai",
      model,
    };
  }
}

async function callOpenRouterForModel(model, prompt, history, context = {}, attachments = []) {
  if (!OPENROUTER_API_KEY) {
    return { ok: false, reason: "missing_api_key", provider: "openrouter", model };
  }

  try {
    const imageParts = attachments
      .filter((file) => file.dataUrl && file.type.startsWith("image/"))
      .map((file) => ({ type: "image_url", image_url: { url: file.dataUrl } }));
    const userContent = imageParts.length
      ? [{ type: "text", text: buildPromptWithAttachments(prompt, attachments) }, ...imageParts]
      : buildPromptWithAttachments(prompt, attachments);
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": APP_URL,
        "X-OpenRouter-Title": APP_NAME,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildAiSystemPrompt(context) },
          ...history.map((entry) => ({ role: entry.role, content: entry.content })),
          { role: "user", content: userContent },
        ],
        temperature: 0.4,
        max_tokens: AI_MAX_OUTPUT_TOKENS,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        reason: payload?.error?.message || payload?.message || `HTTP ${response.status}`,
        provider: "openrouter",
        model,
        raw: payload,
      };
    }

    const content = payload?.choices?.[0]?.message?.content;
    const normalized = Array.isArray(content)
      ? content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("\n")
      : String(content || "").trim();

    if (!normalized) {
      return { ok: false, reason: "empty_response", provider: "openrouter", model, raw: payload };
    }

    return { ok: true, provider: "openrouter", model: payload?.model || model, text: normalized };
  } catch (error) {
    return {
      ok: false,
      reason: error?.message || "network_error",
      provider: "openrouter",
      model,
    };
  }
}

async function callGeminiForModel(model, prompt, history, context = {}, attachments = []) {
  if (!GEMINI_API_KEY) {
    return { ok: false, reason: "missing_api_key", provider: "gemini", model };
  }

  try {
    const normalizedModel = String(model || "").replace(/^models\//, "");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(normalizedModel)}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": GEMINI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildAiSystemPrompt(context) }],
        },
        contents: [
          ...history.map((entry) => ({
            role: entry.role === "assistant" ? "model" : "user",
            parts: [{ text: entry.content }],
          })),
          {
            role: "user",
            parts: buildGeminiUserParts(prompt, attachments),
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        reason: payload?.error?.message || payload?.message || `HTTP ${response.status}`,
        provider: "gemini",
        model,
        raw: payload,
      };
    }

    const normalized = extractTextFromGeminiPayload(payload);
    if (!normalized) {
      return { ok: false, reason: payload?.candidates?.[0]?.finishReason || "empty_response", provider: "gemini", model, raw: payload };
    }

    return { ok: true, provider: "gemini", model: payload?.modelVersion || model, text: normalized };
  } catch (error) {
    return {
      ok: false,
      reason: error?.message || "network_error",
      provider: "gemini",
      model,
    };
  }
}

function buildAiSystemPrompt(context = {}) {
  const responseLanguage = normalizeLanguage(context.language) === "en" ? "English" : "Russian";
  const subjectName = context.topSubject?.name || "general study";
  const weakSubject = context.analytics?.dailyReview?.weakSubject?.name || subjectName;
  const streak = context.analytics?.streak || 0;
  const overdue = context.metrics?.overdueTasks || 0;
  const completion = context.metrics?.completionRate || 0;
  const todayBlocks = (context.analytics?.todayPlan?.blocks || []).slice(0, 4).map((b, i) => `${i + 1}. ${b.label} (${b.duration} min)`).join("; ");
  const subjects = (context.subjects || []).slice(0, 8).map((subject) => `${subject.name} (${subject.progress || 0}%)`).join("; ");
  const openTasks = (context.openTasks || []).slice(0, 8).map((task, index) => `${index + 1}. ${task.title}${task.subject ? ` [${task.subject}]` : ""}${task.dueDate ? ` due ${task.dueDate}` : ""}`).join("; ");
  return [
    "You are a precise AI study coach inside a student dashboard.",
    `Write in ${responseLanguage}. Match the dashboard language exactly.`,
    "Be concrete, practical, warm, and honest.",
    "Do not promise impossible outcomes or generic motivation fluff.",
    "Stay inside the study-assistant context unless the user explicitly asks for something else.",
    "Interpret SAT, IELTS, TOEFL, GMAT, GRE, and CAT as exam abbreviations unless the user explicitly asks about an animal, image, or something unrelated to study.",
    "Do not describe images or animals unless the user directly asks about an image or an animal.",
    "Give a complete answer by default: explain the idea, then provide concrete steps, examples, and a next action.",
    "Use short paragraphs and bullets for readability, but do not make the answer overly brief.",
    "For math, prefer readable plain text and Unicode symbols such as ∫, √, π, ², ₀. Do not wrap formulas in raw LaTeX dollar delimiters like $...$ unless the user explicitly asks for LaTeX.",
    "If the user asks for a study plan, return a detailed plan with clear blocks, timing, priorities, practice tasks, and measurable results.",
    "If the user asks for an explanation, include a simple explanation, one worked example, common mistakes, and a quick practice task.",
    "If the user attaches files, treat them as primary user context. Read their text or visual content carefully and answer about the files when asked.",
    "Do not ignore short, code-like, or plain-text attachments; they may be the exact content the user wants analyzed.",
    "You can inspect the current dashboard state from the context below. When the user asks what is happening, summarize actual subjects, open tasks, overdue work, focus, and today's plan.",
    "When the user asks to add or create tasks, respond with a concise confirmation and a useful task breakdown; the app can turn your plan into real tasks.",
    "Aim for 6-12 useful bullets or 4-8 short paragraphs unless the user explicitly asks for a short answer.",
    "Use the dashboard context directly: overdue tasks, streak, weak subject, completion rate, and today's plan.",
    `Current top subject: ${subjectName}.`,
    `Weak subject this week: ${weakSubject}.`,
    `Current streak: ${streak}.`,
    `Overdue tasks: ${overdue}.`,
    `Task completion rate: ${completion}%.`,
    subjects ? `Current subjects: ${subjects}.` : "No user subjects yet.",
    openTasks ? `Open tasks: ${openTasks}.` : "No open tasks yet.",
    todayBlocks ? `Today's candidate blocks: ${todayBlocks}.` : "No prebuilt blocks for today.",
  ].join(" ");
}

async function generateAiResponse(prompt, context = {}, history = [], attachments = []) {
  const trimmed = String(prompt || "").trim();
  const language = normalizeLanguage(context.language);
  if (!trimmed) {
    return {
      text: language === "en"
        ? "Make the request more specific: subject, goal, deadline, and current level."
        : "Сформулируй запрос точнее: предмет, цель, срок, текущий уровень.",
      source: "local-fallback",
      mode: "fallback",
    };
  }

  const normalizedHistory = normalizeAiHistory(history);
  const normalizedAttachments = normalizeAiAttachments(attachments);
  const providers = getAiProviderChain();
  const tried = [];

  if (!providers.length) {
    return {
      text: language === "en"
        ? [
          "Live AI API is not connected yet.",
          "Open server/.env, add the key to OPENAI_API_KEY=, and restart the server.",
          "After that, answers will be generated by the model instead of local fallback text.",
        ].join("\n")
        : [
          "Живой AI API пока не подключен.",
          "Открой server/.env, вставь ключ в строку OPENAI_API_KEY= и перезапусти сервер.",
          "После этого ответы будут генерироваться моделью, а не локальными заготовками.",
        ].join("\n"),
      source: "not-configured",
      mode: "unconfigured",
      tried,
    };
  }

  for (const entry of providers) {
    for (const model of entry.models) {
      const external = entry.provider === "openai"
        ? await callOpenAiForModel(model, trimmed, normalizedHistory, context, normalizedAttachments)
        : entry.provider === "openrouter"
          ? await callOpenRouterForModel(model, trimmed, normalizedHistory, context, normalizedAttachments)
          : await callGeminiForModel(model, trimmed, normalizedHistory, context, normalizedAttachments);
      tried.push({ provider: entry.provider, model, ok: !!external.ok, reason: external.reason || null });
      if (external.ok) {
        if (isSuspiciousLiveReply(trimmed, external.text)) {
          tried.push({
            provider: entry.provider,
            model,
            ok: false,
            reason: "response_failed_validation",
          });
          continue;
        }
        return {
          text: external.text,
          source: `${external.provider}:${external.model}`,
          mode: "live",
          tried,
        };
      }
    }
  }

  return {
    text: language === "en"
      ? [
        "The AI API could not return an answer.",
        tried.length ? `Checked: ${tried.map((item) => `${item.provider}:${item.model}`).join(", ")}.` : "",
      ].filter(Boolean).join("\n")
      : [
        "AI API не смог вернуть ответ.",
        humanizeAiApiError(tried.find((item) => item.reason)?.reason),
        tried.length ? `Проверял: ${tried.map((item) => `${item.provider}:${item.model}`).join(", ")}.` : "",
      ].filter(Boolean).join("\n"),
    source: `api-error:${tried.map((item) => `${item.provider}:${item.model}`).join("|")}`,
    mode: "error",
    tried,
  };
}

function getAiConfigStatus() {
  const providers = getAiProviderChain();
  const active = providers[0] || null;
  const fallbackModels = providers.flatMap((entry, index) => (
    index === 0 ? entry.models.slice(1) : entry.models
  ));
  return {
    provider: active?.provider || (["openai", "openrouter", "gemini", "google"].includes(AI_PROVIDER) ? AI_PROVIDER : "local"),
    configured: providers.length > 0,
    model: active?.models?.[0] || null,
    fallbackModels,
    availableProviders: providers.map((entry) => ({
      provider: entry.provider,
      models: entry.models,
    })),
    appUrl: APP_URL,
    appName: APP_NAME,
  };
}

function safe(handler) {
  return (req, res) => Promise.resolve(handler(req, res)).catch((error) => {
    console.error(error);
    res.status(500).json({ error: error?.message || "Server error" });
  });
}

// AUTH
app.post("/api/auth/register", safe(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "").trim();
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  if (await getAuthUserByEmail(email)) return res.status(409).json({ error: "User already exists" });

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  const code = await issueVerificationCode(user.id);
  if (!isEmailDeliveryConfigured()) {
    return res.json(buildDevDeliveryPayload("Account created. Confirm email.", "devCode", code));
  }

  await sendVerificationCodeEmail(user.email, code, getPublicAppUrl(req));
  res.json({ ok: true, message: "Account created. Check your email for the confirmation code.", delivery: "email" });
}));

app.post("/api/auth/resend-code", safe(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "Email required" });
  const user = await getAuthUserByEmail(email);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.isEmailVerified) return res.json({ ok: true, message: "Already verified" });
  const code = await issueVerificationCode(user.id);
  if (!isEmailDeliveryConfigured()) {
    return res.json(buildDevDeliveryPayload("Code resent.", "devCode", code));
  }

  await sendVerificationCodeEmail(user.email, code, getPublicAppUrl(req));
  res.json({ ok: true, message: "A new confirmation code was sent to your email.", delivery: "email" });
}));

app.post("/api/auth/confirm-email", safe(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").trim();
  if (!email || !code) return res.status(400).json({ error: "Email and code required" });
  const user = await getAuthUserByEmail(email);
  if (!user) return res.status(404).json({ error: "User not found" });
  const row = await prisma.emailVerificationCode.findFirst({
    where: {
      userId: user.id,
      code,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return res.status(400).json({ error: "Invalid or expired code" });

  await prisma.$transaction([
    prisma.emailVerificationCode.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        updatedAt: new Date(),
      },
    }),
  ]);

  res.json({ ok: true, message: "Email confirmed" });
}));

app.post("/api/auth/login", safe(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  const user = await getAuthUserByEmail(email);
  if (!user) return res.status(401).json({ error: "Wrong email or password" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Wrong email or password" });
  if (!user.isEmailVerified) return res.status(403).json({ error: "Confirm your email before signing in" });
  const token = signToken(user.id);
  res.cookie("token", token, { httpOnly: true, sameSite: "lax" });
  res.json({ ok: true, token, user: publicUser(user) });
}));

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

app.get("/api/auth/me", authMiddleware, safe(async (req, res) => {
  const user = await getAuthUserById(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
}));

app.post("/api/auth/request-password-reset", safe(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "Email required" });
  const user = await getAuthUserByEmail(email);
  if (!user) return res.status(404).json({ error: "User not found" });
  const token = await issuePasswordResetToken(user.id);
  if (!isEmailDeliveryConfigured()) {
    return res.json(buildDevDeliveryPayload("Password reset token created.", "devToken", token));
  }

  await sendPasswordResetEmail(user.email, token, getPublicAppUrl(req));
  res.json({ ok: true, message: "Password reset instructions were sent to your email.", delivery: "email" });
}));

app.post("/api/auth/reset-password", safe(async (req, res) => {
  const token = String(req.body?.token || "").trim();
  const password = String(req.body?.password || "").trim();
  if (!token || !password) return res.status(400).json({ error: "Token and password required" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  const row = await prisma.passwordResetToken.findFirst({
    where: {
      token,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!row) return res.status(400).json({ error: "Invalid or expired token" });
  const user = await getAuthUserById(row.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 10),
        updatedAt: new Date(),
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);

  res.json({ ok: true });
}));

// SUBJECTS
app.get("/api/subjects", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  res.json(sortByCreatedDesc(store.subjects.filter((x) => x.userId === req.userId)).map((x) => enrichSubject(store, x)));
}));

app.post("/api/subjects", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "Subject name required" });
  const subject = {
    id: uid(), userId: req.userId, name,
    color: normalizeColor(req.body?.color),
    targetMinutes: clamp(req.body?.targetMinutes || 240, 30, 5000),
    description: req.body?.description ? String(req.body.description).trim() : null,
    createdAt: nowIso(), updatedAt: nowIso()
  };
  store.subjects.push(subject);
  saveStore(store);
  res.status(201).json(enrichSubject(store, subject));
}));

app.patch("/api/subjects/:id", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const subject = store.subjects.find((x) => x.id === req.params.id && x.userId === req.userId);
  if (!subject) return res.status(404).json({ error: "Subject not found" });
  if (req.body?.name !== undefined) subject.name = String(req.body.name || "").trim() || subject.name;
  if (req.body?.description !== undefined) subject.description = req.body.description ? String(req.body.description).trim() : null;
  if (req.body?.targetMinutes !== undefined) subject.targetMinutes = clamp(req.body.targetMinutes, 30, 5000);
  if (req.body?.color !== undefined) subject.color = normalizeColor(req.body.color);
  subject.updatedAt = nowIso();
  saveStore(store);
  res.json(enrichSubject(store, subject));
}));

app.delete("/api/subjects/:id", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const idx = store.subjects.findIndex((x) => x.id === req.params.id && x.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: "Subject not found" });
  const [subject] = store.subjects.splice(idx, 1);
  store.tasks.filter((x) => x.subjectId === subject.id).forEach((x) => { x.subjectId = null; x.updatedAt = nowIso(); });
  store.goals.filter((x) => x.subjectId === subject.id).forEach((x) => { x.subjectId = null; x.updatedAt = nowIso(); });
  store.materials.filter((x) => x.subjectId === subject.id).forEach((x) => { x.subjectId = null; x.updatedAt = nowIso(); });
  store.studySessions.filter((x) => x.subjectId === subject.id).forEach((x) => { x.subjectId = null; });
  saveStore(store);
  res.json({ ok: true });
}));

// MATERIALS
app.get("/api/materials", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  res.json(sortByCreatedDesc(store.materials.filter((x) => x.userId === req.userId)).map((x) => enrichMaterial(store, x)));
}));

app.post("/api/materials", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Material title required" });
  const subjectId = req.body?.subjectId ? String(req.body.subjectId) : null;
  if (subjectId && !ensureSubjectOwner(store, subjectId, req.userId)) return res.status(400).json({ error: "Invalid subject" });
  const rawUrl = req.body?.url;
  const url = normalizeMaterialUrl(rawUrl);
  if (String(rawUrl || "").trim() && !url) return res.status(400).json({ error: "Material URL must start with http:// or https://" });
  const material = {
    id: uid(),
    userId: req.userId,
    subjectId,
    title,
    kind: normalizeMaterialKind(req.body?.kind),
    url,
    description: req.body?.description ? String(req.body.description).trim() : null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  store.materials.push(material);
  saveStore(store);
  res.status(201).json(enrichMaterial(store, material));
}));

app.delete("/api/materials/:id", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const idx = store.materials.findIndex((x) => x.id === req.params.id && x.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: "Material not found" });
  store.materials.splice(idx, 1);
  saveStore(store);
  res.json({ ok: true });
}));

// TASKS
app.get("/api/tasks", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  res.json(
    store.tasks
      .filter((x) => x.userId === req.userId)
      .sort((a, b) => {
        const overdueA = a.status !== "done" && a.dueDate && new Date(a.dueDate) < startOfToday() ? 1 : 0;
        const overdueB = b.status !== "done" && b.dueDate && new Date(b.dueDate) < startOfToday() ? 1 : 0;
        return overdueB - overdueA || String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999")) || String(b.createdAt).localeCompare(String(a.createdAt));
      })
      .map((x) => enrichTask(store, x))
  );
}));

app.post("/api/tasks", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Task title required" });
  const subjectId = req.body?.subjectId ? String(req.body.subjectId) : null;
  if (subjectId && !ensureSubjectOwner(store, subjectId, req.userId)) return res.status(400).json({ error: "Invalid subject" });
  const task = {
    id: uid(),
    userId: req.userId,
    subjectId,
    title,
    description: req.body?.description ? String(req.body.description).trim() : null,
    status: ["todo", "doing", "done"].includes(req.body?.status) ? req.body.status : "todo",
    priority: ["low", "medium", "high"].includes(req.body?.priority) ? req.body.priority : "medium",
    dueDate: req.body?.dueDate ? new Date(req.body.dueDate).toISOString() : null,
    estimatedMins: clamp(req.body?.estimatedMins || 30, 5, 480),
    focusScore: clamp(req.body?.focusScore || 60, 1, 100),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: req.body?.status === "done" ? nowIso() : null,
  };
  store.tasks.push(task);
  saveStore(store);
  res.status(201).json(enrichTask(store, task));
}));

app.patch("/api/tasks/:id", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const task = store.tasks.find((x) => x.id === req.params.id && x.userId === req.userId);
  if (!task) return res.status(404).json({ error: "Task not found" });
  if (req.body?.subjectId !== undefined) {
    const subjectId = req.body.subjectId ? String(req.body.subjectId) : null;
    if (subjectId && !ensureSubjectOwner(store, subjectId, req.userId)) return res.status(400).json({ error: "Invalid subject" });
    task.subjectId = subjectId;
  }
  if (req.body?.title !== undefined) task.title = String(req.body.title || "").trim() || task.title;
  if (req.body?.description !== undefined) task.description = req.body.description ? String(req.body.description).trim() : null;
  if (req.body?.status !== undefined && ["todo", "doing", "done"].includes(req.body.status)) {
    task.status = req.body.status;
    task.completedAt = req.body.status === "done" ? nowIso() : null;
  }
  if (req.body?.priority !== undefined && ["low", "medium", "high"].includes(req.body.priority)) task.priority = req.body.priority;
  if (req.body?.dueDate !== undefined) task.dueDate = req.body.dueDate ? new Date(req.body.dueDate).toISOString() : null;
  if (req.body?.estimatedMins !== undefined) task.estimatedMins = clamp(req.body.estimatedMins, 5, 480);
  if (req.body?.focusScore !== undefined) task.focusScore = clamp(req.body.focusScore, 1, 100);
  task.updatedAt = nowIso();
  saveStore(store);
  res.json(enrichTask(store, task));
}));

app.delete("/api/tasks/:id", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const idx = store.tasks.findIndex((x) => x.id === req.params.id && x.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: "Task not found" });
  store.tasks.splice(idx, 1);
  saveStore(store);
  res.json({ ok: true });
}));

// GOALS
app.get("/api/goals", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  res.json(sortByCreatedDesc(store.goals.filter((x) => x.userId === req.userId)).map((x) => enrichGoal(store, x)));
}));

app.post("/api/goals", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const title = String(req.body?.title || "").trim();
  if (!title) return res.status(400).json({ error: "Goal title required" });
  const subjectId = req.body?.subjectId ? String(req.body.subjectId) : null;
  if (subjectId && !ensureSubjectOwner(store, subjectId, req.userId)) return res.status(400).json({ error: "Invalid subject" });
  const goal = {
    id: uid(),
    userId: req.userId,
    subjectId,
    title,
    description: req.body?.description ? String(req.body.description).trim() : null,
    targetDate: req.body?.targetDate ? new Date(req.body.targetDate).toISOString() : null,
    targetValue: clamp(req.body?.targetValue || 10, 1, 10000),
    progressValue: clamp(req.body?.progressValue || 0, 0, 10000),
    status: ["active", "paused", "done"].includes(req.body?.status) ? req.body.status : "active",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  store.goals.push(goal);
  saveStore(store);
  res.status(201).json(enrichGoal(store, goal));
}));

app.patch("/api/goals/:id", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const goal = store.goals.find((x) => x.id === req.params.id && x.userId === req.userId);
  if (!goal) return res.status(404).json({ error: "Goal not found" });
  if (req.body?.subjectId !== undefined) {
    const subjectId = req.body.subjectId ? String(req.body.subjectId) : null;
    if (subjectId && !ensureSubjectOwner(store, subjectId, req.userId)) return res.status(400).json({ error: "Invalid subject" });
    goal.subjectId = subjectId;
  }
  if (req.body?.title !== undefined) goal.title = String(req.body.title || "").trim() || goal.title;
  if (req.body?.description !== undefined) goal.description = req.body.description ? String(req.body.description).trim() : null;
  if (req.body?.targetDate !== undefined) goal.targetDate = req.body.targetDate ? new Date(req.body.targetDate).toISOString() : null;
  if (req.body?.targetValue !== undefined) goal.targetValue = clamp(req.body.targetValue, 1, 10000);
  if (req.body?.progressValue !== undefined) goal.progressValue = clamp(req.body.progressValue, 0, 10000);
  if (req.body?.status !== undefined && ["active", "paused", "done"].includes(req.body.status)) goal.status = req.body.status;
  goal.updatedAt = nowIso();
  saveStore(store);
  res.json(enrichGoal(store, goal));
}));

app.delete("/api/goals/:id", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const idx = store.goals.findIndex((x) => x.id === req.params.id && x.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: "Goal not found" });
  store.goals.splice(idx, 1);
  saveStore(store);
  res.json({ ok: true });
}));

// SESSIONS
app.get("/api/sessions", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  res.json(sortByCreatedDesc(store.studySessions.filter((x) => x.userId === req.userId)).slice(0, 120).map((x) => enrichSession(store, x)));
}));

app.post("/api/sessions", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const subjectId = req.body?.subjectId ? String(req.body.subjectId) : null;
  if (subjectId && !ensureSubjectOwner(store, subjectId, req.userId)) return res.status(400).json({ error: "Invalid subject" });
  const minutes = clamp(req.body?.minutes || 25, 1, 600);
  const mood = clamp(req.body?.mood || 3, 1, 5);
  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - minutes * 60_000);
  const session = {
    id: uid(), userId: req.userId, subjectId,
    startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(),
    minutes, mood,
    note: req.body?.note ? String(req.body.note).trim() : null,
    createdAt: nowIso()
  };
  store.studySessions.push(session);
  saveStore(store);
  res.status(201).json(enrichSession(store, session));
}));

app.get("/api/focus-mode", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  res.json(buildFocusMode(store, req.userId));
}));

// DASHBOARD + ANALYTICS
app.get("/api/dashboard", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const { tasks, subjects, goals, sessions } = getUserData(store, req.userId);
  const enrichedTasks = tasks.map((x) => enrichTask(store, x));
  const enrichedGoals = goals.map((x) => enrichGoal(store, x));
  const enrichedSubjects = subjects.map((x) => enrichSubject(store, x));
  const sessionsTodayMinutes = sessions.filter((x) => new Date(x.createdAt) >= startOfToday()).reduce((sum, x) => sum + x.minutes, 0);
  const sessionsWeekMinutes = sessions.filter((x) => new Date(x.createdAt) >= startOfWeek()).reduce((sum, x) => sum + x.minutes, 0);
  const sessionsTodayCount = sessions.filter((x) => new Date(x.createdAt) >= startOfToday()).length;
  const totalTasks = enrichedTasks.length;
  const doneTasks = enrichedTasks.filter((x) => x.status === "done").length;
  const overdueTasks = enrichedTasks.filter((x) => x.status !== "done" && x.dueDate && new Date(x.dueDate) < startOfToday()).length;
  const todayTasks = enrichedTasks.filter((x) => x.status !== "done" && x.dueDate && new Date(x.dueDate) <= endOfToday()).length;
  const completionRate = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const subjectBreakdown = getSubjectBreakdown(store, req.userId);
  const topSubject = subjectBreakdown[0] || null;
  res.json({
    metrics: {
      totalTasks, doneTasks, overdueTasks, todayTasks, completionRate,
      subjectCount: enrichedSubjects.length,
      goalCount: enrichedGoals.length,
      sessionsTodayCount, sessionsTodayMinutes, sessionsWeekMinutes,
      streak: getStreak(sessions),
    },
    topSubject,
    subjectBreakdown,
    tasks: enrichedTasks,
    goals: enrichedGoals,
  });
}));

app.get(["/api/analytics","/api/insights"], authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const { tasks, sessions, goals, aiRequests } = getUserData(store, req.userId);
  const dailyReview = buildDailyReview(store, req.userId);
  const todayPlan = buildTodayPlan(store, req.userId);
  const weeklyTrend = getWeeklyTrend(sessions);
  const subjectBreakdown = getSubjectBreakdown(store, req.userId);
  res.json({
    streak: getStreak(sessions),
    heatmap: getHeatmap(sessions, 28),
    weeklyTrend,
    calendar: buildCalendar(store, req.userId, 10),
    todayPlan,
    dailyReview,
    subjectBreakdown,
    recentSessions: sortByCreatedDesc(sessions).slice(0, 8).map((x) => enrichSession(store, x)),
    backlog: {
      overdue: tasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < startOfToday()).length,
      activeGoals: goals.filter((g) => g.status === "active").length,
      aiPrompts: aiRequests.length,
    },
  });
}));

app.get("/api/ai-status", authMiddleware, safe(async (req, res) => {
  const status = getAiConfigStatus();
  res.json({
    ...status,
    mode: status.configured ? "live-available" : "setup-required",
    note: status.configured
      ? status.provider === "openai"
        ? "Connected to OpenAI Responses API. The study coach now uses a real chat model, includes dashboard context in each reply, and can fall back to the next provider if it is configured."
        : status.provider === "gemini"
          ? "Gemini is connected. The study coach now uses a real chat model and can fall back to the next provider if it is configured."
          : "OpenRouter is connected. The server will try the main model and then fallback models before switching to the local mentor."
      : "No external AI key configured. Add OPENAI_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY to enable generated model replies.",
  });
}));

// AI
app.get("/api/ai-plan", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const prompt = String(req.query?.prompt || "").trim();
  const language = normalizeLanguage(req.query?.language);
  if (!prompt) {
    return res.json({
      ok: true,
      note: "Передайте query-параметр prompt или используйте POST /api/ai-plan.",
      example: "/api/ai-plan?prompt=" + encodeURIComponent("Составь план SAT Math на 7 дней"),
    });
  }
  const { tasks } = getUserData(store, req.userId);
  const subjectBreakdown = getSubjectBreakdown(store, req.userId);
  const analytics = {
    streak: getStreak(store.studySessions.filter((x) => x.userId === req.userId)),
    dailyReview: buildDailyReview(store, req.userId),
    todayPlan: buildTodayPlan(store, req.userId),
  };
  const topSubject = subjectBreakdown[0] || null;
  const metrics = {
    overdueTasks: tasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < startOfToday()).length,
    completionRate: tasks.length ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100) : 0,
  };
  const openTasks = tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => new Date(a.dueDate || "2999-01-01") - new Date(b.dueDate || "2999-01-01"))
    .slice(0, 8)
    .map((task) => ({ title: task.title, subject: store.subjects.find((subject) => subject.id === task.subjectId)?.name || null, dueDate: task.dueDate || null }));
  const aiResult = await generateAiResponse(prompt, { topSubject, metrics, analytics, subjects: subjectBreakdown, openTasks, language }, []);
  const taskDrafts = buildAiTaskDrafts(prompt, aiResult.text, store, req.userId);
  const payload = {
    prompt,
    response: aiResult.text,
    aiSource: aiResult.source,
    aiMode: aiResult.mode,
    tried: aiResult.tried || [],
    actions: {
      taskDrafts,
      autoCreateTasks: false,
    },
    createdAt: nowIso(),
    via: "get",
  };
  res.json(payload);
}));

app.post("/api/ai-plan", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const attachments = normalizeAiAttachments(req.body?.attachments || []);
  const language = normalizeLanguage(req.body?.language);
  const prompt = String(req.body?.prompt || req.body?.goal || (attachments.length ? (language === "en" ? "Analyze the attached files" : "Проанализируй прикрепленные файлы") : "")).trim();
  if (!prompt) return res.status(400).json({ error: "Prompt required" });
  const history = normalizeAiHistory(req.body?.history || []);
  const { tasks } = getUserData(store, req.userId);
  const subjectBreakdown = getSubjectBreakdown(store, req.userId);
  const analytics = {
    streak: getStreak(store.studySessions.filter((x) => x.userId === req.userId)),
    dailyReview: buildDailyReview(store, req.userId),
    todayPlan: buildTodayPlan(store, req.userId),
  };
  const topSubject = subjectBreakdown[0] || null;
  const metrics = {
    overdueTasks: tasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < startOfToday()).length,
    completionRate: tasks.length ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100) : 0,
  };
  const openTasks = tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => new Date(a.dueDate || "2999-01-01") - new Date(b.dueDate || "2999-01-01"))
    .slice(0, 8)
    .map((task) => ({ title: task.title, subject: store.subjects.find((subject) => subject.id === task.subjectId)?.name || null, dueDate: task.dueDate || null }));
  const aiResult = await generateAiResponse(prompt, { topSubject, metrics, analytics, subjects: subjectBreakdown, openTasks, language }, history, attachments);
  const taskDrafts = buildAiTaskDrafts(prompt, aiResult.text, store, req.userId);
  const actions = {
    taskDrafts,
    autoCreateTasks: shouldAutoCreateAiTasks(prompt) && taskDrafts.length > 0,
  };
  const record = {
    id: uid(),
    userId: req.userId,
    prompt,
    attachments: attachments.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      kind: file.kind,
    })),
    response: aiResult.text,
    aiSource: aiResult.source,
    aiMode: aiResult.mode,
    actions,
    tried: aiResult.tried || [],
    createdAt: nowIso()
  };
  store.aiRequests.push(record);
  saveStore(store);
  res.json(record);
}));

app.get("/api/ai-history", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  res.json(sortByCreatedDesc(store.aiRequests.filter((x) => x.userId === req.userId)).slice(0, 20));
}));

const EXAM_IDS = ["ent", "ege", "ielts", "sat"];
const ATTEMPTS_PER_USER_LIMIT = 500;

function sanitizeAttemptRows(rows, keyField) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 60).map((row) => ({
    [keyField]: String(row?.[keyField] || "").slice(0, 120),
    sectionId: String(row?.sectionId || "").slice(0, 60),
    correct: clamp(row?.correct, 0, 10000),
    total: clamp(row?.total, 0, 10000),
  })).filter((row) => row[keyField] && row.total > 0);
}

app.get("/api/exam-attempts", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  let attempts = store.examAttempts.filter((x) => x.userId === req.userId);
  const examId = String(req.query.examId || "").trim();
  if (examId) attempts = attempts.filter((x) => x.examId === examId);
  res.json(sortByCreatedDesc(attempts).slice(0, 200));
}));

app.post("/api/exam-attempts", authMiddleware, safe(async (req, res) => {
  const body = req.body || {};
  const examId = String(body.examId || "").trim();
  if (!EXAM_IDS.includes(examId)) return res.status(400).json({ error: "Unknown examId" });

  const sections = sanitizeAttemptRows(body.sections, "sectionId");
  if (!sections.length) return res.status(400).json({ error: "sections required" });

  const attempt = {
    id: uid(),
    userId: req.userId,
    examId,
    mode: ["full", "section", "practice"].includes(body.mode) ? body.mode : "section",
    sections,
    topics: sanitizeAttemptRows(body.topics, "topic"),
    score: {
      correct: clamp(body.score?.correct, 0, 10000),
      total: clamp(body.score?.total, 0, 10000),
      scaled: body.score?.scaled == null ? null : clamp(body.score.scaled, 0, 10000),
      scaledLabel: body.score?.scaledLabel == null ? null : String(body.score.scaledLabel).slice(0, 40),
    },
    durationSec: clamp(body.durationSec, 0, 24 * 3600),
    createdAt: nowIso(),
  };

  const store = loadStore();
  store.examAttempts.push(attempt);
  // Keep the newest attempts if a user somehow exceeds the cap
  const mine = store.examAttempts.filter((x) => x.userId === req.userId);
  if (mine.length > ATTEMPTS_PER_USER_LIMIT) {
    const excess = new Set(sortByCreatedDesc(mine).slice(ATTEMPTS_PER_USER_LIMIT).map((x) => x.id));
    store.examAttempts = store.examAttempts.filter((x) => !excess.has(x.id));
  }
  saveStore(store);
  res.status(201).json(attempt);
}));

app.delete("/api/exam-attempts/:id", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const idx = store.examAttempts.findIndex((x) => x.id === req.params.id && x.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: "Attempt not found" });
  store.examAttempts.splice(idx, 1);
  saveStore(store);
  res.json({ ok: true });
}));

app.post("/api/bootstrap-demo", authMiddleware, safe(async (req, res) => {
  // Starter demo data is intentionally disabled.
  // New users must begin with empty Tasks, Subjects, and Calendar tabs.
  res.json({ ok: true, seeded: false, message: "Demo data is disabled" });
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error" });
});

const legacyAuthSync = await syncLegacyAuthToDatabase();
const isLocalAppUrl = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(APP_URL);

app.listen(PORT, HOST, () => {
  console.log(`Study Dashboard server: ${APP_URL}`);
  console.log(`Listening on ${HOST}:${PORT}`);
  console.log(`Data file: ${dataFile}`);
  console.log(`Auth database: SQLite via Prisma`);
  console.log(`Email delivery: ${getEmailDeliveryMode()}`);
  if (process.env.NODE_ENV === "production" && isLocalAppUrl) {
    console.warn("APP_URL is still local. Set APP_URL to your public domain so email links open correctly.");
  }
  if (legacyAuthSync.migrated) {
    console.log(`Migrated ${legacyAuthSync.users} legacy auth account(s) from data.json to SQLite`);
  }
});
