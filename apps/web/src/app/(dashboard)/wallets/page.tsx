"use client";

import { useState } from "react";
import { Plus, RefreshCw, Trash2, Wallet } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

export default function WalletsPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWallet, setNewWallet] = useState({
    address: "",
    chain: "ethereum" as const,
    label: "",
  });

  const utils = trpc.useUtils();
  const walletsQuery = trpc.wallet.list.useQuery();
  const addMutation = trpc.wallet.add.useMutation({
    onSuccess: () => {
      utils.wallet.list.invalidate();
      setShowAddForm(false);
      setNewWallet({ address: "", chain: "ethereum", label: "" });
    },
  });
  const removeMutation = trpc.wallet.remove.useMutation({
    onSuccess: () => utils.wallet.list.invalidate(),
  });
  const syncMutation = trpc.wallet.sync.useMutation();

  const chains = ["ethereum", "polygon", "arbitrum", "optimism", "base", "solana", "bitcoin"] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Wallets</h1>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
            Manage your tracked wallets across chains
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-primary-hover)]"
        >
          <Plus size={16} />
          Add Wallet
        </button>
      </div>

      {showAddForm && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-6">
          <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
            Add New Wallet
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addMutation.mutate({
                address: newWallet.address,
                chain: newWallet.chain,
                label: newWallet.label || undefined,
              });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                Wallet Address
              </label>
              <input
                type="text"
                value={newWallet.address}
                onChange={(e) => setNewWallet((p) => ({ ...p, address: e.target.value }))}
                placeholder="0x..."
                className="mt-1 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                  Chain
                </label>
                <select
                  value={newWallet.chain}
                  onChange={(e) =>
                    setNewWallet((p) => ({ ...p, chain: e.target.value as typeof newWallet.chain }))
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
                >
                  {chains.map((c) => (
                    <option key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                  Label (optional)
                </label>
                <input
                  type="text"
                  value={newWallet.label}
                  onChange={(e) => setNewWallet((p) => ({ ...p, label: e.target.value }))}
                  placeholder="My main wallet"
                  className="mt-1 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={addMutation.isPending}
                className="rounded-lg bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-primary-hover)] disabled:opacity-50"
              >
                {addMutation.isPending ? "Adding..." : "Add Wallet"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
              >
                Cancel
              </button>
            </div>
            {addMutation.error && (
              <p className="text-sm text-[var(--color-accent-danger)]">
                {addMutation.error.message}
              </p>
            )}
          </form>
        </div>
      )}

      {walletsQuery.isLoading && (
        <div className="py-12 text-center text-[var(--color-text-tertiary)]">Loading wallets...</div>
      )}

      {walletsQuery.data && walletsQuery.data.length === 0 && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-12 text-center">
          <Wallet className="mx-auto mb-4 h-12 w-12 text-[var(--color-text-tertiary)]" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">No wallets yet</h3>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
            Add your first wallet to start tracking transactions.
          </p>
        </div>
      )}

      {walletsQuery.data && walletsQuery.data.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {walletsQuery.data.map((wallet) => (
            <div
              key={wallet.id}
              className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-5"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {wallet.label || "Unnamed Wallet"}
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-[var(--color-text-tertiary)]">
                    {wallet.address}
                  </p>
                </div>
                <span className="ml-2 rounded-full bg-[var(--color-bg-tertiary)] px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--color-text-secondary)]">
                  {wallet.chain}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
                <span>{wallet._count.transactions} transactions</span>
                <span>
                  {wallet.lastSyncedAt
                    ? `Synced ${new Date(wallet.lastSyncedAt).toLocaleDateString()}`
                    : "Never synced"}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => syncMutation.mutate({ walletId: wallet.id })}
                  disabled={syncMutation.isPending}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border-default)] py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
                >
                  <RefreshCw size={12} />
                  Sync
                </button>
                <button
                  onClick={() => {
                    if (confirm("Remove this wallet and all its transactions?")) {
                      removeMutation.mutate({ walletId: wallet.id });
                    }
                  }}
                  disabled={removeMutation.isPending}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-accent-danger)]/30 px-3 py-1.5 text-xs font-medium text-[var(--color-accent-danger)] transition hover:bg-[var(--color-accent-danger)]/10"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
