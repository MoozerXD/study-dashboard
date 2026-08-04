// Durable storage for application data (subjects, tasks, goals, materials,
// study sessions, AI requests, exam attempts).
//
// Previously this lived in data.json, rewritten in full on every mutation:
// a crash mid-write truncated everything and a parse error silently returned
// an empty store. It now lives in the same SQLite file as the auth tables.
//
// The public interface is deliberately unchanged — loadStore() returns the
// familiar object of arrays and saveStore() persists it — so the request
// handlers and all the aggregate helpers keep working as they are. Writes are
// diffed against the last persisted snapshot and applied in one transaction,
// so only what actually changed touches the disk.
//
// Auth tables are owned by Prisma; these tables are managed here. Both use the
// same file, which is exactly what Prisma's better-sqlite3 adapter does too.
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const COLLECTIONS = {
  subjects: {
    table: "app_subjects",
    columns: ["id", "userId", "name", "color", "targetMinutes", "description", "createdAt", "updatedAt"],
  },
  goals: {
    table: "app_goals",
    columns: ["id", "userId", "subjectId", "title", "description", "targetDate", "targetValue", "progressValue", "status", "createdAt", "updatedAt"],
  },
  tasks: {
    table: "app_tasks",
    columns: ["id", "userId", "subjectId", "title", "description", "status", "priority", "dueDate", "estimatedMins", "focusScore", "createdAt", "updatedAt", "completedAt"],
  },
  materials: {
    table: "app_materials",
    columns: ["id", "userId", "subjectId", "title", "kind", "url", "description", "createdAt", "updatedAt"],
  },
  studySessions: {
    table: "app_study_sessions",
    columns: ["id", "userId", "subjectId", "startedAt", "endedAt", "minutes", "mood", "note", "createdAt"],
  },
  aiRequests: {
    table: "app_ai_requests",
    columns: ["id", "userId", "prompt", "attachments", "response", "aiSource", "aiMode", "actions", "tried", "createdAt"],
    json: ["attachments", "actions", "tried"],
  },
  examAttempts: {
    table: "app_exam_attempts",
    columns: ["id", "userId", "examId", "mode", "sections", "topics", "score", "durationSec", "createdAt"],
    json: ["sections", "topics", "score"],
  },
};

// Kept in the in-memory shape for backwards compatibility; the real auth
// records live in Prisma-owned tables.
const LEGACY_AUTH_KEYS = ["users", "emailCodes", "resetTokens"];

let db = null;
let memory = null;
let snapshot = null; // collection -> Map(id -> serialized row) as last persisted

function emptyStore() {
  const store = {};
  for (const key of LEGACY_AUTH_KEYS) store[key] = [];
  for (const key of Object.keys(COLLECTIONS)) store[key] = [];
  return store;
}

