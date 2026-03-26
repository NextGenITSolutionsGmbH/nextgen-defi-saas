"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";

interface RecentTransaction {
  id: string;
  txHash: string;
  blockTimestamp: number;
  protocol: string | null;
  status: "GREEN" | "YELLOW" | "RED" | "GRAY";
  classificationType: string | null;
}

interface RecentTxTableProps {
  transactions: RecentTransaction[];
}

const STATUS_COLORS: Record<string, string> = {
  GREEN: "#00B56A",
  YELLOW: "#F5A623",
  RED: "#EF4444",
  GRAY: "#5A7A9E",
};

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function truncateHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-4)}`;
}

export function RecentTxTable({ transactions }: RecentTxTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-sm text-[var(--color-text-tertiary)]">
          No recent transactions found.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]">
            <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
              Status
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
            <th className="px-4 py-3 text-left font-medium text-[var(--color-text-secondary)]">
              Date
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr
              key={tx.id}
              className="border-b border-[var(--color-border-subtle)] transition hover:bg-[var(--color-bg-secondary)]"
            >
              {/* Ampel dot */}
              <td className="px-4 py-3">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[tx.status] ?? STATUS_COLORS.GRAY }}
                  title={tx.status}
                  aria-label={`Status: ${tx.status}`}
                />
              </td>

              {/* TX Hash linked to Flarescan */}
              <td className="px-4 py-3">
                <a
                  href={`https://flarescan.com/tx/${tx.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-[var(--color-text-link)] hover:underline"
                >
                  {truncateHash(tx.txHash)}
                  <ExternalLink size={12} className="opacity-50" />
                </a>
              </td>

              {/* Protocol */}
              <td className="px-4 py-3">
                {tx.protocol ? (
                  <span className="inline-block rounded-full bg-[var(--color-bg-tertiary)] px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--color-text-secondary)]">
                    {tx.protocol}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--color-text-tertiary)]">—</span>
                )}
              </td>

              {/* Classification type */}
              <td className="px-4 py-3">
                {tx.classificationType ? (
                  <span className="text-xs capitalize text-[var(--color-text-primary)]">
                    {tx.classificationType}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--color-text-tertiary)]">Unclassified</span>
                )}
              </td>

              {/* Date in DD.MM.YYYY */}
              <td className="px-4 py-3 text-xs tabular-nums text-[var(--color-text-tertiary)]">
                {formatDate(tx.blockTimestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
