import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "../.env"), override: true });

const SMTP_HOST = String(process.env.SMTP_HOST || "").trim();
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || (SMTP_PORT === 465 ? "true" : "false")).trim().toLowerCase() === "true";
const SMTP_USER = String(process.env.SMTP_USER || "").trim();
const SMTP_PASS = String(process.env.SMTP_PASS || "").replace(/\s+/g, "").trim();
const SMTP_FROM = String(process.env.SMTP_FROM || SMTP_USER || "").trim();
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const RESEND_API_BASE_URL = String(process.env.RESEND_API_BASE_URL || "https://api.resend.com").trim().replace(/\/$/, "");
const RESEND_FROM = String(process.env.RESEND_FROM || "").trim();
const RESEND_REPLY_TO = String(process.env.RESEND_REPLY_TO || "").trim();
const APP_NAME = String(process.env.APP_NAME || "Study Dashboard").trim();

const targetEmail = String(process.argv[2] || SMTP_USER).trim();

async function main() {
  if (!RESEND_API_KEY && (!SMTP_HOST || !SMTP_FROM)) {
    throw new Error("Email delivery is not configured. Fill RESEND_API_KEY or SMTP settings in server/.env.");
  }

  if (!targetEmail) {
    throw new Error("Pass a target email: npm run email:test -- yourmail@gmail.com");
  }

  if (RESEND_API_KEY) {
    const response = await fetch(`${RESEND_API_BASE_URL}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM || `${APP_NAME} <onboarding@resend.dev>`,
        to: [targetEmail],
        subject: `${APP_NAME}: Resend test`,
        text: `Resend is working. Test email sent at ${new Date().toISOString()}.`,
        html: `<p>Resend is working.</p><p>Test email sent at <strong>${new Date().toISOString()}</strong>.</p>`,
        ...(RESEND_REPLY_TO ? { reply_to: RESEND_REPLY_TO } : {}),
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || `Resend error: HTTP ${response.status}`);
    }

    console.log(`Test email sent to ${targetEmail} via Resend`);
    console.log(`Message ID: ${payload?.id || "unknown"}`);
    return;
  }

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER || SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  await transport.verify();

  const info = await transport.sendMail({
    from: SMTP_FROM,
    to: targetEmail,
    subject: `${APP_NAME}: SMTP test`,
    text: `SMTP is working. Test email sent at ${new Date().toISOString()}.`,
    html: `<p>SMTP is working.</p><p>Test email sent at <strong>${new Date().toISOString()}</strong>.</p>`,
  });

  console.log(`Test email sent to ${targetEmail} via SMTP`);
  console.log(`Message ID: ${info.messageId}`);
}

await main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
