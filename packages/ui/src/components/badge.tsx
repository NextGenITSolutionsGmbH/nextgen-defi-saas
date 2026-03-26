"use client";

import * as React from "react";

export type BadgeStatus = "success" | "warning" | "danger" | "neutral";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: BadgeStatus;
}

const statusStyles: Record<BadgeStatus, string> = {
  success:
    "bg-emerald/15 text-emerald dark:bg-emerald-light/15 dark:text-emerald-light border-emerald/25 dark:border-emerald-light/25",
  warning:
    "bg-amber/15 text-amber dark:bg-amber-light/15 dark:text-amber-light border-amber/25 dark:border-amber-light/25",
  danger:
    "bg-coral/15 text-coral dark:bg-coral-light/15 dark:text-coral-light border-coral/25 dark:border-coral-light/25",
  neutral:
    "bg-slate-40/15 text-slate-40 dark:bg-slate-20/15 dark:text-slate-20 border-slate-40/25 dark:border-slate-20/25",
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = "", status = "neutral", children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={[
          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
          "transition-colors duration-150",
          statusStyles[status],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";
