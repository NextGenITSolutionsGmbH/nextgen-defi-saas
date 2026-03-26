"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Scale, ArrowRightLeft } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

type ModelChoice = "MODEL_A" | "MODEL_B";

interface DualScenarioModalProps {
  transactionId: string;
  txHash: string;
  protocol: string | null;
  onClose: () => void;
  onSelected: () => void;
}

export function DualScenarioModal({
  transactionId,
  txHash,
  protocol,
  onClose,
  onSelected,
}: DualScenarioModalProps) {
  const [selected, setSelected] = useState<ModelChoice | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const setDualScenarioMutation =
    trpc.transaction.setDualScenario.useMutation({
      onSuccess: () => {
        onSelected();
        onClose();
      },
    });

  // Focus trap and escape
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
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const handleConfirm = () => {
    if (!selected) return;
    setDualScenarioMutation.mutate({
      transactionId,
      modelChoice: selected,
    });
  };

  const truncatedHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Steuerliche Einordnung wählen"
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
        className="relative z-10 mx-4 w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-card,#1e1e36)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Steuerliche Einordnung w&auml;hlen (Graubereich)
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-xs text-[var(--color-text-tertiary)]">
                {truncatedHash}
              </span>
              {protocol && (
                <span className="rounded-full bg-[var(--color-bg-tertiary,#2a2a4a)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                  {protocol}
                </span>
              )}
            </div>
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
        <div className="px-6 py-5">
          {/* Explanation */}
          <p className="mb-5 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            Diese Transaktion liegt in einem steuerrechtlichen Graubereich.
            Bitte w&auml;hlen Sie ein Bewertungsmodell:
          </p>

          {/* Model cards */}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Model A */}
            <button
              type="button"
              onClick={() => setSelected("MODEL_A")}
              className={[
                "group flex flex-col rounded-xl border-2 p-5 text-left transition-all",
                selected === "MODEL_A"
                  ? "border-[#F5A623] bg-[#F5A623]/10 shadow-md shadow-[#F5A623]/10"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[#F5A623]/50 hover:bg-[#F5A623]/5",
              ].join(" ")}
              aria-pressed={selected === "MODEL_A"}
            >
              <div className="mb-3 flex items-center gap-2">
                <div
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-lg transition",
                    selected === "MODEL_A"
                      ? "bg-[#F5A623]/20 text-[#F5A623]"
                      : "bg-[var(--color-bg-tertiary,#2a2a4a)] text-[var(--color-text-tertiary)]",
                  ].join(" ")}
                >
                  <ArrowRightLeft size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Modell A — Tausch
                  </h3>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    &sect; 23 EStG
                  </span>
                </div>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                LP-Providing wird als Tausch Ihrer Tokens gegen LP-Tokens
                behandelt. Dies l&ouml;st eine neue Haltefrist aus.
              </p>
              <div className="mt-auto">
                <span className="inline-block rounded-full bg-[#F5A623]/15 px-2.5 py-1 text-xs font-medium text-[#F5A623]">
                  Neue Haltefrist
                </span>
              </div>
            </button>

            {/* Model B */}
            <button
              type="button"
              onClick={() => setSelected("MODEL_B")}
              className={[
                "group flex flex-col rounded-xl border-2 p-5 text-left transition-all",
                selected === "MODEL_B"
                  ? "border-[#6366f1] bg-[#6366f1]/10 shadow-md shadow-[#6366f1]/10"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[#6366f1]/50 hover:bg-[#6366f1]/5",
              ].join(" ")}
              aria-pressed={selected === "MODEL_B"}
            >
              <div className="mb-3 flex items-center gap-2">
                <div
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-lg transition",
                    selected === "MODEL_B"
                      ? "bg-[#6366f1]/20 text-[#6366f1]"
                      : "bg-[var(--color-bg-tertiary,#2a2a4a)] text-[var(--color-text-tertiary)]",
                  ].join(" ")}
                >
                  <Scale size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Modell B — Nutzungs&uuml;berlassung
                  </h3>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    &sect; 22 Nr. 3 EStG
                  </span>
                </div>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                LP-Providing wird als &Uuml;berlassung behandelt. Nur die
                Rewards sind steuerpflichtig, nicht das Providing selbst.
              </p>
              <div className="mt-auto">
                <span className="inline-block rounded-full bg-[#6366f1]/15 px-2.5 py-1 text-xs font-medium text-[#6366f1]">
                  Nur Rewards steuerpflichtig
                </span>
              </div>
            </button>
          </div>

          {/* GoBD Note */}
          <p className="mb-5 text-xs text-[var(--color-text-tertiary)]">
            Diese Auswahl wird im GoBD-Audit-Log dokumentiert.
          </p>

          {/* Error */}
          {setDualScenarioMutation.error && (
            <div className="mb-4 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-2 text-xs text-[#EF4444]">
              {setDualScenarioMutation.error.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-[var(--color-text-tertiary)] underline transition hover:text-[var(--color-text-secondary)]"
            >
              Sp&auml;ter entscheiden
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selected || setDualScenarioMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-[#F5A623] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#E09B1D] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {setDualScenarioMutation.isPending && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Confirm Selection
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modal, document.body);
}
