"use client";

import * as React from "react";
import { Clock, PartyPopper } from "lucide-react";

interface HaltefristEntry {
  id: string;
  tokenSymbol: string;
  amount: number;
  daysRemaining: number;
  taxFreeDate: string;
}

interface HaltefristTrackerProps {
  entries: HaltefristEntry[];
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function getBadgeStyle(daysRemaining: number): { bg: string; text: string; border: string } {
  if (daysRemaining <= 7) {
    return { bg: "rgba(0, 181, 106, 0.1)", text: "#00B56A", border: "#00B56A" };
  }
  if (daysRemaining <= 30) {
    return { bg: "rgba(245, 166, 35, 0.1)", text: "#F5A623", border: "#F5A623" };
  }
  return {
    bg: "var(--color-bg-tertiary)",
    text: "var(--color-text-secondary)",
    border: "var(--color-border-default)",
  };
}

export function HaltefristTracker({ entries }: HaltefristTrackerProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <Clock className="mb-3 h-10 w-10 text-[var(--color-text-tertiary)]" />
        <p className="text-sm text-[var(--color-text-tertiary)]">
          No positions approaching the 1-year holding period.
        </p>
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) => a.daysRemaining - b.daysRemaining);

  return (
    <div className="space-y-3">
      {sorted.map((entry) => {
        const badge = getBadgeStyle(entry.daysRemaining);
        const isAlmostFree = entry.daysRemaining <= 7;

        return (
          <div
            key={entry.id}
            className="flex items-center justify-between rounded-lg border border-[var(--color-border-default)] px-4 py-3 transition hover:bg-[var(--color-bg-secondary)]"
          >
            <div className="flex items-center gap-3">
              {isAlmostFree ? (
                <PartyPopper size={18} style={{ color: "#00B56A" }} />
              ) : (
                <Clock size={18} className="text-[var(--color-text-tertiary)]" />
              )}
              <div>
                <span className="font-medium text-[var(--color-text-primary)]">
                  {entry.tokenSymbol}
                </span>
                <span className="ml-2 text-sm tabular-nums text-[var(--color-text-secondary)]">
                  {entry.amount.toLocaleString("de-DE", { maximumFractionDigits: 6 })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Days remaining badge */}
              <span
                className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tabular-nums"
                style={{
                  backgroundColor: badge.bg,
                  color: badge.text,
                  borderColor: badge.border,
                }}
              >
                {entry.daysRemaining === 0
                  ? "Tax-free today!"
                  : `${entry.daysRemaining}d remaining`}
              </span>

              {/* Tax-free date */}
              <span className="text-xs tabular-nums text-[var(--color-text-tertiary)]">
                {formatDate(entry.taxFreeDate)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
