import nodemailer from "nodemailer";
import { config } from "./config";

// One transport for the whole app. Works unchanged with SendGrid SMTP or Amazon SES SMTP —
// provider and sender identity live entirely in .env (LOCKED rule).
function transport() {
  const { smtpHost, smtpPort, smtpUser, smtpPass } = config.email;
  if (!smtpHost) return null;
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
  });
}

export async function checkEmail(): Promise<{ ok: boolean; detail: string }> {
  const t = transport();
  if (!t) return { ok: false, detail: "SMTP_HOST is not set in .env" };
  try {
    await t.verify();
    return { ok: true, detail: `SMTP login OK — will send as "${config.email.fromName}" <${config.email.from}>` };
  } catch (e) {
    return { ok: false, detail: `SMTP verify failed: ${(e as Error).message}` };
  }
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const t = transport();
  if (!t) throw new Error("Email is not configured (SMTP_HOST missing)");
  await t.sendMail({
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to,
    subject,
    html,
  });
}
