"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/overview", icon: <LayoutDashboard size={20} /> },
  { label: "Transactions", href: "/transactions", icon: <ArrowLeftRight size={20} /> },
  { label: "Wallets", href: "/wallets", icon: <Wallet size={20} /> },
  { label: "Exports", href: "/exports", icon: <Download size={20} /> },
  { label: "Settings", href: "/settings", icon: <Settings size={20} /> },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[var(--color-bg-overlay)] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile toggle button */}
      <button
        type="button"
        className="fixed left-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-md bg-slate-90 text-white lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
      </button>

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-slate-90 text-slate-10 transition-all duration-200",
          // Width
          collapsed ? "w-[68px]" : "w-[240px]",
          // Mobile: hidden by default
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Sidebar header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-80 px-4">
          {!collapsed && (
            <span className="text-lg font-bold text-white">DeFi Tracker</span>
          )}
          <button
            type="button"
            className="hidden h-8 w-8 items-center justify-center rounded text-slate-20 hover:bg-slate-80 hover:text-white lg:flex"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="flex flex-col gap-1 px-2" role="list">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={[
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                      "min-h-[44px]", // WCAG touch target
                      "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-electric focus-visible:ring-offset-2 focus-visible:ring-offset-slate-90",
                      isActive
                        ? "bg-electric/15 text-electric-light"
                        : "text-slate-20 hover:bg-slate-80 hover:text-white",
                    ].join(" ")}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    <span
                      className={[
                        "flex-shrink-0",
                        isActive ? "text-electric-light" : "",
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                    {!collapsed && <span>{item.label}</span>}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-slate-80 p-4">
          {!collapsed && (
            <p className="text-2xs text-slate-40">
              NextGen IT Solutions GmbH
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
