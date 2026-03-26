"use client";

import { useState } from "react";

export type AmpelStatus = "GREEN" | "YELLOW" | "RED" | "GRAY";

interface AmpelBadgeProps {
  status: AmpelStatus;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<
  AmpelStatus,
  { color: string; label: string; tooltip: string }
> = {
  GREEN: {
    color: "#00B56A",
    label: "Green",
    tooltip: "Automatisch klassifiziert",
  },
  YELLOW: {
    color: "#F5A623",
    label: "Yellow",
    tooltip: "Graubereich — Auswahl erforderlich",
  },
  RED: {
    color: "#EF4444",
    label: "Red",
    tooltip: "Manuelle Klassifikation erforderlich",
  },
  GRAY: {
    color: "#5A7A9E",
    label: "Gray",
    tooltip: "Steuerlich irrelevant",
  },
};

const SIZE_MAP = {
  sm: { circle: "h-2.5 w-2.5", wrapper: "" },
  md: { circle: "h-3.5 w-3.5", wrapper: "" },
};

export function AmpelBadge({ status, size = "md" }: AmpelBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = STATUS_CONFIG[status];
  const sizeConfig = SIZE_MAP[size];

  return (
    <div
      className={`relative inline-flex items-center ${sizeConfig.wrapper}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
    >
      <span
        className={`${sizeConfig.circle} inline-block rounded-full`}
        style={{ backgroundColor: config.color }}
        role="img"
        aria-label={`${config.label}: ${config.tooltip}`}
        tabIndex={0}
      />
      {showTooltip && (
        <div
          className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-bg-primary,#1a1a2e)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-primary,#e0e0e0)] shadow-lg"
          role="tooltip"
        >
          {config.tooltip}
          <span
            className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[var(--color-bg-primary,#1a1a2e)]"
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}
