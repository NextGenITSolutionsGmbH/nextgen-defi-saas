/**
 * One-time migration script to encrypt existing plaintext TOTP secrets.
 * Run AFTER deploying TOTP_ENCRYPTION_KEY but BEFORE deploying encryption code.
 *
 * Usage: npx tsx scripts/migrate-totp-secrets.ts
 */

import { PrismaClient } from "@prisma/client";
import { createCipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getKey(): Buffer {
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
    );
  }
  return Buffer.from(hex, "hex");
}

function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const users = await prisma.user.findMany({
      where: {
        totpSecret: { not: null },
        totpEnabled: true,
      },
      select: { id: true, totpSecret: true },
    });

    console.log(`Found ${users.length} users with TOTP secrets to migrate`);

    let migrated = 0;
    for (const user of users) {
      if (!user.totpSecret) continue;

      // Skip if already encrypted (base64 encoded values are typically longer)
      // A raw TOTP secret is 32 chars (base32), encrypted is ~60+ chars (base64)
      if (user.totpSecret.length > 50) {
        console.log(`Skipping user ${user.id} — appears already encrypted`);
        continue;
      }

      const encrypted = encrypt(user.totpSecret);
      await prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: encrypted },
      });

      migrated++;
      console.log(`Migrated user ${user.id}`);
    }

    console.log(`\nMigration complete: ${migrated}/${users.length} secrets encrypted`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
