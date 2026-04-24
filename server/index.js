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
  return `${appUrl.replace(/\/$/, "")}/auth.html${hash}`;
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

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/auth.html"));
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
    if (normalizedText.includes("изображени") || normalizedText.includes("фото") || normalizedText.includes("кот")) {
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
  if (!text) return "Сформулируй запрос точнее: предмет, цель, срок, текущий уровень.";
  const lowered = text.toLowerCase();
  const subjectName = context.topSubject?.name || "ключевому предмету";
  const overdue = context.metrics?.overdueTasks || 0;
  const completion = context.metrics?.completionRate || 0;
  const streak = context.analytics?.streak || 0;
  const weakSubject = context.analytics?.dailyReview?.weakSubject?.name || subjectName;
  const satQuestion = parseSatQuestionPrompt(text);
  if (satQuestion) return buildSatQuestionReply(satQuestion);
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
    `Запрос принят: ${text}.`,
    `Сильнее всего внимания требует ${subjectName}.`,
    overdue > 0 ? `Есть ${overdue} просроченных задач. Их надо закрыть или отменить.` : "Критических просрочек нет.",
    `Серия дней с учёбой: ${streak}.`,
    "Практический шаг: один 45-минутный блок с конкретным результатом уже сегодня."
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

async function callOpenAiForModel(model, prompt, history, context = {}) {
  if (!OPENAI_API_KEY) {
    return { ok: false, reason: "missing_api_key", provider: "openai", model };
  }

  try {
    const reasoningEffort = ["low", "medium", "high"].includes(OPENAI_REASONING_EFFORT)
      ? OPENAI_REASONING_EFFORT
      : "low";
    const body = {
      model,
      instructions: buildAiSystemPrompt(context),
      input: [
        ...history.map((entry) => ({
          role: entry.role,
          content: [{ type: "input_text", text: entry.content }],
        })),
        { role: "user", content: [{ type: "input_text", text: prompt }] },
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

async function callOpenRouterForModel(model, prompt, history, context = {}) {
  if (!OPENROUTER_API_KEY) {
    return { ok: false, reason: "missing_api_key", provider: "openrouter", model };
  }

  try {
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
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 700,
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

function buildAiSystemPrompt(context = {}) {
  const subjectName = context.topSubject?.name || "general study";
  const weakSubject = context.analytics?.dailyReview?.weakSubject?.name || subjectName;
  const streak = context.analytics?.streak || 0;
  const overdue = context.metrics?.overdueTasks || 0;
  const completion = context.metrics?.completionRate || 0;
  const todayBlocks = (context.analytics?.todayPlan?.blocks || []).slice(0, 4).map((b, i) => `${i + 1}. ${b.label} (${b.duration} min)`).join("; ");
  return [
    "You are a precise AI study coach inside a student dashboard.",
    "Write in Russian.",
    "Be concrete, practical, warm, and honest.",
    "Do not promise impossible outcomes or generic motivation fluff.",
    "Stay inside the study-assistant context unless the user explicitly asks for something else.",
    "Interpret SAT, IELTS, TOEFL, GMAT, GRE, and CAT as exam abbreviations unless the user explicitly asks about an animal, image, or something unrelated to study.",
    "Do not describe images or animals unless the user directly asks about an image or an animal.",
    "When useful, structure the answer as diagnosis, plan, and next step.",
    "Prefer short paragraphs and bullets over long walls of text.",
    "If the user asks for a study plan, return a plan with clear blocks, timing, and a measurable result.",
    "Use the dashboard context directly: overdue tasks, streak, weak subject, completion rate, and today's plan.",
    `Current top subject: ${subjectName}.`,
    `Weak subject this week: ${weakSubject}.`,
    `Current streak: ${streak}.`,
    `Overdue tasks: ${overdue}.`,
    `Task completion rate: ${completion}%.`,
    todayBlocks ? `Today's candidate blocks: ${todayBlocks}.` : "No prebuilt blocks for today.",
  ].join(" ");
}

async function generateAiResponse(prompt, context = {}, history = []) {
  const trimmed = String(prompt || "").trim();
  if (!trimmed) return { text: "Сформулируй запрос точнее: предмет, цель, срок, текущий уровень.", source: "local-fallback", mode: "fallback" };

  const normalizedHistory = normalizeAiHistory(history);
  const providers = getAiProviderChain();
  const tried = [];

  for (const entry of providers) {
    for (const model of entry.models) {
      const external = entry.provider === "openai"
        ? await callOpenAiForModel(model, trimmed, normalizedHistory, context)
        : await callOpenRouterForModel(model, trimmed, normalizedHistory, context);
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
    text: buildAiReply(trimmed, context),
    source: tried.length ? `local-fallback:${tried.map((item) => `${item.provider}:${item.model}`).join("|")}` : "local-fallback",
    mode: "fallback",
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
    provider: active?.provider || (AI_PROVIDER === "openai" || AI_PROVIDER === "openrouter" ? AI_PROVIDER : "local"),
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
    mode: status.configured ? "live-available" : "fallback-only",
    note: status.configured
      ? status.provider === "openai"
        ? "Connected to OpenAI Responses API. The study coach now uses a real chat model, includes dashboard context in each reply, and can fall back to the next provider if it is configured."
        : "OpenRouter is connected. The server will try the main model and then fallback models before switching to the local mentor."
      : "No external AI key configured. The app uses the built-in local mentor.",
  });
}));

// AI
app.get("/api/ai-plan", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const prompt = String(req.query?.prompt || "").trim();
  if (!prompt) {
    return res.json({
      ok: true,
      note: "Передайте query-параметр prompt или используйте POST /api/ai-plan.",
      example: "/api/ai-plan?prompt=" + encodeURIComponent("Составь план SAT Math на 7 дней"),
    });
  }
  const { tasks } = getUserData(store, req.userId);
  const analytics = {
    streak: getStreak(store.studySessions.filter((x) => x.userId === req.userId)),
    dailyReview: buildDailyReview(store, req.userId),
    todayPlan: buildTodayPlan(store, req.userId),
  };
  const topSubject = getSubjectBreakdown(store, req.userId)[0] || null;
  const metrics = {
    overdueTasks: tasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < startOfToday()).length,
    completionRate: tasks.length ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100) : 0,
  };
  const aiResult = await generateAiResponse(prompt, { topSubject, metrics, analytics }, []);
  const payload = {
    prompt,
    response: aiResult.text,
    aiSource: aiResult.source,
    aiMode: aiResult.mode,
    tried: aiResult.tried || [],
    createdAt: nowIso(),
    via: "get",
  };
  res.json(payload);
}));

app.post("/api/ai-plan", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  const prompt = String(req.body?.prompt || req.body?.goal || "").trim();
  if (!prompt) return res.status(400).json({ error: "Prompt required" });
  const history = normalizeAiHistory(req.body?.history || []);
  const { tasks } = getUserData(store, req.userId);
  const analytics = {
    streak: getStreak(store.studySessions.filter((x) => x.userId === req.userId)),
    dailyReview: buildDailyReview(store, req.userId),
    todayPlan: buildTodayPlan(store, req.userId),
  };
  const topSubject = getSubjectBreakdown(store, req.userId)[0] || null;
  const metrics = {
    overdueTasks: tasks.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < startOfToday()).length,
    completionRate: tasks.length ? Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100) : 0,
  };
  const aiResult = await generateAiResponse(prompt, { topSubject, metrics, analytics }, history);
  const record = {
    id: uid(),
    userId: req.userId,
    prompt,
    response: aiResult.text,
    aiSource: aiResult.source,
    aiMode: aiResult.mode,
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

app.post("/api/bootstrap-demo", authMiddleware, safe(async (req, res) => {
  const store = loadStore();
  if (store.subjects.some((x) => x.userId === req.userId)) {
    return res.json({ ok: true, seeded: false, message: "User already has data" });
  }
  const sat = { id: uid(), userId: req.userId, name: "SAT Math", color: "#2563eb", targetMinutes: 420, description: "Core practice and timed drills", createdAt: nowIso(), updatedAt: nowIso() };
  const eng = { id: uid(), userId: req.userId, name: "English", color: "#8b5cf6", targetMinutes: 300, description: "Reading and writing", createdAt: nowIso(), updatedAt: nowIso() };
  const phys = { id: uid(), userId: req.userId, name: "Physics", color: "#14b8a6", targetMinutes: 240, description: "Problem solving blocks", createdAt: nowIso(), updatedAt: nowIso() };
  store.subjects.push(sat, eng, phys);

  store.goals.push(
    { id: uid(), userId: req.userId, subjectId: sat.id, title: "Finish 5 SAT timed sets", description: null, targetDate: null, targetValue: 5, progressValue: 2, status: "active", createdAt: nowIso(), updatedAt: nowIso() },
    { id: uid(), userId: req.userId, subjectId: eng.id, title: "Read 3 long passages", description: null, targetDate: null, targetValue: 3, progressValue: 1, status: "active", createdAt: nowIso(), updatedAt: nowIso() }
  );

  store.tasks.push(
    { id: uid(), userId: req.userId, subjectId: sat.id, title: "Quadratics drill", description: "Timed drill on weak patterns", status: "todo", priority: "high", dueDate: addMinutes(new Date(), 24 * 60).toISOString(), estimatedMins: 45, focusScore: 82, createdAt: nowIso(), updatedAt: nowIso(), completedAt: null },
    { id: uid(), userId: req.userId, subjectId: eng.id, title: "Vocabulary review", description: null, status: "doing", priority: "medium", dueDate: addMinutes(new Date(), 48 * 60).toISOString(), estimatedMins: 25, focusScore: 61, createdAt: nowIso(), updatedAt: nowIso(), completedAt: null },
    { id: uid(), userId: req.userId, subjectId: phys.id, title: "Mechanics worksheet", description: null, status: "todo", priority: "medium", dueDate: addMinutes(new Date(), -12 * 60).toISOString(), estimatedMins: 50, focusScore: 72, createdAt: nowIso(), updatedAt: nowIso(), completedAt: null },
    { id: uid(), userId: req.userId, subjectId: sat.id, title: "Timed no-calculator set", description: null, status: "done", priority: "high", dueDate: addMinutes(new Date(), -48 * 60).toISOString(), estimatedMins: 35, focusScore: 78, createdAt: nowIso(), updatedAt: nowIso(), completedAt: nowIso() }
  );

  const now = new Date();
  store.studySessions.push(
    { id: uid(), userId: req.userId, subjectId: sat.id, startedAt: addMinutes(now, -135).toISOString(), endedAt: addMinutes(now, -90).toISOString(), minutes: 45, mood: 4, note: null, createdAt: addMinutes(now, -90).toISOString() },
    { id: uid(), userId: req.userId, subjectId: eng.id, startedAt: addDays(now, -1).toISOString(), endedAt: addMinutes(addDays(now, -1), 30).toISOString(), minutes: 30, mood: 3, note: null, createdAt: addDays(now, -1).toISOString() },
    { id: uid(), userId: req.userId, subjectId: sat.id, startedAt: addDays(now, -2).toISOString(), endedAt: addMinutes(addDays(now, -2), 65).toISOString(), minutes: 65, mood: 4, note: null, createdAt: addDays(now, -2).toISOString() },
    { id: uid(), userId: req.userId, subjectId: phys.id, startedAt: addDays(now, -3).toISOString(), endedAt: addMinutes(addDays(now, -3), 40).toISOString(), minutes: 40, mood: 2, note: "Low energy", createdAt: addDays(now, -3).toISOString() }
  );

  store.materials.push(
    { id: uid(), userId: req.userId, subjectId: sat.id, title: "SAT Math formula sheet", kind: "note", url: null, description: "Короткий конспект формул и типовых ошибок перед timed drill.", createdAt: nowIso(), updatedAt: nowIso() },
    { id: uid(), userId: req.userId, subjectId: eng.id, title: "Reading strategy video", kind: "video", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", description: "Разбор структуры passage и порядка ответов.", createdAt: nowIso(), updatedAt: nowIso() },
    { id: uid(), userId: req.userId, subjectId: phys.id, title: "Mechanics practice set", kind: "practice", url: "https://www.khanacademy.org/science/physics", description: "Подборка задач для закрепления законов Ньютона.", createdAt: nowIso(), updatedAt: nowIso() }
  );

  saveStore(store);
  res.json({ ok: true, seeded: true });
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
