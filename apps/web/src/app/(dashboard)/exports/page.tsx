"use client";
// @ts-nocheck

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  FileText,
  Download,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Check,
  Info,
  Hash,
  Calendar,
  Filter,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type TaxMethodOption = "FIFO" | "LIFO";
type FormatOption = "CSV" | "XLSX" | "PDF";

const FORMAT_INFO: Record<FormatOption, { label: string; desc: string }> = {
  CSV: {
    label: "CSV (CoinTracking)",
    desc: "CoinTracking.info-kompatibel, 15-Spalten-Format",
  },
  XLSX: {
    label: "XLSX (Excel)",
    desc: "Microsoft Excel Arbeitsmappe",
  },
  PDF: {
    label: "PDF (Steuerbericht)",
    desc: "Druckbarer Steuerbericht zur Vorlage",
  },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: {
    bg: "bg-[var(--color-accent-warning)]/10",
    text: "text-[var(--color-accent-warning)]",
    label: "Wartend",
  },
  GENERATING: {
    bg: "bg-[var(--color-accent-info)]/10",
    text: "text-[var(--color-accent-info)]",
    label: "Generiert...",
  },
  COMPLETED: {
    bg: "bg-[var(--color-accent-success)]/10",
    text: "text-[var(--color-accent-success)]",
    label: "Fertig",
  },
  FAILED: {
    bg: "bg-[var(--color-accent-danger)]/10",
    text: "text-[var(--color-accent-danger)]",
    label: "Fehlgeschlagen",
  },
};

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
    >
      {status === "GENERATING" && (
        <Loader2 size={10} className="animate-spin" />
      )}
      {status === "COMPLETED" && <Check size={10} />}
      {style.label}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const isFifo = method === "FIFO";
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
        isFifo
          ? "bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]"
          : "bg-[var(--color-accent-warning)]/10 text-[var(--color-accent-warning)]"
      }`}
    >
      {method}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Exports Page
// ---------------------------------------------------------------------------

export default function ExportsPage() {
  const currentYear = new Date().getFullYear();

  // Form state
  const [taxYear, setTaxYear] = useState(currentYear);
  const [method, setMethod] = useState<TaxMethodOption>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("defi-tracker-tax-method") as TaxMethodOption) || "FIFO";
    }
    return "FIFO";
  });
  const [format, setFormat] = useState<FormatOption>("CSV");
  const [selectedWalletIds, setSelectedWalletIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);

  // tRPC
  const utils = trpc.useUtils();
  const exportsQuery = trpc.export.list.useQuery();
  const walletsQuery = trpc.wallet.list.useQuery();

  const previewQuery = trpc.export.previewCount.useQuery({
    taxYear,
    walletIds: selectAll ? undefined : selectedWalletIds,
  });

  const createMutation = trpc.export.create.useMutation({
    onSuccess: () => {
      utils.export.list.invalidate();
    },
  });

  const regenerateMutation = trpc.export.regenerate.useMutation({
    onSuccess: () => {
      utils.export.list.invalidate();
    },
  });

  // Wallet selection helpers
  const wallets = walletsQuery.data ?? [];

  const handleWalletToggle = useCallback(
    (walletId: string) => {
      setSelectAll(false);
      setSelectedWalletIds((prev) =>
        prev.includes(walletId)
          ? prev.filter((id) => id !== walletId)
          : [...prev, walletId]
      );
    },
    []
  );

  const handleSelectAll = useCallback(() => {
    setSelectAll(true);
    setSelectedWalletIds([]);
  }, []);

  // Reset wallet selection when wallets change
  useEffect(() => {
    if (wallets.length > 0 && !selectAll && selectedWalletIds.length === 0) {
      setSelectAll(true);
    }
  }, [wallets.length, selectAll, selectedWalletIds.length]);

  const handleCreate = useCallback(() => {
    createMutation.mutate({
      taxYear,
      method,
      format,
      walletIds: selectAll ? undefined : selectedWalletIds,
    });
  }, [taxYear, method, format, selectAll, selectedWalletIds, createMutation]);

  // Tax year options
  const yearOptions = useMemo(
    () =>
      Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i),
    [currentYear]
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Tax Exports
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          CoinTracking-kompatible Steuerexporte generieren und herunterladen
        </p>
      </div>

      {/* ================================================================= */}
      {/* Create Export Card */}
      {/* ================================================================= */}
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-6">
        <h3 className="mb-5 text-lg font-semibold text-[var(--color-text-primary)]">
          Neuer Export
        </h3>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Tax Year */}
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
              <Calendar size={14} />
              Steuerjahr
            </label>
            <select
              value={taxYear}
              onChange={(e) => setTaxYear(Number(e.target.value))}
              className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Format */}
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
              <FileText size={14} />
              Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as FormatOption)}
              className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
            >
              {(Object.entries(FORMAT_INFO) as [FormatOption, (typeof FORMAT_INFO)[FormatOption]][]).map(
                ([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                )
              )}
            </select>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              {FORMAT_INFO[format].desc}
            </p>
          </div>
        </div>

        {/* Tax Method Toggle */}
        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
            Bewertungsmethode
          </label>
          <div className="flex gap-3">
            {(["FIFO", "LIFO"] as TaxMethodOption[]).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`flex-1 rounded-lg border px-4 py-3 text-left transition ${
                  method === m
                    ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/5"
                    : "border-[var(--color-border-default)] hover:border-[var(--color-border-default)]/80"
                }`}
              >
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {m}
                </span>
                <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                  {m === "FIFO"
                    ? "First In, First Out — Gesetzlicher Standard"
                    : "Last In, First Out — Erhöhtes Risiko"}
                </p>
              </button>
            ))}
          </div>
          {method === "LIFO" && (
            <div className="mt-2 flex items-center gap-2 rounded-md bg-[var(--color-accent-warning)]/10 px-3 py-2">
              <AlertTriangle
                size={14}
                className="shrink-0 text-[var(--color-accent-warning)]"
              />
              <span className="text-xs text-[var(--color-accent-warning)]">
                LIFO kann zu erhöhten Rückfragen beim Finanzamt führen.
              </span>
            </div>
          )}
        </div>

        {/* Wallet Filter */}
        {wallets.length > 0 && (
          <div className="mt-5">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
              <Filter size={14} />
              Wallets
            </label>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="accent-[var(--color-accent-primary)]"
                />
                <span className="text-sm text-[var(--color-text-primary)]">
                  Alle Wallets ({wallets.length})
                </span>
              </label>
              {!selectAll && (
                <div className="ml-4 space-y-2 border-l-2 border-[var(--color-border-default)] pl-4">
                  {wallets.map((w: { id: string; address: string; label: string | null; _count?: { transactions: number } }) => (
                    <label
                      key={w.id}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        checked={selectedWalletIds.includes(w.id)}
                        onChange={() => handleWalletToggle(w.id)}
                        className="accent-[var(--color-accent-primary)]"
                      />
                      <span className="text-sm text-[var(--color-text-primary)]">
                        {w.label || `${w.address.slice(0, 6)}...${w.address.slice(-4)}`}
                      </span>
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        ({w._count?.transactions ?? 0} Tx)
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="mt-5 flex items-center justify-between rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Info size={14} className="text-[var(--color-accent-info)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">
              {previewQuery.isFetching ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" />
                  Berechne...
                </span>
              ) : (
                <>
                  Dieser Export umfasst{" "}
                  <strong className="text-[var(--color-text-primary)]">
                    {previewQuery.data?.count ?? 0}
                  </strong>{" "}
                  Transaktionen
                </>
              )}
            </span>
          </div>
          <button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-accent-primary)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--color-accent-primary-hover)] disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileText size={16} />
            )}
            {createMutation.isPending
              ? "Wird erstellt..."
              : "Export generieren"}
          </button>
        </div>

        {createMutation.error && (
          <p className="mt-3 text-sm text-[var(--color-accent-danger)]">
            {createMutation.error.message}
          </p>
        )}
        {createMutation.isSuccess && (
          <p className="mt-3 text-sm text-[var(--color-accent-success)]">
            Export wurde in die Warteschlange eingereiht.
          </p>
        )}

        {/* CoinTracking note */}
        <p className="mt-3 text-xs text-[var(--color-text-tertiary)]">
          CSV-Export ist CoinTracking.info-kompatibel (15-Spalten-Format, UTF-8
          mit BOM, deutsches Dezimalformat)
        </p>
      </div>

      {/* ================================================================= */}
      {/* Export History Table */}
      {/* ================================================================= */}
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-6 py-4">
          <h3 className="font-semibold text-[var(--color-text-primary)]">
            Export-Verlauf
          </h3>
          <button
            onClick={() => utils.export.list.invalidate()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-secondary)]"
          >
            <RefreshCw size={12} />
            Aktualisieren
          </button>
        </div>

        {/* Loading */}
        {exportsQuery.isLoading && (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-[var(--color-text-tertiary)]">
            <Loader2 size={16} className="animate-spin" />
            Exporte werden geladen...
          </div>
        )}

        {/* Empty state */}
        {exportsQuery.data?.length === 0 && (
          <div className="px-6 py-16 text-center">
            <FileText
              size={32}
              className="mx-auto mb-3 text-[var(--color-text-tertiary)]"
            />
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Noch keine Exporte vorhanden. Erstellen Sie Ihren ersten Export
              oben.
            </p>
          </div>
        )}

        {/* Table */}
        {exportsQuery.data && exportsQuery.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border-default)] text-left text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  <th className="px-6 py-3">Datum</th>
                  <th className="px-4 py-3">Steuerjahr</th>
                  <th className="px-4 py-3">Methode</th>
                  <th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Zeilen</th>
                  <th className="px-6 py-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {exportsQuery.data.map((exp: { id: string; format: string; status: string; generatedAt: string | Date; taxYear: number; method: string; rowCount: number | null; filePath: string | null; fileHash: string | null }) => (
                  <tr
                    key={exp.id}
                    className="transition hover:bg-[var(--color-bg-secondary)]"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-[var(--color-text-primary)]">
                      {formatDate(exp.generatedAt)}
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--color-text-primary)]">
                      {exp.taxYear}
                    </td>
                    <td className="px-4 py-4">
                      <MethodBadge method={exp.method} />
                    </td>
                    <td className="px-4 py-4 text-sm uppercase text-[var(--color-text-secondary)]">
                      {exp.format}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={exp.status} />
                    </td>
                    <td className="px-4 py-4 text-right text-sm text-[var(--color-text-secondary)]">
                      {exp.rowCount != null ? exp.rowCount.toLocaleString("de-DE") : "\u2014"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {exp.status === "COMPLETED" && exp.filePath && (
                          <a
                            href={exp.filePath}
                            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-accent-primary)]/30 px-3 py-1.5 text-xs font-medium text-[var(--color-accent-primary)] transition hover:bg-[var(--color-accent-primary)]/5"
                          >
                            <Download size={12} />
                            Download
                          </a>
                        )}
                        <button
                          onClick={() =>
                            regenerateMutation.mutate({ exportId: exp.id })
                          }
                          disabled={regenerateMutation.isPending}
                          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border-default)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
                          title="Export erneut generieren"
                        >
                          <RefreshCw size={12} />
                          Neu
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* File hash display for completed exports */}
            {exportsQuery.data.some(
              (e: { status: string; fileHash: string | null }) => e.status === "COMPLETED" && e.fileHash
            ) && (
              <div className="border-t border-[var(--color-border-default)] px-6 py-3">
                <details className="text-xs text-[var(--color-text-tertiary)]">
                  <summary className="flex cursor-pointer items-center gap-2">
                    <Hash size={12} />
                    Datei-Hashes anzeigen (GoBD-Konformit\u00e4t)
                  </summary>
                  <div className="mt-2 space-y-1 font-mono">
                    {exportsQuery.data
                      .filter((e: { status: string; fileHash: string | null }) => e.status === "COMPLETED" && e.fileHash)
                      .map((e: { id: string; taxYear: number; format: string; fileHash: string | null }) => (
                        <div key={e.id}>
                          <span className="text-[var(--color-text-secondary)]">
                            {e.taxYear} {e.format}:
                          </span>{" "}
                          <span className="break-all text-[var(--color-accent-info)]">
                            {e.fileHash}
                          </span>
                        </div>
                      ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* Info Banner */}
      {/* ================================================================= */}
      <div className="rounded-lg border border-[var(--color-accent-info)]/20 bg-[var(--color-accent-info)]/5 p-4">
        <div className="flex items-start gap-3">
          <Info
            size={16}
            className="mt-0.5 shrink-0 text-[var(--color-accent-info)]"
          />
          <div className="space-y-1 text-xs text-[var(--color-text-secondary)]">
            <p>
              <strong>GoBD-Konformit\u00e4t:</strong> Exports werden versioniert
              gespeichert (\u00a7147 AO). Jede Datei wird mit einem SHA-256 Hash
              versehen.
            </p>
            <p>
              <strong>CSV-Format:</strong> 15 Spalten, UTF-8 mit BOM, deutsches
              Dezimalformat (Komma als Trennzeichen). Kompatibel mit
              CoinTracking.info.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
