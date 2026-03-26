"use client";

import * as React from "react";

type AmpelColor = "GREEN" | "YELLOW" | "RED";

interface FreigrenzeBarProps {
  label: string;
  used: number;
  limit: number;
  ampel: AmpelColor;
}

const AMPEL_COLORS: Record<AmpelColor, string> = {
  GREEN: "#00B56A",
  YELLOW: "#F5A623",
  RED: "#EF4444",
};

function getAmpelForUsage(used: number, limit: number): AmpelColor {
  const ratio = used / limit;
  if (ratio >= 1) return "RED";
  if (ratio >= 0.8) return "YELLOW";
  return "GREEN";
}

export function FreigrenzeBar({ label, used, limit }: FreigrenzeBarProps) {
  const effectiveAmpel = getAmpelForUsage(Math.abs(used), limit);
  const color = AMPEL_COLORS[effectiveAmpel];
  const percentage = Math.min(Math.abs(used) / limit * 100, 100);
  const remaining = Math.max(limit - Math.abs(used), 0);
  const isExceeded = Math.abs(used) >= limit;

  const formatEur = (val: number) =>
    val.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {label}
        </span>
        <span className="text-sm tabular-nums text-[var(--color-text-secondary)]">
          {formatEur(Math.abs(used))} / {formatEur(limit)}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-bg-tertiary)]"
        role="progressbar"
        aria-valuenow={Math.abs(used)}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${label}: ${formatEur(Math.abs(used))} of ${formatEur(limit)}`}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
          }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-tertiary)]">
          {formatEur(remaining)} remaining
        </span>
        {isExceeded && (
          <span className="font-medium text-[#EF4444]">
            Freigrenze exceeded — taxable!
          </span>
        )}
        {!isExceeded && percentage >= 80 && (
          <span className="font-medium text-[#F5A623]">
            Approaching limit
          </span>
        )}
      </div>
    </div>
  );
}
