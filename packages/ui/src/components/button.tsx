"use client";

import * as React from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "outline"
  | "ghost";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render as a child element (e.g. anchor) */
  asChild?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-electric text-white hover:bg-electric-light active:bg-[#2563EB] disabled:bg-slate-20 disabled:text-slate-40",
  secondary:
    "bg-brand-blue text-white hover:bg-[#1E5AD4] active:bg-navy disabled:bg-slate-20 disabled:text-slate-40",
  danger:
    "bg-coral text-white hover:bg-coral-light active:bg-[#DC2626] disabled:bg-slate-20 disabled:text-slate-40",
  outline:
    "bg-transparent border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] active:bg-[var(--color-bg-tertiary)] disabled:border-slate-10 disabled:text-slate-40",
  ghost:
    "bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] active:bg-[var(--color-bg-tertiary)] disabled:text-slate-40",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-9 min-w-[44px] px-3 text-sm rounded-sm",
  md: "h-11 min-w-[44px] px-4 text-base rounded-md",
  lg: "h-13 min-w-[44px] px-6 text-lg rounded-lg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className = "", variant = "primary", size = "md", disabled, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={[
          "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:cursor-not-allowed",
          "min-h-[44px]", // WCAG 2.2 AA touch target
          variantStyles[variant],
          sizeStyles[size],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
