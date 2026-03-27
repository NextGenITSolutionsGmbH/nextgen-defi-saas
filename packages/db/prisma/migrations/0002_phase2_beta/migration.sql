-- AlterTable: Add stripe_customer_id to users
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" VARCHAR(255);

-- CreateIndex: Unique constraint on stripe_customer_id
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

-- CreateTable: notification_preferences
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "export_complete" BOOLEAN NOT NULL DEFAULT false,
    "sync_error" BOOLEAN NOT NULL DEFAULT false,
    "tax_reminder" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on user_id
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- AddForeignKey: notification_preferences.user_id -> users.id
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
