"use client";

import * as React from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-[var(--color-bg-primary)]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area — offset by sidebar width on desktop */}
      <div className="flex flex-1 flex-col lg:ml-[240px]">
        <Header />

        <main
          className="flex-1 overflow-auto p-4 lg:p-6"
          id="main-content"
          role="main"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
