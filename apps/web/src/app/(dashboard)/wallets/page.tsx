"use client";
// @ts-nocheck

import { useState, useCallback } from "react";
import {
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  Copy,
  Check,
  AlertTriangle,
  Shield,
  ExternalLink,
  Loader2,
  Zap,
  Link2,
  Keyboard,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";
import {
  connectMetaMask,
  isValidEvmAddress,
  truncateAddress,
  FLARE_CHAIN_CONFIG,
} from "@/lib/wallet-connect";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectionMethod = "metamask" | "walletconnect" | "manual";
type SyncStatusValue = "IDLE" | "SYNCING" | "COMPLETED" | "ERROR";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SYNC_STATUS_CONFIG: Record<
  SyncStatusValue,
  { label: string; color: string; bgColor: string }
> = {
  IDLE: {
    label: "Idle",
    color: "var(--color-text-tertiary)",
    bgColor: "var(--color-bg-tertiary)",
  },
  SYNCING: {
    label: "Syncing",
    color: "var(--color-accent-primary)",
    bgColor: "var(--color-accent-primary)",
  },
  COMPLETED: {
    label: "Synced",
    color: "var(--color-accent-success, #22c55e)",
    bgColor: "var(--color-accent-success, #22c55e)",
  },
  ERROR: {
    label: "Error",
    color: "var(--color-accent-danger)",
    bgColor: "var(--color-accent-danger)",
  },
};

function formatSyncTime(date: Date | string | null | undefined): string {
  if (!date) return "Never synced";
  const d = new Date(date);
  return `Synced ${d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} ${d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

// ---------------------------------------------------------------------------
// CopyButton Component
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="ml-1.5 inline-flex items-center rounded p-0.5 text-[var(--color-text-tertiary)] transition hover:text-[var(--color-text-secondary)]"
      title="Copy address"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function WalletsPage() {
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [connectionMethod, setConnectionMethod] = useState<ConnectionMethod | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [walletLabel, setWalletLabel] = useState("");
  const [pendingAddress, setPendingAddress] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const utils = trpc.useUtils();

  const walletsQuery = trpc.wallet.list.useQuery();
  const addMutation = trpc.wallet.add.useMutation({
    onSuccess: () => {
      utils.wallet.list.invalidate();
      resetForm();
    },
  });
  const removeMutation = trpc.wallet.remove.useMutation({
    onSuccess: () => utils.wallet.list.invalidate(),
  });
  const syncMutation = trpc.wallet.sync.useMutation({
    onSuccess: () => {
      // Refresh list to pick up the new SYNCING status
      utils.wallet.list.invalidate();
    },
  });

  // ---- Form helpers ----

  function resetForm() {
    setShowAddPanel(false);
    setConnectionMethod(null);
    setManualAddress("");
    setWalletLabel("");
    setPendingAddress("");
    setConnectError(null);
    setIsConnecting(false);
  }

  // ---- MetaMask flow ----

  async function handleMetaMaskConnect() {
    setConnectError(null);
    setIsConnecting(true);
    try {
      const result = await connectMetaMask();
      setPendingAddress(result.address);
      setConnectionMethod("metamask");
    } catch (err: unknown) {
      setConnectError(err instanceof Error ? err.message : "MetaMask connection failed.");
    } finally {
      setIsConnecting(false);
    }
  }

  // ---- Submit wallet ----

  function handleSubmitWallet() {
    const address = connectionMethod === "manual" ? manualAddress.trim() : pendingAddress;

    if (!isValidEvmAddress(address)) {
      setConnectError("Invalid address. Must be 0x followed by 40 hex characters.");
      return;
    }

    addMutation.mutate({
      address,
      label: walletLabel.trim() || undefined,
      connectionMethod: connectionMethod ?? "manual",
    });
  }

  // ---- Derived data ----

  const wallets = walletsQuery.data ?? [];
  const walletCount = wallets.length;
  // Plan limit info — we show a warning when close to limit
  // (the server enforces the actual limit)

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Wallets</h1>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
            Track your Flare Network wallets — read-only, no private keys stored
          </p>
        </div>
        <button
          onClick={() => {
            if (showAddPanel) {
              resetForm();
            } else {
              setShowAddPanel(true);
            }
          }}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-primary-hover)]"
        >
          <Plus size={16} />
          Add Wallet
        </button>
      </div>

      {/* ---- Security Badge ---- */}
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-4 py-2.5">
        <Shield size={16} className="shrink-0 text-[var(--color-accent-success, #22c55e)]" />
        <span className="text-xs text-[var(--color-text-secondary)]">
          <strong>Read-only access</strong> — We never ask for or store private keys. Wallet addresses
          are used solely for on-chain data indexing.
        </span>
      </div>

      {/* ---- Add Wallet Panel ---- */}
      {showAddPanel && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-6">
          <h3 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">
            Connect a Flare Wallet
          </h3>
          <p className="mb-6 text-sm text-[var(--color-text-tertiary)]">
            Choose how you want to add your wallet. Only Flare Network (Chain ID 14) is supported.
          </p>

          {/* Connection method selection */}
          {!connectionMethod && !pendingAddress && (
            <div className="grid gap-4 sm:grid-cols-3">
              {/* MetaMask */}
              <button
                onClick={handleMetaMaskConnect}
                disabled={isConnecting}
                className="group relative flex flex-col items-center gap-3 rounded-lg border border-[var(--color-border-default)] p-6 text-center transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-secondary)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent-primary)]/10">
                  <Zap size={24} className="text-[var(--color-accent-primary)]" />
                </div>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {isConnecting ? "Connecting..." : "Connect MetaMask"}
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  Auto-detect address from your browser wallet
                </span>
              </button>

              {/* WalletConnect — Coming Soon */}
              <button
                disabled
                className="group relative flex flex-col items-center gap-3 rounded-lg border border-[var(--color-border-default)] p-6 text-center opacity-60 cursor-not-allowed"
              >
                <span className="absolute -top-2 right-3 rounded-full bg-[var(--color-accent-primary)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Coming Soon
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)]">
                  <Link2 size={24} className="text-[var(--color-text-tertiary)]" />
                </div>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  WalletConnect
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  Connect via QR code from any mobile wallet
                </span>
              </button>

              {/* Manual entry */}
              <button
                onClick={() => setConnectionMethod("manual")}
                className="group flex flex-col items-center gap-3 rounded-lg border border-[var(--color-border-default)] p-6 text-center transition hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-bg-secondary)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-tertiary)]">
                  <Keyboard size={24} className="text-[var(--color-text-secondary)]" />
                </div>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  Enter Address Manually
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  Paste a Flare wallet address (0x...)
                </span>
              </button>
            </div>
          )}

          {/* MetaMask result — confirm address */}
          {pendingAddress && connectionMethod === "metamask" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--color-accent-primary)]/30 bg-[var(--color-accent-primary)]/5 p-4">
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[var(--color-accent-primary)]">
                  Detected Address
                </p>
                <p className="font-mono text-sm text-[var(--color-text-primary)] break-all">
                  {pendingAddress}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent-success, #22c55e)]" />
                  <span className="text-xs text-[var(--color-text-tertiary)]">Flare Network</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                  Label (optional)
                </label>
                <input
                  type="text"
                  value={walletLabel}
                  onChange={(e) => setWalletLabel(e.target.value)}
                  placeholder="e.g. My Main Wallet"
                  maxLength={100}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSubmitWallet}
                  disabled={addMutation.isPending}
                  className="rounded-lg bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-primary-hover)] disabled:opacity-50"
                >
                  {addMutation.isPending ? "Adding..." : "Add Wallet"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Manual entry form */}
          {connectionMethod === "manual" && !pendingAddress && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                  Wallet Address
                </label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="0x..."
                  className="mt-1 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
                />
                {manualAddress && !isValidEvmAddress(manualAddress) && (
                  <p className="mt-1 text-xs text-[var(--color-accent-danger)]">
                    Must be a valid EVM address (0x + 40 hex characters)
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
                  Label (optional)
                </label>
                <input
                  type="text"
                  value={walletLabel}
                  onChange={(e) => setWalletLabel(e.target.value)}
                  placeholder="e.g. My Main Wallet"
                  maxLength={100}
                  className="mt-1 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSubmitWallet}
                  disabled={
                    addMutation.isPending || !isValidEvmAddress(manualAddress)
                  }
                  className="rounded-lg bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-primary-hover)] disabled:opacity-50"
                >
                  {addMutation.isPending ? "Adding..." : "Add Wallet"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Errors */}
          {(connectError || addMutation.error) && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--color-accent-danger)]/30 bg-[var(--color-accent-danger)]/5 px-4 py-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--color-accent-danger)]" />
              <p className="text-sm text-[var(--color-accent-danger)]">
                {connectError || addMutation.error?.message}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---- Loading State ---- */}
      {walletsQuery.isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--color-text-tertiary)]" />
          <span className="ml-2 text-sm text-[var(--color-text-tertiary)]">Loading wallets...</span>
        </div>
      )}

      {/* ---- Empty State ---- */}
      {walletsQuery.data && walletCount === 0 && (
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-accent-primary)]/10">
            <Wallet className="h-8 w-8 text-[var(--color-accent-primary)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Connect your Flare wallet to start tracking
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-text-tertiary)]">
            Add your Flare Network wallet address to automatically index transactions,
            classify DeFi activity, and generate BMF-2025 compliant tax reports.
          </p>
          <button
            onClick={() => setShowAddPanel(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent-primary)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-primary-hover)]"
          >
            <Plus size={16} />
            Add Your First Wallet
          </button>
        </div>
      )}

      {/* ---- Plan Limit Warning ---- */}
      {walletCount > 0 && walletCount >= 1 && (
        <div className="text-right text-xs text-[var(--color-text-tertiary)]">
          {walletCount} wallet{walletCount !== 1 ? "s" : ""} tracked
        </div>
      )}

      {/* ---- Wallet Cards ---- */}
      {walletCount > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet) => {
            const syncCfg =
              SYNC_STATUS_CONFIG[(wallet.syncStatus as SyncStatusValue) ?? "IDLE"];
            const txCount = (wallet as unknown as { _count: { transactions: number } })._count
              ?.transactions ?? 0;

            return (
              <div
                key={wallet.id}
                className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-5 transition hover:border-[var(--color-accent-primary)]/30"
              >
                {/* Top row: label + Flare badge */}
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {wallet.label || "Flare Wallet"}
                    </p>
                    <div className="mt-1 flex items-center">
                      <p className="truncate font-mono text-xs text-[var(--color-text-tertiary)]">
                        {truncateAddress(wallet.address)}
                      </p>
                      <CopyButton text={wallet.address} />
                    </div>
                  </div>
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-accent-primary)]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-accent-primary)]">
                    Flare
                  </span>
                </div>

                {/* Sync status indicator */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: syncCfg.bgColor }}
                    />
                    <span className="text-xs" style={{ color: syncCfg.color }}>
                      {syncCfg.label}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {txCount} TX{txCount !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Last sync + explorer link */}
                <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
                  <span>{formatSyncTime(wallet.lastSyncAt)}</span>
                  <a
                    href={`${FLARE_CHAIN_CONFIG.blockExplorerUrls[0]}/address/${wallet.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 transition hover:text-[var(--color-accent-primary)]"
                  >
                    FlareScan
                    <ExternalLink size={10} />
                  </a>
                </div>

                {/* Action buttons */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => syncMutation.mutate({ walletId: wallet.id })}
                    disabled={
                      syncMutation.isPending || wallet.syncStatus === "SYNCING"
                    }
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border-default)] py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
                  >
                    <RefreshCw
                      size={12}
                      className={
                        wallet.syncStatus === "SYNCING" ? "animate-spin" : ""
                      }
                    />
                    {wallet.syncStatus === "SYNCING" ? "Syncing..." : "Sync"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Remove this wallet and all its transactions?")) {
                        removeMutation.mutate({ walletId: wallet.id });
                      }
                    }}
                    disabled={removeMutation.isPending}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-accent-danger)]/30 px-3 py-1.5 text-xs font-medium text-[var(--color-accent-danger)] transition hover:bg-[var(--color-accent-danger)]/10 disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
