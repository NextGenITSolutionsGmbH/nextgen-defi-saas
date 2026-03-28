"use client";

import {
  ArrowLeftRight,
  CheckCircle2,
  ShieldCheck,
  Coins,
  TrendingUp,
  TrendingDown,
  Shield,
  Wallet,
} from "lucide-react";
import { KpiCard } from "@defi-tracker/ui";
import { trpc } from "@/lib/trpc-client";

const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function formatEurSigned(value: number): string {
  const formatted = eurFormatter.format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export default function DashboardPage() {
  const portfolioQuery = trpc.dashboard.portfolioSummary.useQuery();

  const portfolio = portfolioQuery.data;

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
          title="§23 Freigrenze"
          value="€582.40"
          change={{ value: "-€17.60", trend: "down" }}
          subtitle="of €600 annual limit"
        />
        <KpiCard
          icon={<Coins size={20} />}
          title="§22 Freigrenze"
          value="€256.00"
          change={{ value: "+€48.00", trend: "up" }}
          subtitle="of €256 annual limit (Staking)"
        />
      </div>

      {/* Portfolio & Tax Overview */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
          Portfolio &amp; Tax Overview
          {portfolio ? ` \u2014 ${portfolio.taxYear}` : ""}
        </h2>
        {portfolioQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[140px] animate-pulse rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-card)]"
              />
            ))}
          </div>
        ) : portfolioQuery.isError ? (
          <div className="rounded-md border border-[var(--color-accent-danger)]/20 bg-[var(--color-accent-danger)]/5 p-4 text-sm text-[var(--color-accent-danger)]">
            Failed to load portfolio summary.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              icon={
                (portfolio?.netGainLoss ?? 0) >= 0 ? (
                  <TrendingUp size={20} />
                ) : (
                  <TrendingDown size={20} />
                )
              }
              title="Net P&L"
              value={formatEurSigned(portfolio?.netGainLoss ?? 0)}
              change={{
                value: eurFormatter.format(portfolio?.realizedLosses ?? 0),
                trend:
                  (portfolio?.netGainLoss ?? 0) > 0
                    ? "up"
                    : (portfolio?.netGainLoss ?? 0) < 0
                      ? "down"
                      : "neutral",
              }}
              subtitle={`Gains: ${eurFormatter.format(portfolio?.realizedGains ?? 0)} / Losses: ${eurFormatter.format(portfolio?.realizedLosses ?? 0)}`}
            />
            <KpiCard
              icon={<TrendingUp size={20} />}
              title="Taxable Gains"
              value={eurFormatter.format(portfolio?.taxableGains ?? 0)}
              change={{
                value:
                  (portfolio?.taxableGains ?? 0) > 1000
                    ? "Above \u20AC1.000 limit"
                    : "Below \u20AC1.000 limit",
                trend:
                  (portfolio?.taxableGains ?? 0) > 1000 ? "down" : "up",
              }}
              subtitle={"Holding period \u2264 365 days"}
            />
            <KpiCard
              icon={<Shield size={20} />}
              title="Tax-Free Gains"
              value={eurFormatter.format(portfolio?.taxFreeGains ?? 0)}
              change={{
                value: (portfolio?.taxFreeGains ?? 0) > 0 ? "Tax exempt" : "None yet",
                trend: "neutral",
              }}
              subtitle="Holding period > 365 days"
            />
            <KpiCard
              icon={<Wallet size={20} />}
              title="Open Positions"
              value={String(portfolio?.openPositions ?? 0)}
              subtitle={`Cost basis: ${eurFormatter.format(portfolio?.totalCostBasis ?? 0)}`}
            />
          </div>
        )}
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