function createSchema() {
  for (const { table, columns } of Object.values(COLLECTIONS)) {
    const defs = columns.map((c) => (c === "id" ? "id TEXT PRIMARY KEY" : `${c} TEXT`)).join(", ");
    db.exec(`CREATE TABLE IF NOT EXISTS ${table} (${defs})`);
    if (columns.includes("userId")) {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_user ON ${table}(userId)`);
    }
  }
}

function rowToRecord(row, config) {
  const record = { ...row };
  for (const key of config.json || []) {
    if (record[key] == null) continue;
    try { record[key] = JSON.parse(record[key]); } catch { record[key] = null; }
  }
  // Numeric fields round-trip through TEXT; restore them so arithmetic works.
  for (const key of ["targetMinutes", "targetValue", "progressValue", "estimatedMins", "focusScore", "minutes", "mood", "durationSec"]) {
    if (record[key] != null && record[key] !== "") record[key] = Number(record[key]);
    else if (key in record && record[key] === "") record[key] = null;
  }
  return record;
}

function recordToRow(record, config) {
  const row = {};
  for (const column of config.columns) {
    let value = record[column];
    if ((config.json || []).includes(column)) value = value == null ? null : JSON.stringify(value);
    else if (value === undefined) value = null;
    else if (value !== null && typeof value === "object") value = JSON.stringify(value);
    else if (typeof value === "number" || typeof value === "boolean") value = String(value);
    row[column] = value;
  }
  return row;
}

function serialize(record, config) {
  return JSON.stringify(recordToRow(record, config));
}

function readAll() {
  const store = emptyStore();
  const nextSnapshot = new Map();
  for (const [key, config] of Object.entries(COLLECTIONS)) {
    const rows = db.prepare(`SELECT ${config.columns.join(", ")} FROM ${config.table}`).all();
    const records = rows.map((row) => rowToRecord(row, config));
    store[key] = records;
    nextSnapshot.set(key, new Map(records.map((record) => [record.id, serialize(record, config)])));
  }
  snapshot = nextSnapshot;
  return store;
}

/* --------------------------------------------------- one-time migration --- */

function importLegacyFile(dataFile) {
  if (!fs.existsSync(dataFile)) return { migrated: false };
  let legacy;
  try {
    legacy = JSON.parse(fs.readFileSync(dataFile, "utf8") || "{}");
  } catch (error) {
    console.error("data.json could not be parsed; leaving it untouched.", error?.message || error);
    return { migrated: false };
  }

  const counts = {};
  let total = 0;
  const insert = db.transaction(() => {
    for (const [key, config] of Object.entries(COLLECTIONS)) {
      const records = Array.isArray(legacy[key]) ? legacy[key] : [];
      if (!records.length) continue;
      const placeholders = config.columns.map((c) => `@${c}`).join(", ");
      const statement = db.prepare(`INSERT OR REPLACE INTO ${config.table} (${config.columns.join(", ")}) VALUES (${placeholders})`);
      for (const record of records) {
        if (!record?.id) continue;
        statement.run(recordToRow(record, config));
        total += 1;
      }
      counts[key] = records.length;
    }
  });
  insert();

  // Accounts that predate the Prisma auth tables still have to reach
  // syncLegacyAuthToDatabase(), so hand them back instead of dropping them
  // together with the file.
  const legacyAuth = {};
  for (const key of LEGACY_AUTH_KEYS) {
    legacyAuth[key] = Array.isArray(legacy[key]) ? legacy[key] : [];
  }

  // Keep the original file as a backup rather than deleting user data.
  const backup = `${dataFile}.migrated-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  try { fs.renameSync(dataFile, backup); } catch { /* leave it in place if busy */ }
  return { migrated: total > 0, counts, total, backup, legacyAuth };
}

function isEmpty() {
  for (const { table } of Object.values(COLLECTIONS)) {
    const row = db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get();
    if (row) return false;
  }
  return true;
}

/* --------------------------------------------------------------- public --- */

export function initStore({ databaseUrl, dataFile }) {
  const filePath = String(databaseUrl || "").replace(/^file:/, "") || "./prisma/dev.db";
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(path.dirname(dataFile), filePath);

  db = new Database(resolved);
  db.pragma("journal_mode = WAL"); // survives a crash mid-write
  db.pragma("foreign_keys = ON");
  createSchema();

  let migration = { migrated: false };
  if (isEmpty()) migration = importLegacyFile(dataFile);

  memory = readAll();
  for (const key of LEGACY_AUTH_KEYS) {
    memory[key] = migration.legacyAuth?.[key] || [];
  }
  return { path: resolved, migration };
}

export function loadStore() {
  if (!memory) throw new Error("Store is not initialised — call initStore() first");
  return memory;
}

// Persists whatever changed since the previous call. Handlers mutate the
// object returned by loadStore(), so the diff is against the last snapshot.
export function saveStore(store) {
  if (!db) throw new Error("Store is not initialised — call initStore() first");
  if (store && store !== memory) memory = store;
  const target = memory;

  const work = db.transaction(() => {
    for (const [key, config] of Object.entries(COLLECTIONS)) {
      const records = Array.isArray(target[key]) ? target[key] : [];
      const previous = snapshot.get(key) || new Map();
      const current = new Map();

      const placeholders = config.columns.map((c) => `@${c}`).join(", ");
      const upsert = db.prepare(`INSERT OR REPLACE INTO ${config.table} (${config.columns.join(", ")}) VALUES (${placeholders})`);
      const remove = db.prepare(`DELETE FROM ${config.table} WHERE id = ?`);

      for (const record of records) {
        if (!record?.id) continue;
        const serialized = serialize(record, config);
        current.set(record.id, serialized);
        if (previous.get(record.id) !== serialized) upsert.run(recordToRow(record, config));
      }
      for (const id of previous.keys()) {
        if (!current.has(id)) remove.run(id);
      }
      snapshot.set(key, current);
    }
  });
  work();
}

export function closeStore() {
  try { db?.close(); } catch { /* already closed */ }
  db = null;
}

export function storeStats() {
  const stats = {};
  for (const [key, { table }] of Object.entries(COLLECTIONS)) {
    stats[key] = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  }
  return stats;
}
