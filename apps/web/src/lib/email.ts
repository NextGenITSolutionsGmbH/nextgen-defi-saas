// ---------------------------------------------------------------------------
// Resend email client — sends transactional emails via the Resend API
// ---------------------------------------------------------------------------
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? "DeFi Tracker <noreply@defi.nextgenitsolutions.de>";

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set, skipping email");
    return;
  }
  await resend.emails.send({ from: FROM, to: params.to, subject: params.subject, html: params.html });
}
