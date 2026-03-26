"use client";

import {
  ArrowLeftRight,
  CheckCircle2,
  ShieldCheck,
  Coins,
} from "lucide-react";
import { KpiCard } from "@defi-tracker/ui";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          Overview of your DeFi tax tracking status
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<ArrowLeftRight size={20} />}
          title="Total TX"
          value="1,248"
          change={{ value: "+12.5%", trend: "up" }}
          subtitle="Last 30 days"
        />
        <KpiCard
          icon={<CheckCircle2 size={20} />}
          title="Classified"
          value="94.2%"
          change={{ value: "+3.1%", trend: "up" }}
          subtitle="1,176 of 1,248 transactions"
        />
        <KpiCard
          icon={<ShieldCheck size={20} />}
          title={"\u00A723 Freigrenze"}
          value="\u20AC582.40"
          change={{ value: "-\u20AC17.60", trend: "down" }}
          subtitle="of \u20AC600 annual limit"
        />
        <KpiCard
          icon={<Coins size={20} />}
          title={"\u00A722 Freigrenze"}
          value="\u20AC256.00"
          change={{ value: "+\u20AC48.00", trend: "up" }}
          subtitle="of \u20AC256 annual limit (Staking)"
        />
      </div>

      {/* Placeholder content area */}
      <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-8 text-center">
        <p className="text-[var(--color-text-tertiary)]">
          Transaction charts and recent activity will appear here.
        </p>
      </div>
    </div>
  );
}
