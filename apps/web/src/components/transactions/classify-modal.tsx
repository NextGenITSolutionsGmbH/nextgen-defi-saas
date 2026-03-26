"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

const CT_TYPES = [
  "Trade",
  "Deposit",
  "Withdrawal",
  "Staking",
  "LP Rewards",
  "Lending Einnahme",
  "Airdrop",
  "Mining",
  "Add Liquidity",
  "Remove Liquidity",
  "Transfer (intern)",
  "Margin Trade",
  "Other Income",
  "Other Expense",
  "Lost",
  "Stolen",
  "Gift",
] as const;

type CTType = (typeof CT_TYPES)[number];

interface ClassifyModalProps {
  transactionId: string;
  txHash: string;
  onClose: () => void;
  onClassified: () => void;
}

export function ClassifyModal({
  transactionId,
  txHash,
  onClose,
  onClassified,
}: ClassifyModalProps) {
  const [ctType, setCtType] = useState<CTType | "">("");
  const [buyAmount, setBuyAmount] = useState("");
  const [buyCurrency, setBuyCurrency] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [sellCurrency, setSellCurrency] = useState("");
  const [fee, setFee] = useState("");
  const [feeCurrency, setFeeCurrency] = useState("");
  const [comment, setComment] = useState("");

  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLSelectElement>(null);

  const classifyMutation = trpc.transaction.classify.useMutation({
    onSuccess: () => {
      onClassified();
      onClose();
    },
  });

  // Focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0] as HTMLElement;
        const lastFocusable = focusableElements[
          focusableElements.length - 1
        ] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
          }
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    firstFocusRef.current?.focus();
    // Prevent background scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ctType) return;

    classifyMutation.mutate({
      transactionId,
      ctType: ctType as CTType,
      buyAmount: buyAmount ? parseFloat(buyAmount) : undefined,
      buyCurrency: buyCurrency || undefined,
      sellAmount: sellAmount ? parseFloat(sellAmount) : undefined,
      sellCurrency: sellCurrency || undefined,
      fee: fee ? parseFloat(fee) : undefined,
      feeCurrency: feeCurrency || undefined,
      priceSource: "MANUAL",
      comment: comment || undefined,
    });
  };

  const truncatedHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Classify Transaction"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative z-10 mx-4 w-full max-w-lg overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-card,#1e1e36)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Classify Transaction
            </h2>
            <p className="mt-0.5 font-mono text-xs text-[var(--color-text-tertiary)]">
              {truncatedHash}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5">
          {/* Warning Banner */}
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3">
            <AlertTriangle
              size={18}
              className="mt-0.5 flex-shrink-0 text-[#EF4444]"
            />
            <p className="text-xs leading-relaxed text-[#EF4444]/90">
              Manuelle Klassifikation — bitte Steuerberater konsultieren
            </p>
          </div>

          {/* CT Type */}
          <div className="mb-4">
            <label
              htmlFor="ct-type"
              className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]"
            >
              CoinTracking Type *
            </label>
            <select
              id="ct-type"
              ref={firstFocusRef}
              value={ctType}
              onChange={(e) => setCtType(e.target.value as CTType)}
              required
              className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus,#6366f1)] focus:ring-2 focus:ring-[var(--color-border-focus,#6366f1)]/20"
            >
              <option value="">Select type...</option>
              {CT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Buy Amount + Currency */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="buy-amount"
                className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Buy Amount
              </label>
              <input
                id="buy-amount"
                type="number"
                step="any"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus,#6366f1)] focus:ring-2 focus:ring-[var(--color-border-focus,#6366f1)]/20"
              />
            </div>
            <div>
              <label
                htmlFor="buy-currency"
                className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Buy Currency
              </label>
              <input
                id="buy-currency"
                type="text"
                value={buyCurrency}
                onChange={(e) => setBuyCurrency(e.target.value)}
                placeholder="e.g. FLR"
                className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus,#6366f1)] focus:ring-2 focus:ring-[var(--color-border-focus,#6366f1)]/20"
              />
            </div>
          </div>

          {/* Sell Amount + Currency */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="sell-amount"
                className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Sell Amount
              </label>
              <input
                id="sell-amount"
                type="number"
                step="any"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus,#6366f1)] focus:ring-2 focus:ring-[var(--color-border-focus,#6366f1)]/20"
              />
            </div>
            <div>
              <label
                htmlFor="sell-currency"
                className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Sell Currency
              </label>
              <input
                id="sell-currency"
                type="text"
                value={sellCurrency}
                onChange={(e) => setSellCurrency(e.target.value)}
                placeholder="e.g. USDT"
                className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus,#6366f1)] focus:ring-2 focus:ring-[var(--color-border-focus,#6366f1)]/20"
              />
            </div>
          </div>

          {/* Fee + Fee Currency */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="fee-amount"
                className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Fee
              </label>
              <input
                id="fee-amount"
                type="number"
                step="any"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus,#6366f1)] focus:ring-2 focus:ring-[var(--color-border-focus,#6366f1)]/20"
              />
            </div>
            <div>
              <label
                htmlFor="fee-currency"
                className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]"
              >
                Fee Currency
              </label>
              <input
                id="fee-currency"
                type="text"
                value={feeCurrency}
                onChange={(e) => setFeeCurrency(e.target.value)}
                placeholder="e.g. FLR"
                className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus,#6366f1)] focus:ring-2 focus:ring-[var(--color-border-focus,#6366f1)]/20"
              />
            </div>
          </div>

          {/* Comment */}
          <div className="mb-5">
            <label
              htmlFor="comment"
              className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]"
            >
              Comment
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Optional notes..."
              className="w-full resize-none rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus,#6366f1)] focus:ring-2 focus:ring-[var(--color-border-focus,#6366f1)]/20"
            />
          </div>

          {/* Error */}
          {classifyMutation.error && (
            <div className="mb-4 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-2 text-xs text-[#EF4444]">
              {classifyMutation.error.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!ctType || classifyMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-[#EF4444] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#DC2626] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {classifyMutation.isPending && (
                <Loader2 size={14} className="animate-spin" />
              )}
              Classify
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modal, document.body);
}
