// ---------------------------------------------------------------------------
// Email Send Worker — delivers transactional emails via Resend, respecting
// user notification preferences stored in the NotificationPreference table.
// ---------------------------------------------------------------------------
import { Worker, Job } from "bullmq";
import {
  createRedisConnection,
  EMAIL_QUEUE,
  type EmailJobData,
} from "@defi-tracker/shared/queue";
import { prisma } from "@defi-tracker/db";
import { sendEmail } from "../../../lib/email";

// ---------------------------------------------------------------------------
// Preference field mapping
// ---------------------------------------------------------------------------

/** Maps the EmailJobData.notificationType to the corresponding boolean field
 *  on the NotificationPreference model. */
const PREF_FIELD_MAP: Record<EmailJobData["notificationType"], "exportComplete" | "syncError" | "taxReminder"> = {
  EXPORT_COMPLETE: "exportComplete",
  SYNC_ERROR: "syncError",
  TAX_REMINDER: "taxReminder",
};

// ---------------------------------------------------------------------------
// Core processing logic
// ---------------------------------------------------------------------------

/**
 * Processes a single email-send job:
 * 1. Checks the user's notification preference for the given type
 * 2. If enabled (or no preference record exists — defaults to send), calls sendEmail()
 * 3. Logs success or skip reason
 */
async function processEmailSend(job: Job<EmailJobData>): Promise<void> {
  const { to, subject, html, userId, notificationType } = job.data;

  // 1. Check notification preference (table may not exist if migration 0002 not applied)
  let pref: { exportComplete: boolean; syncError: boolean; taxReminder: boolean } | null = null;
  try {
    pref = await prisma.notificationPreference.findUnique({
      where: { userId },
    });
  } catch {
    // notification_preferences table may not exist — default to sending emails
  }

  const prefField = PREF_FIELD_MAP[notificationType];

  if (pref && !pref[prefField]) {
    console.log(
      `[email-send] Skipping ${notificationType} email for user ${userId} — preference disabled`,
    );
    return;
  }

  // 2. Send the email
  try {
    await sendEmail({ to, subject, html });
    console.log(
      `[email-send] Sent ${notificationType} email to ${to} for user ${userId}`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error sending email";
    console.error(
      `[email-send] Failed to send ${notificationType} email to ${to}: ${message}`,
    );
    throw error; // re-throw so BullMQ marks the job as failed and can retry
  }
}

// ---------------------------------------------------------------------------
// Worker instance
// ---------------------------------------------------------------------------

export const emailSendWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE,
  processEmailSend,
  {
    connection: createRedisConnection(),
    concurrency: 5,
  },
);

emailSendWorker.on("completed", (job) => {
  console.log(`[email-send] Job ${job.id} completed for ${job.data.notificationType}`);
});

emailSendWorker.on("failed", (job, error) => {
  console.error(
    `[email-send] Job ${job?.id} failed for ${job?.data.notificationType}: ${error.message}`,
  );
});

export default emailSendWorker;
