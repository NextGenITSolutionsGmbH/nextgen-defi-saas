"use client";
// @ts-nocheck

import * as React from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  ShieldCheck,
  Coins,
  BarChart3,
  Clock,
  List,
} from "lucide-react";
import { KpiCard } from "@defi-tracker/ui";
import { trpc } from "@/lib/trpc-client";
import { AmpelDonut } from "@/components/dashboard/ampel-donut";
import { FreigrenzeBar } from "@/components/dashboard/freigrenze-bar";
import { RecentTxTable } from "@/components/dashboard/recent-tx-table";
import { HaltefristTracker } from "@/components/dashboard/haltefrist-tracker";

const AMPEL_COLORS: Record<string, string> = {
  GREEN: "#00B56A",
  YELLOW: "#F5A623",
  RED: "#EF4444",
  GRAY: "#5A7A9E",
};

function getFreigrenzeAmpel(used: number, limit: number): "GREEN" | "YELLOW" | "RED" {
  const ratio = Math.abs(used) / limit;
  if (ratio >= 1) return "RED";
  if (ratio >= 0.8) return "YELLOW";
  return "GREEN";
}

/** Skeleton placeholder block */
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[var(--color-bg-tertiary)] ${className}`}
      aria-hidden="true"
    />
  );
}

/** Card wrapper used for widget sections */
function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        {icon && (
          <span className="text-[var(--color-text-tertiary)]">{icon}</span>
        )}
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

/** Monthly activity sparkline built with pure SVG */
function MonthlySparkline({
  data,
}: {
  data: { month: string; txCount: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--color-text-tertiary)]">
        No activity data available.
      </p>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.txCount), 1);
  const barWidth = 100 / data.length;

  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 100 50"
        preserveAspectRatio="none"
        className="h-32 w-full"
        aria-label="Monthly transaction activity chart"
      >
        {data.map((d, i) => {
          const height = (d.txCount / maxCount) * 44;
          const x = i * barWidth + barWidth * 0.15;
          const width = barWidth * 0.7;
          return (
            <rect
              key={d.month}
              x={x}
              y={50 - height - 3}
              width={width}
              height={Math.max(height, 0.5)}
              rx="0.5"
              fill="var(--color-accent-primary, #1E6FFF)"
              opacity={0.85}
              className="transition-all duration-300"
            >
              <title>
                {d.month}: {d.txCount} TX
              </title>
            </rect>
          );
        })}
      </svg>

      {/* Month labels */}
      <div className="flex justify-between text-[10px] text-[var(--color-text-tertiary)]">
        {data.map((d) => (
          <span key={d.month} className="flex-1 text-center tabular-nums">
            {d.month.slice(5)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const kpisQuery = trpc.dashboard.kpis.useQuery();
  const ampelQuery = trpc.dashboard.ampelBreakdown.useQuery();
  const recentTxQuery = trpc.dashboard.recentTransactions.useQuery();
  const monthlyQuery = trpc.dashboard.monthlyActivity.useQuery();
  const haltefristQuery = trpc.dashboard.haltefristUpcoming.useQuery();

  const kpis = kpisQuery.data;
  const ampelData = ampelQuery.data;
  const recentTx = recentTxQuery.data;
  const monthlyData = monthlyQuery.data;
  const haltefristData = haltefristQuery.data;

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

      {/* ========== Row 1: KPI Cards ========== */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpisQuery.isLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <KpiCard
              icon={<ArrowLeftRight size={20} />}
              title="Total TX"
              value={
                kpis
                  ? kpis.totalTransactions.toLocaleString("de-DE")
                  : "0"
              }
              subtitle={
                kpis
                  ? `Last 30 days: ${kpis.recentTxCount.toLocaleString("de-DE")}`
                  : "Last 30 days: 0"
              }
            />
            <KpiCard
              icon={<CheckCircle2 size={20} />}
              title="Classified"
              value={kpis ? `${kpis.classifiedPercentage}%` : "0%"}
              subtitle={
                kpis
                  ? `${kpis.classifiedTxCount.toLocaleString("de-DE")} of ${kpis.totalTransactions.toLocaleString("de-DE")} transactions`
                  : "0 of 0 transactions"
              }
            />
            <KpiCard
              icon={<ShieldCheck size={20} />}
              title={"\u00A723 Freigrenze"}
              value={
                kpis
                  ? `\u20AC${Math.abs(kpis.paragraph23Used).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "\u20AC0,00"
              }
              subtitle={
                kpis
                  ? `of \u20AC${kpis.paragraph23Limit.toLocaleString("de-DE")} annual limit`
                  : "of \u20AC1.000 annual limit"
              }
              change={
                kpis
                  ? {
                      value: `${Math.round(Math.abs(kpis.paragraph23Used) / kpis.paragraph23Limit * 100)}%`,
                      trend:
                        Math.abs(kpis.paragraph23Used) >= kpis.paragraph23Limit
                          ? "down"
                          : "up",
                    }
                  : undefined
              }
            />
            <KpiCard
              icon={<Coins size={20} />}
              title={"\u00A722 Freigrenze"}
              value={
                kpis
                  ? `\u20AC${Math.abs(kpis.paragraph22Nr3Used).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "\u20AC0,00"
              }
              subtitle={
                kpis
                  ? `of \u20AC${kpis.paragraph22Nr3Limit.toLocaleString("de-DE")} annual limit (Staking)`
                  : "of \u20AC256 annual limit (Staking)"
              }
              change={
                kpis
                  ? {
                      value: `${Math.round(Math.abs(kpis.paragraph22Nr3Used) / kpis.paragraph22Nr3Limit * 100)}%`,
                      trend:
                        Math.abs(kpis.paragraph22Nr3Used) >= kpis.paragraph22Nr3Limit
                          ? "down"
                          : "up",
                    }
                  : undefined
              }
            />
          </>
        )}
      </div>

      {/* ========== Row 2: Ampel Donut + Monthly Activity ========== */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Ampel Classification" icon={<ShieldCheck size={18} />}>
          {ampelQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Skeleton className="h-40 w-40 rounded-full" />
            </div>
          ) : (
            <AmpelDonut
              data={
                ampelData?.map((d) => ({
                  status: d.status,
                  count: d.count,
                  color: AMPEL_COLORS[d.status] ?? AMPEL_COLORS.GRAY,
                })) ?? []
              }
            />
          )}
        </SectionCard>

        <SectionCard title="Monthly Activity" icon={<BarChart3 size={18} />}>
          {monthlyQuery.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <MonthlySparkline data={monthlyData ?? []} />
          )}
        </SectionCard>
      </div>

      {/* ========== Row 3: Freigrenze Progress Bars ========== */}
      <SectionCard title="Freigrenze Progress" icon={<ShieldCheck size={18} />}>
        {kpisQuery.isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <FreigrenzeBar
              label={"\u00A723 EStG — Private Sales (Veraeusserungsgewinne)"}
              used={kpis?.paragraph23Used ?? 0}
              limit={kpis?.paragraph23Limit ?? 1000}
              ampel={getFreigrenzeAmpel(
                kpis?.paragraph23Used ?? 0,
                kpis?.paragraph23Limit ?? 1000
              )}
            />
            <FreigrenzeBar
              label={"\u00A722 Nr. 3 EStG — Staking / Lending Rewards"}
              used={kpis?.paragraph22Nr3Used ?? 0}
              limit={kpis?.paragraph22Nr3Limit ?? 256}
              ampel={getFreigrenzeAmpel(
                kpis?.paragraph22Nr3Used ?? 0,
                kpis?.paragraph22Nr3Limit ?? 256
              )}
            />
          </div>
        )}
      </SectionCard>

      {/* ========== Row 4: Recent Transactions ========== */}
      <SectionCard title="Recent Transactions" icon={<List size={18} />}>
        {recentTxQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <RecentTxTable transactions={recentTx ?? []} />
        )}
      </SectionCard>

      {/* ========== Row 5: Haltefrist Tracker ========== */}
      <SectionCard title="Haltefrist Tracker" icon={<Clock size={18} />}>
        {haltefristQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <HaltefristTracker entries={haltefristData ?? []} />
        )}
      </SectionCard>
    </div>
  );
}
