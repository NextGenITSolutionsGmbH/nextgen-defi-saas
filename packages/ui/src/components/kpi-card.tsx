"use client";

import * as React from "react";

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lucide icon or any React node */
  icon: React.ReactNode;
  /** Card title / metric label */
  title: string;
  /** Main value display */
  value: string;
  /** Percentage or absolute change */
  change?: {
    value: string;
    trend: "up" | "down" | "neutral";
  };
  /** Additional context line */
  subtitle?: string;
}

export const KpiCard = React.forwardRef<HTMLDivElement, KpiCardProps>(
  ({ className = "", icon, title, value, change, subtitle, ...props }, ref) => {
    const trendColor =
      change?.trend === "up"
        ? "text-emerald dark:text-emerald-light"
        : change?.trend === "down"
          ? "text-coral dark:text-coral-light"
          : "text-[var(--color-text-tertiary)]";

    const trendArrow =
      change?.trend === "up" ? "\u2191" : change?.trend === "down" ? "\u2193" : "";

    return (
      <div
        ref={ref}
        className={[
          "rounded-md border p-4 transition-shadow duration-150",
          "bg-[var(--color-bg-card)] border-[var(--color-border-default)]",
          "shadow-card hover:shadow-card-hover",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        role="region"
        aria-label={`${title}: ${value}`}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric/10 text-electric dark:bg-electric-light/10 dark:text-electric-light"
              aria-hidden="true"
            >
              {icon}
            </span>
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">
              {title}
            </span>
          </div>
          {change && (
            <span
              className={["text-sm font-semibold tabular-nums", trendColor]
                .join(" ")}
              aria-label={`Change: ${change.value} ${change.trend}`}
            >
              {trendArrow} {change.value}
            </span>
          )}
        </div>

        <div className="mt-3">
          <span className="text-3xl font-bold tabular-nums text-[var(--color-text-primary)]">
            {value}
          </span>
        </div>

        {subtitle && (
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
            {subtitle}
          </p>
        )}
      </div>
    );
  }
);

KpiCard.displayName = "KpiCard";
