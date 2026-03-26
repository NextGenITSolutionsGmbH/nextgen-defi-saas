"use client";
// @ts-nocheck

import { useState, useMemo } from "react";
import {
  ArrowLeftRight,
  Search,
  Check,
  Minus,
  ExternalLink,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import { AmpelBadge } from "@/components/transactions/ampel-badge";
import type { AmpelStatus } from "@/components/transactions/ampel-badge";
import { ClassifyModal } from "@/components/transactions/classify-modal";
import { DualScenarioModal } from "@/components/transactions/dual-scenario-modal";

// Ampel color map for status chips
const STATUS_COLORS: Record<AmpelStatus, { bg: string; text: string; dot: string }> = {
  GREEN: { bg: "bg-[#00B56A]/10", text: "text-[#00B56A]", dot: "#00B56A" },
  YELLOW: { bg: "bg-[#F5A623]/10", text: "text-[#F5A623]", dot: "#F5A623" },
  RED: { bg: "bg-[#EF4444]/10", text: "text-[#EF4444]", dot: "#EF4444" },
  GRAY: { bg: "bg-[#5A7A9E]/10", text: "text-[#5A7A9E]", dot: "#5A7A9E" },
};

const STATUS_LABELS: Record<AmpelStatus, string> = {
  GREEN: "Green (auto)",
  YELLOW: "Yellow (Graubereich)",
  RED: "Red (manual needed)",
  GRAY: "Gray (irrelevant)",
};

const PROTOCOLS = [
  "SparkDEX",
  "Enosys",
  "Kinetic Market",
  "Flare Network",
] as const;

// Helper to convert Prisma Decimal / superjson / number / string to number
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return isNaN(value) ? null : value;
  if (typeof value === "string") { const n = parseFloat(value); return isNaN(n) ? null : n; }
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  const n = Number(value);
  return isNaN(n) ? null : n;
}

