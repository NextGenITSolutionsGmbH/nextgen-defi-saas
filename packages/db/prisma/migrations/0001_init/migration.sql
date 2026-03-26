-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "plan_tier" AS ENUM ('STARTER', 'PRO', 'BUSINESS', 'KANZLEI');

-- CreateEnum
CREATE TYPE "sync_status" AS ENUM ('IDLE', 'SYNCING', 'COMPLETED', 'ERROR');

-- CreateEnum
CREATE TYPE "tx_status" AS ENUM ('GREEN', 'YELLOW', 'RED', 'GRAY');

-- CreateEnum
CREATE TYPE "direction" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "price_source" AS ENUM ('FTSO', 'COINGECKO', 'CMC', 'MANUAL');

-- CreateEnum
CREATE TYPE "model_choice" AS ENUM ('MODEL_A', 'MODEL_B');

-- CreateEnum
CREATE TYPE "tax_method" AS ENUM ('FIFO', 'LIFO', 'HIFO');

-- CreateEnum
CREATE TYPE "tax_event_type" AS ENUM ('PARAGRAPH_23', 'PARAGRAPH_22_NR3');

-- CreateEnum
CREATE TYPE "lot_status" AS ENUM ('OPEN', 'CLOSED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "export_format" AS ENUM ('CSV', 'XLSX', 'PDF');

-- CreateEnum
CREATE TYPE "export_status" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "sub_status" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'TRIALING');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "plan" "plan_tier" NOT NULL DEFAULT 'STARTER',
    "totp_secret" VARCHAR(128),
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "address" VARCHAR(42) NOT NULL,
    "chain_id" INTEGER NOT NULL DEFAULT 14,
    "label" VARCHAR(100),
    "last_sync_at" TIMESTAMPTZ,
    "last_sync_block" BIGINT,
    "sync_status" "sync_status" NOT NULL DEFAULT 'IDLE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "tx_hash" VARCHAR(66) NOT NULL,
    "block_number" BIGINT NOT NULL,
    "block_timestamp" BIGINT NOT NULL,
    "protocol" VARCHAR(100),
    "raw_data" JSONB,
    "status" "tx_status" NOT NULL DEFAULT 'GRAY',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tx_legs" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "leg_index" INTEGER NOT NULL,
    "direction" "direction" NOT NULL,
    "token_address" VARCHAR(42) NOT NULL,
    "token_symbol" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "eur_value" DECIMAL(28,10),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tx_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tx_classifications" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "ct_type" VARCHAR(50) NOT NULL,
    "buy_amount" DECIMAL(36,18),
    "buy_currency" VARCHAR(20),
    "sell_amount" DECIMAL(36,18),
    "sell_currency" VARCHAR(20),
    "fee" DECIMAL(36,18),
    "fee_currency" VARCHAR(20),
    "eur_buy_value" DECIMAL(28,10),
    "eur_sell_value" DECIMAL(28,10),
    "price_source" "price_source" NOT NULL,
    "model_choice" "model_choice",
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tx_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_prices" (
    "id" UUID NOT NULL,
    "token_symbol" VARCHAR(20) NOT NULL,
    "token_address" VARCHAR(42) NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "timestamp_unix" BIGINT NOT NULL,
    "eur_price" DECIMAL(28,10) NOT NULL,
    "source" "price_source" NOT NULL,
    "source_url" TEXT,

    CONSTRAINT "token_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_lots" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_symbol" VARCHAR(20) NOT NULL,
    "token_address" VARCHAR(42) NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "acquisition_cost_eur" DECIMAL(28,10) NOT NULL,
    "acquisition_date" TIMESTAMPTZ NOT NULL,
    "remaining_amount" DECIMAL(36,18) NOT NULL,
    "method" "tax_method" NOT NULL,
    "disposal_date" TIMESTAMPTZ,
    "lot_status" "lot_status" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "tax_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tx_classification_id" UUID NOT NULL,
    "tax_lot_id" UUID,
    "event_type" "tax_event_type" NOT NULL,
    "gain_loss_eur" DECIMAL(28,10) NOT NULL,
    "holding_period_days" INTEGER,
    "tax_year" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(64) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "field_changed" VARCHAR(100),
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sha256_hash" VARCHAR(64) NOT NULL,
    "prev_hash" VARCHAR(64),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tax_year" INTEGER NOT NULL,
    "method" "tax_method" NOT NULL,
    "format" "export_format" NOT NULL,
    "file_path" TEXT,
    "file_hash" VARCHAR(64),
    "row_count" INTEGER,
    "generated_at" TIMESTAMPTZ NOT NULL,
    "status" "export_status" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_audit_logs" (
    "id" UUID NOT NULL,
    "token_symbol" VARCHAR(20) NOT NULL,
    "timestamp_unix" BIGINT NOT NULL,
    "attempted_source" VARCHAR(30) NOT NULL,
    "result_source" VARCHAR(30) NOT NULL,
    "eur_price" DECIMAL(28,10) NOT NULL,
    "fallback_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan" "plan_tier" NOT NULL,
    "status" "sub_status" NOT NULL,
    "stripe_sub_id" VARCHAR(255),
    "current_period_start" TIMESTAMPTZ NOT NULL,
    "current_period_end" TIMESTAMPTZ NOT NULL,
    "cancel_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uq_wallet_address_chain" ON "wallets"("address", "chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_tx_hash_key" ON "transactions"("tx_hash");

-- CreateIndex
CREATE INDEX "idx_tx_wallet_timestamp" ON "transactions"("wallet_id", "block_timestamp");

-- CreateIndex
CREATE INDEX "idx_tx_wallet_protocol" ON "transactions"("wallet_id", "protocol");

-- CreateIndex
CREATE UNIQUE INDEX "uq_token_price_symbol_chain_ts" ON "token_prices"("token_symbol", "chain_id", "timestamp_unix");

-- CreateIndex
CREATE INDEX "idx_tax_lot_user_symbol_date" ON "tax_lots"("user_id", "token_symbol", "acquisition_date");

-- CreateIndex
CREATE INDEX "idx_tax_event_user_year" ON "tax_events"("user_id", "tax_year");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_sha256_hash_key" ON "audit_logs"("sha256_hash");

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_export_user_year" ON "exports"("user_id", "tax_year");

-- CreateIndex
CREATE INDEX "idx_price_audit_symbol_ts" ON "price_audit_logs"("token_symbol", "timestamp_unix");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_sub_id_key" ON "subscriptions"("stripe_sub_id");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tx_legs" ADD CONSTRAINT "tx_legs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tx_classifications" ADD CONSTRAINT "tx_classifications_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_lots" ADD CONSTRAINT "tax_lots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_events" ADD CONSTRAINT "tax_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_events" ADD CONSTRAINT "tax_events_tx_classification_id_fkey" FOREIGN KEY ("tx_classification_id") REFERENCES "tx_classifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_events" ADD CONSTRAINT "tax_events_tax_lot_id_fkey" FOREIGN KEY ("tax_lot_id") REFERENCES "tax_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

