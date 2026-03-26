"use client";

import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Error state */
  error?: boolean;
  /** Error message for accessibility */
  errorMessage?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error = false, errorMessage, type = "text", id, ...props }, ref) => {
    const errorId = errorMessage && id ? `${id}-error` : undefined;

    return (
      <div className="relative w-full">
        <input
          ref={ref}
          type={type}
          id={id}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={errorId}
          className={[
            "flex w-full rounded-md border px-3 py-2 text-base transition-colors duration-150",
            "min-h-[44px]", // WCAG 2.2 AA touch target
            "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]",
            "placeholder:text-[var(--color-text-tertiary)]",
            "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--color-bg-secondary)]",
            error
              ? "border-coral focus-visible:ring-coral/50"
              : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {error && errorMessage && (
          <p
            id={errorId}
            className="mt-1.5 text-sm text-coral dark:text-coral-light"
            role="alert"
          >
            {errorMessage}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
