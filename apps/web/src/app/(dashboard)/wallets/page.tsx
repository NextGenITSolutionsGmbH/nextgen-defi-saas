"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, RefreshCw, Trash2, Wallet, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import {
  connectMetaMask,
  MetaMaskNotInstalledError,
  UserRejectedError,
  isMetaMaskAvailable,
} from "@/lib/wallet-connect";

// ---------- chain helpers ----------
const chains = ["flare", "ethereum", "polygon", "arbitrum", "optimism", "base", "solana", "bitcoin"] as const;
type Chain = (typeof chains)[number];

const CHAIN_ID_TO_NAME: Record<number, string> = {
  14: "Flare",
  1: "Ethereum",
  137: "Polygon",
  42161: "Arbitrum",
  10: "Optimism",
  8453: "Base",
  0: "Solana",
  [-1]: "Bitcoin",
};

function chainName(chainId: number): string {
  return CHAIN_ID_TO_NAME[chainId] ?? `Chain ${chainId}`;
}

// ---------- WalletCard sub-component with sync polling ----------
interface WalletItem {
  id: string;
  address: string;
  chainId: number;
  label: string | null;
  syncStatus: string;
  lastSyncAt: Date | null;
  lastSyncBlock: bigint | null;
  createdAt: Date;
  _count: { transactions: number };
}

function WalletCard({
  wallet,
  onRemove,
  removePending,
}: {
  wallet: WalletItem;
  onRemove: (walletId: string) => void;
  removePending: boolean;
}) {
  const utils = trpc.useUtils();

  // Local optimistic syncing state — set to true immediately when the user
  // clicks Sync and reset once the polled status resolves to non-SYNCING.
  const [optimisticSyncing, setOptimisticSyncing] = useState(false);

  const isSyncing = wallet.syncStatus === "SYNCING" || optimisticSyncing;

  // Poll syncStatus while syncing
  const { data: syncData } = trpc.wallet.syncStatus.useQuery(
    { walletId: wallet.id },
    {
      enabled: isSyncing,
      refetchInterval: 3000,
    }
  );

  // When poll reports completed/error, refresh the wallet list and stop optimistic state
  useEffect(() => {
    if (!syncData) return;
    if (syncData.syncStatus === "COMPLETED" || syncData.syncStatus === "ERROR") {
      setOptimisticSyncing(false);
      utils.wallet.list.invalidate();
    }
  }, [syncData, utils.wallet.list]);

  const syncMutation = trpc.wallet.sync.useMutation({
    onSuccess: () => {
      setOptimisticSyncing(true);
    },
  });

  return (
    <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {wallet.label || "Unnamed Wallet"}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-[var(--color-text-tertiary)]">
            {wallet.address}
          </p>
        </div>
        <span className="ml-2 rounded-full bg-[var(--color-bg-tertiary)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
          {chainName(wallet.chainId)}
        </span>
      </div>

      {/* Sync status / metadata row */}
      <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
        <span>{(wallet._count as { transactions: number }).transactions} transactions</span>
        {isSyncing ? (
          <span className="flex items-center gap-1 text-[var(--color-accent-primary)]">
            <Loader2 size={12} className="animate-spin" />
            Syncing...
          </span>
        ) : wallet.syncStatus === "ERROR" ? (
          <span className="text-[var(--color-accent-danger)]">Sync failed</span>
        ) : (
          <span>
            {wallet.lastSyncAt
              ? `Synced ${new Date(wallet.lastSyncAt).toLocaleDateString("de-DE")}`
              : "Never synced"}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => syncMutation.mutate({ walletId: wallet.id })}
          disabled={isSyncing || syncMutation.isPending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border-default)] py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
        >
          {isSyncing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <RefreshCw size={12} />
          )}
          {isSyncing ? "Syncing..." : "Sync"}
        </button>
        <button
          onClick={() => {
            if (confirm("Remove this wallet and all its transactions?")) {
              onRemove(wallet.id);
            }
          }}
          disabled={removePending}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-accent-danger)]/30 px-3 py-1.5 text-xs font-medium text-[var(--color-accent-danger)] transition hover:bg-[var(--color-accent-danger)]/10"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ---------- Main page component ----------
export default function WalletsPage() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [newWallet, setNewWallet] = useState<{
    address: string;
    chain: Chain;
    label: string;
    connectionMethod: "metamask" | "walletconnect" | "manual";
  }>({
    address: "",
    chain: "flare",
    label: "",
    connectionMethod: "manual",
  });

  const utils = trpc.useUtils();
  const walletsQuery = trpc.wallet.list.useQuery();
  const addMutation = trpc.wallet.add.useMutation({
    onSuccess: () => {
      utils.wallet.list.invalidate();
      setShowAddForm(false);
      setConnectError(null);
      setNewWallet({ address: "", chain: "flare", label: "", connectionMethod: "manual" });
    },
  });
  const removeMutation = trpc.wallet.remove.useMutation({
    onSuccess: () => utils.wallet.list.invalidate(),
  });

  const handleConnectMetaMask = useCallback(async () => {
    setConnectError(null);
    try {
      const address = await connectMetaMask();
      setNewWallet((p) => ({ ...p, address, connectionMethod: "metamask" }));
    } catch (err) {
      if (err instanceof MetaMaskNotInstalledError) {
        setConnectError(err.message);
      } else if (err instanceof UserRejectedError) {
        setConnectError(err.message);
      } else {
        setConnectError(
          err instanceof Error ? err.message : "Failed to connect MetaMask"
        );
      }
    }
  }, []);

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

          {/* MetaMask quick-connect */}
          <div className="mb-4">
            <button
              type="button"
              onClick={handleConnectMetaMask}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-bg-tertiary)]"
            >
              <Wallet size={16} />
              {isMetaMaskAvailable() ? "Connect with MetaMask" : "MetaMask not detected"}
            </button>
            {newWallet.connectionMethod === "metamask" && newWallet.address && (
              <p className="mt-2 text-xs text-green-600">
                Connected: {newWallet.address.slice(0, 6)}...{newWallet.address.slice(-4)}
              </p>
            )}
          </div>

          <div className="relative mb-4 flex items-center">
            <div className="flex-grow border-t border-[var(--color-border-default)]" />
            <span className="mx-3 text-xs text-[var(--color-text-tertiary)]">or enter manually</span>
            <div className="flex-grow border-t border-[var(--color-border-default)]" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setConnectError(null);
              addMutation.mutate({
                address: newWallet.address,
                chain: newWallet.chain,
                label: newWallet.label || undefined,
                connectionMethod: newWallet.connectionMethod,
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
                onChange={(e) =>
                  setNewWallet((p) => ({
                    ...p,
                    address: e.target.value,
                    connectionMethod: "manual",
                  }))
                }
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
                    setNewWallet((p) => ({ ...p, chain: e.target.value as Chain }))
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
                disabled={addMutation.isPending || !newWallet.address}
                className="rounded-lg bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-primary-hover)] disabled:opacity-50"
              >
                {addMutation.isPending ? "Adding..." : "Add Wallet"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setConnectError(null);
                }}
                className="rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
              >
                Cancel
              </button>
            </div>
            {(addMutation.error || connectError) && (
              <p className="text-sm text-[var(--color-accent-danger)]">
                {connectError || addMutation.error?.message}
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
            <WalletCard
              key={wallet.id}
              wallet={wallet}
              onRemove={(id) => removeMutation.mutate({ walletId: id })}
              removePending={removeMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
