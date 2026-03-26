"use client";

import * as React from "react";
import { Sun, Moon, User, LogOut, ChevronDown } from "lucide-react";

export function Header() {
  const [darkMode, setDarkMode] = React.useState(true);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Toggle dark class on <html>
  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Close menu on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menu on Escape
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-4 lg:px-6">
      {/* Logo — visible on mobile (with offset for hamburger) */}
      <div className="flex items-center gap-3 pl-14 lg:pl-0">
        <span className="text-xl font-bold text-electric dark:text-electric-light">
          DeFi Tracker
        </span>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Dark/Light toggle */}
        <button
          type="button"
          onClick={() => setDarkMode(!darkMode)}
          className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-focus-ring)]"
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* User menu */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-focus-ring)]"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            aria-label="User menu"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-electric/15 text-electric">
              <User size={16} />
            </span>
            <span className="hidden sm:inline">Account</span>
            <ChevronDown
              size={14}
              className={[
                "transition-transform duration-150",
                menuOpen ? "rotate-180" : "",
              ].join(" ")}
              aria-hidden="true"
            />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-48 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-card)] shadow-dropdown animate-fade-in"
              role="menu"
              aria-label="User menu options"
            >
              <div className="p-1">
                <a
                  href="/settings"
                  className="flex min-h-[44px] items-center gap-2 rounded px-3 py-2 text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-focus-ring)]"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  <User size={16} aria-hidden="true" />
                  Profile Settings
                </a>
                <button
                  type="button"
                  className="flex w-full min-h-[44px] items-center gap-2 rounded px-3 py-2 text-sm text-coral transition-colors hover:bg-coral/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-focus-ring)]"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  <LogOut size={16} aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
