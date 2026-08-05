// Tells Bing and Yandex that the public pages exist or changed.
//
// Google does NOT support IndexNow — submit the sitemap once in Search Console
// instead; after that Google rediscovers it on its own.
//
// Usage (from the project root, on the server where server/.env lives):
//   node scripts/submit-indexnow.mjs
//
// Requires INDEXNOW_KEY and APP_URL in server/.env. Generate a key with:
//   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function readEnv() {
  const envPath = path.join(root, "server/.env");
  const env = { ...process.env };
  if (fs.existsSync(envPath)) {
    // Split on both line endings: a .env edited on Windows leaves a trailing
    // \r, which "." never matches, so the value regex would fail to anchor.
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (!(match[1] in process.env)) env[match[1]] = value;
    }
  }
  return env;
}

async function main() {
  const env = readEnv();
  const key = String(env.INDEXNOW_KEY || "").trim();
  const appUrl = String(env.APP_URL || "").trim().replace(/\/$/, "");

  if (!/^[a-f0-9]{8,128}$/i.test(key)) {
    console.error("INDEXNOW_KEY is missing or malformed (needs 8-128 hex characters).");
    console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(16).toString(\'hex\'))"');
    return 1;
  }
  if (!/^https?:\/\//.test(appUrl) || /localhost|127\.0\.0\.1/.test(appUrl)) {
    console.error(`APP_URL must be the public site address, got: ${appUrl || "(empty)"}`);
    return 1;
  }

  const host = new URL(appUrl).host;
  const examIds = ["ent", "ege", "ielts", "sat"];
  const urlList = [
    `${appUrl}/`,
    `${appUrl}/en`,
    ...examIds.map((id) => `${appUrl}/${id}`),
    ...examIds.map((id) => `${appUrl}/en/${id}`),
  ];

  // The key file must be reachable before submitting, or the endpoint rejects it.
  const keyUrl = `${appUrl}/${key}.txt`;
  try {
    const probe = await fetch(keyUrl);
    const body = (await probe.text()).trim();
    if (!probe.ok || body !== key) {
      console.error(`Key file check failed at ${keyUrl} (HTTP ${probe.status}).`);
      console.error("Set INDEXNOW_KEY in server/.env, restart the app, then run this again.");
      return 1;
    }
    console.log(`key file verified: ${keyUrl}`);
  } catch (error) {
    console.error(`Could not reach ${keyUrl}: ${error.message}`);
    return 1;
  }

  const payload = { host, key, keyLocation: keyUrl, urlList };

  for (const endpoint of ["https://api.indexnow.org/indexnow", "https://yandex.com/indexnow"]) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });
      // 200 and 202 both mean accepted; 422 usually means the key check failed.
      const detail = res.status >= 400 ? `\n  ${(await res.text()).slice(0, 200)}` : "";
      console.log(`${endpoint} -> HTTP ${res.status}${res.status < 300 ? " (accepted)" : ""}${detail}`);
    } catch (error) {
      console.error(`${endpoint} -> ${error.message}`);
    }
  }

  console.log(`\nsubmitted ${urlList.length} URLs for ${host}`);
  console.log(`Google: submit ${appUrl}/sitemap.xml once in Search Console — IndexNow does not reach it.`);
  return 0;
}

process.exitCode = await main();