// Format number in German style with comma decimal
function formatNumber(value: unknown): string {
  const num = toNumber(value);
  if (num === null) return "\u2014";
  return num.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

// Format EUR value
function formatEur(value: unknown): string {
  const num = toNumber(value);
  if (num === null) return "\u2014";
  return `${num.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} \u20AC`;
}

// Format date in DD.MM.YYYY HH:MM (German format)
function formatDate(blockTimestamp: bigint | number): string {
  const ts = typeof blockTimestamp === "bigint" ? Number(blockTimestamp) : blockTimestamp;
  const date = new Date(ts * 1000);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Truncate TX hash for display
function truncateHash(hash: string): string {
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

export default function TransactionsPage() {
  const [statusFilter, setStatusFilter] = useState<AmpelStatus | null>(null);
  const [protocolFilter, setProtocolFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Modal state
  const [classifyModal, setClassifyModal] = useState<{
    transactionId: string;
    txHash: string;
  } | null>(null);
  const [dualScenarioModal, setDualScenarioModal] = useState<{
    transactionId: string;
    txHash: string;
    protocol: string | null;
  } | null>(null);

  // Type for transaction items from the list query
  // Using unknown for Prisma Decimal types — we convert to number when needed
  type TransactionItem = {
    id: string;
    txHash: string;
    protocol: string | null;
    blockTimestamp: bigint;
    walletId: string;
    status: string;
    legs: {
      id: string;
      legIndex: number;
      direction: string;
      tokenSymbol: string;
      amount: unknown;
      eurValue: unknown;
    }[];
    _count: { classifications: number };
  };

  // Loaded pages for cursor-based pagination
  const [allItems, setAllItems] = useState<TransactionItem[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined);
  const [hasLoadedMore, setHasLoadedMore] = useState(false);

  const statsQuery = trpc.transaction.stats.useQuery();

  const transactionsQuery = trpc.transaction.list.useQuery({
    status: statusFilter ?? undefined,
    protocol: protocolFilter || undefined,
    search: searchQuery || undefined,
    cursor: hasLoadedMore ? currentCursor : undefined,
    limit: 25,
  });

  // Derive display items: merge loaded items with current query
  const displayItems = useMemo(() => {
    if (!transactionsQuery.data) return [] as TransactionItem[];
    const items = transactionsQuery.data.items as TransactionItem[];
    if (hasLoadedMore && allItems.length > 0) {
      // Deduplicate by id
      const seen = new Set(allItems.map((item) => item.id));
      const newItems = items.filter((item) => !seen.has(item.id));
      return [...allItems, ...newItems];
    }
    return items;
  }, [transactionsQuery.data, allItems, hasLoadedMore]);

  const handleLoadMore = () => {
    if (!transactionsQuery.data?.nextCursor) return;
    setAllItems(displayItems);
    setCurrentCursor(transactionsQuery.data.nextCursor);
    setHasLoadedMore(true);
  };

  const handleFilterChange = () => {
    setAllItems([]);
    setCurrentCursor(undefined);
    setHasLoadedMore(false);
  };

  const handleStatusFilter = (status: AmpelStatus | null) => {
    setStatusFilter(status);
    handleFilterChange();
  };

  const handleProtocolFilter = (protocol: string) => {
    setProtocolFilter(protocol);
    handleFilterChange();
  };

  const handleSearch = () => {
    setSearchQuery(searchInput);
    handleFilterChange();
  };

  const handleRefetch = () => {
    transactionsQuery.refetch();
    statsQuery.refetch();
  };

  const statusCounts = statsQuery.data?.byStatus ?? {
    GREEN: 0,
    YELLOW: 0,
    RED: 0,
    GRAY: 0,
  };
  const totalCount = statsQuery.data?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Transactions
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          View, classify, and manage your DeFi transactions with the Ampel system
        </p>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {/* All chip */}
        <button
          type="button"
          onClick={() => handleStatusFilter(null)}
          className={[
            "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
            statusFilter === null
              ? "bg-[var(--color-text-primary)] text-[var(--color-bg-primary)]"
              : "border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]",
          ].join(" ")}
        >
          All
          <span
            className={[
              "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold",
              statusFilter === null
                ? "bg-white/20 text-[var(--color-bg-primary)]"
                : "bg-[var(--color-bg-tertiary,#2a2a4a)] text-[var(--color-text-tertiary)]",
            ].join(" ")}
          >
            {totalCount}
          </span>
        </button>

        {/* Status chips */}
        {(["GREEN", "YELLOW", "RED", "GRAY"] as AmpelStatus[]).map((status) => {
          const colors = STATUS_COLORS[status];
          const isActive = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => handleStatusFilter(isActive ? null : status)}
              className={[
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                isActive
                  ? `${colors.bg} ${colors.text} ring-1 ring-current`
                  : "border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]",
              ].join(" ")}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: colors.dot }}
                aria-hidden="true"
              />
              {STATUS_LABELS[status]}
              <span
                className={[
                  "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                  isActive
                    ? `${colors.bg} ${colors.text}`
                    : "bg-[var(--color-bg-tertiary,#2a2a4a)] text-[var(--color-text-tertiary)]",
                ].join(" ")}
              >
                {statusCounts[status] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Protocol filter + Search */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Protocol filter */}
        <div className="relative">
          <select
            value={protocolFilter}
            onChange={(e) => handleProtocolFilter(e.target.value)}
            className="appearance-none rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] py-2 pl-3 pr-8 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus,#6366f1)] focus:ring-2 focus:ring-[var(--color-border-focus,#6366f1)]/20"
          >
            <option value="">All Protocols</option>
            {PROTOCOLS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          />
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="Search by TX hash..."
            className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-border-focus,#6366f1)] focus:ring-2 focus:ring-[var(--color-border-focus,#6366f1)]/20"
          />
        </div>
      </div>

      {/* Transaction Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
              <th className="w-12 px-4 py-3 text-center font-medium text-[var(--color-text-secondary)]">
                Ampel
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                TX Hash
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                Protocol
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                Type
              </th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                Buy
              </th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                Sell
              </th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                EUR Value
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                Date
              </th>
              <th className="px-4 py-3 text-center font-medium text-[var(--color-text-secondary)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Loading skeleton */}
            {transactionsQuery.isLoading && (
              <>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr
                    key={`skeleton-${i}`}
                    className="border-b border-[var(--color-border-subtle)]"
                  >
                    <td className="px-4 py-3 text-center">
                      <div className="mx-auto h-3.5 w-3.5 animate-pulse rounded-full bg-[var(--color-bg-tertiary,#2a2a4a)]" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-bg-tertiary,#2a2a4a)]" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-20 animate-pulse rounded bg-[var(--color-bg-tertiary,#2a2a4a)]" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-5 w-16 animate-pulse rounded-full bg-[var(--color-bg-tertiary,#2a2a4a)]" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="ml-auto h-4 w-24 animate-pulse rounded bg-[var(--color-bg-tertiary,#2a2a4a)]" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="ml-auto h-4 w-24 animate-pulse rounded bg-[var(--color-bg-tertiary,#2a2a4a)]" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="ml-auto h-4 w-20 animate-pulse rounded bg-[var(--color-bg-tertiary,#2a2a4a)]" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-28 animate-pulse rounded bg-[var(--color-bg-tertiary,#2a2a4a)]" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="mx-auto h-7 w-24 animate-pulse rounded bg-[var(--color-bg-tertiary,#2a2a4a)]" />
                    </td>
                  </tr>
                ))}
              </>
            )}

            {/* Empty state */}
            {!transactionsQuery.isLoading && displayItems.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center">
                  <ArrowLeftRight className="mx-auto mb-3 h-12 w-12 text-[var(--color-text-tertiary)]" />
                  <p className="text-base font-medium text-[var(--color-text-secondary)]">
                    No transactions found
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
                    {searchQuery
                      ? "Try adjusting your search or filters"
                      : "Transactions will appear here once your wallets are synced"}
                  </p>
                </td>
              </tr>
            )}

            {/* Transaction rows */}
            {displayItems.map((tx) => {
              // Extract buy/sell legs
              const buyLeg = tx.legs?.find(
                (leg) => leg.direction === "IN"
              );
              const sellLeg = tx.legs?.find(
                (leg) => leg.direction === "OUT"
              );

              // Compute total EUR value from legs
              const totalEur = tx.legs?.reduce(
                (sum, leg) => {
                  const val = toNumber(leg.eurValue);
                  return sum + (val ?? 0);
                },
                0
              );

              const hasClassification = (tx._count?.classifications ?? 0) > 0;
              const txStatus = tx.status as AmpelStatus;

              return (
                <tr
                  key={tx.id}
                  className="border-b border-[var(--color-border-subtle)] transition hover:bg-[var(--color-bg-secondary)]"
                >
                  {/* Ampel */}
                  <td className="px-4 py-3 text-center">
                    <AmpelBadge status={txStatus} size="md" />
                  </td>

                  {/* TX Hash */}
                  <td className="px-4 py-3">
                    <a
                      href={`https://flarescan.com/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-1.5 font-mono text-xs text-[var(--color-text-link,#818cf8)] transition hover:underline"
                    >
                      {truncateHash(tx.txHash)}
                      <ExternalLink
                        size={12}
                        className="opacity-0 transition group-hover:opacity-100"
                      />
                    </a>
                  </td>

                  {/* Protocol */}
                  <td className="px-4 py-3">
                    {tx.protocol ? (
                      <span className="inline-block rounded-full bg-[var(--color-bg-tertiary,#2a2a4a)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                        {tx.protocol}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        —
                      </span>
                    )}
                  </td>

                  {/* Type (CT type badge) */}
                  <td className="px-4 py-3">
                    {hasClassification ? (
                      <span className="inline-block rounded-full bg-[#00B56A]/10 px-2.5 py-0.5 text-xs font-medium text-[#00B56A]">
                        Classified
                      </span>
                    ) : txStatus === "YELLOW" ? (
                      <span className="inline-block rounded-full bg-[#F5A623]/10 px-2.5 py-0.5 text-xs font-medium text-[#F5A623]">
                        Graubereich
                      </span>
                    ) : txStatus === "RED" ? (
                      <span className="inline-block rounded-full bg-[#EF4444]/10 px-2.5 py-0.5 text-xs font-medium text-[#EF4444]">
                        Unclassified
                      </span>
                    ) : txStatus === "GREEN" ? (
                      <span className="inline-block rounded-full bg-[#00B56A]/10 px-2.5 py-0.5 text-xs font-medium text-[#00B56A]">
                        Auto
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-[#5A7A9E]/10 px-2.5 py-0.5 text-xs font-medium text-[#5A7A9E]">
                        Irrelevant
                      </span>
                    )}
                  </td>

                  {/* Buy */}
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                    {buyLeg ? (
                      <span className="text-xs">
                        {formatNumber(buyLeg.amount)}{" "}
                        <span className="text-[var(--color-text-tertiary)]">
                          {buyLeg.tokenSymbol}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        —
                      </span>
                    )}
                  </td>

                  {/* Sell */}
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                    {sellLeg ? (
                      <span className="text-xs">
                        {formatNumber(sellLeg.amount)}{" "}
                        <span className="text-[var(--color-text-tertiary)]">
                          {sellLeg.tokenSymbol}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        —
                      </span>
                    )}
                  </td>

                  {/* EUR Value */}
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                    <span className="text-xs">
                      {formatEur(totalEur)}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-xs text-[var(--color-text-tertiary)]">
                    {formatDate(tx.blockTimestamp)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-center">
                    {txStatus === "GREEN" && (
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#00B56A]/10"
                        title="Automatically classified"
                      >
                        <Check size={14} className="text-[#00B56A]" />
                      </span>
                    )}
                    {txStatus === "YELLOW" && (
                      <button
                        type="button"
                        onClick={() =>
                          setDualScenarioModal({
                            transactionId: tx.id,
                            txHash: tx.txHash,
                            protocol: tx.protocol,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-[#F5A623]/15 px-3 py-1.5 text-xs font-medium text-[#F5A623] transition hover:bg-[#F5A623]/25"
                      >
                        Choose Model
                      </button>
                    )}
                    {txStatus === "RED" && (
                      <button
                        type="button"
                        onClick={() =>
                          setClassifyModal({
                            transactionId: tx.id,
                            txHash: tx.txHash,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-[#EF4444]/15 px-3 py-1.5 text-xs font-medium text-[#EF4444] transition hover:bg-[#EF4444]/25"
                      >
                        Classify
                      </button>
                    )}
                    {txStatus === "GRAY" && (
                      <span className="inline-flex h-7 w-7 items-center justify-center">
                        <Minus
                          size={14}
                          className="text-[var(--color-text-tertiary)]"
                        />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Showing {displayItems.length}
          {transactionsQuery.data?.totalCount
            ? ` of ${transactionsQuery.data.totalCount}`
            : ""}{" "}
          transactions
        </p>

        {transactionsQuery.data?.nextCursor && (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={transactionsQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {transactionsQuery.isFetching && (
              <Loader2 size={14} className="animate-spin" />
            )}
            Load More
          </button>
        )}
      </div>

      {/* Modals */}
      {classifyModal && (
        <ClassifyModal
          transactionId={classifyModal.transactionId}
          txHash={classifyModal.txHash}
          onClose={() => setClassifyModal(null)}
          onClassified={handleRefetch}
        />
      )}

      {dualScenarioModal && (
        <DualScenarioModal
          transactionId={dualScenarioModal.transactionId}
          txHash={dualScenarioModal.txHash}
          protocol={dualScenarioModal.protocol}
          onClose={() => setDualScenarioModal(null)}
          onSelected={handleRefetch}
        />
      )}
    </div>
  );
}
