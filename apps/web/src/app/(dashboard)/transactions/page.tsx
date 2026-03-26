"use client";

import { useState } from "react";
import { ArrowLeftRight, Filter } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

const CLASSIFICATIONS = [
  "swap",
  "transfer",
  "bridge",
  "stake",
  "unstake",
  "claim",
  "mint",
  "burn",
  "approve",
  "deposit",
  "withdraw",
  "other",
] as const;

export default function TransactionsPage() {
  const [filters, setFilters] = useState<{
    walletId?: string;
    classification?: string;
  }>({});

  const walletsQuery = trpc.wallet.list.useQuery();
  const transactionsQuery = trpc.transaction.list.useQuery({
    walletId: filters.walletId,
    classification: filters.classification,
    limit: 25,
  });

  const classifyMutation = trpc.transaction.classify.useMutation({
    onSuccess: () => transactionsQuery.refetch(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Transactions</h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          View and classify your DeFi transactions
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[var(--color-text-tertiary)]" />
          <select
            value={filters.walletId ?? ""}
            onChange={(e) =>
              setFilters((p) => ({ ...p, walletId: e.target.value || undefined }))
            }
            className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none"
          >
            <option value="">All Wallets</option>
            {walletsQuery.data?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label || w.address.slice(0, 10) + "..."}
              </option>
            ))}
          </select>
        </div>
        <select
          value={filters.classification ?? ""}
          onChange={(e) =>
            setFilters((p) => ({ ...p, classification: e.target.value || undefined }))
          }
          className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none"
        >
          <option value="">All Types</option>
          {CLASSIFICATIONS.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                Hash
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                Chain
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                From / To
              </th>
              <th className="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">
                Value
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                Type
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                Date
              </th>
              <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {transactionsQuery.isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[var(--color-text-tertiary)]">
                  Loading transactions...
                </td>
              </tr>
            )}
            {transactionsQuery.data?.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <ArrowLeftRight className="mx-auto mb-3 h-10 w-10 text-[var(--color-text-tertiary)]" />
                  <p className="text-[var(--color-text-tertiary)]">No transactions found</p>
                </td>
              </tr>
            )}
            {transactionsQuery.data?.items.map((tx) => (
              <tr
                key={tx.id}
                className="border-b border-[var(--color-border-subtle)] transition hover:bg-[var(--color-bg-secondary)]"
              >
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-link)]">
                  {tx.txHash.slice(0, 10)}...
                </td>
                <td className="px-4 py-3 capitalize text-[var(--color-text-primary)]">
                  {tx.protocol ?? "unknown"}
                </td>
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-[var(--color-text-secondary)]">
                    {tx.walletId.slice(0, 8)}...
                  </div>
                  <div className="font-mono text-xs text-[var(--color-text-tertiary)]">
                    &mdash;
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                  &mdash;
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full bg-[var(--color-bg-tertiary)] px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--color-text-secondary)]">
                    {tx.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--color-text-tertiary)]">
                  {new Date(Number(tx.blockTimestamp) * 1000).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        classifyMutation.mutate({
                          transactionId: tx.id,
                          classification: e.target.value as (typeof CLASSIFICATIONS)[number],
                        });
                      }
                    }}
                    className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-2 py-1 text-xs text-[var(--color-text-primary)] outline-none"
                  >
                    <option value="">Classify...</option>
                    {CLASSIFICATIONS.map((c) => (
                      <option key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {transactionsQuery.data?.nextCursor && (
        <div className="flex justify-center">
          <button
            onClick={() => {
              // TODO: Implement cursor-based pagination with state management
            }}
            className="rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
