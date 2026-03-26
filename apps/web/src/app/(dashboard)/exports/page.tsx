"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle, Download, FileText, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

export default function ExportsPage() {
  const [format, setFormat] = useState<"CSV" | "XLSX" | "PDF">("CSV");
  const [isPolling, setIsPolling] = useState(false);
  const [completedNotification, setCompletedNotification] = useState<string | null>(null);
  const previousStatusesRef = useRef<Record<string, string>>({});

  const utils = trpc.useUtils();
  const exportsQuery = trpc.export.list.useQuery(undefined, {
    refetchInterval: isPolling ? 5000 : false,
  });
  const createMutation = trpc.export.create.useMutation({
    onSuccess: () => {
      utils.export.list.invalidate();
      setIsPolling(true);
    },
  });

  // Update polling state and detect completion transitions
  useEffect(() => {
    const exports = exportsQuery.data;
    if (!exports) return;

    const hasActive = exports.some(
      (e) => e.status === "PENDING" || e.status === "GENERATING"
    );
    setIsPolling(hasActive);

    // Detect GENERATING → COMPLETED transitions
    const prevStatuses = previousStatusesRef.current;
    for (const exp of exports) {
      const prev = prevStatuses[exp.id];
      if (prev === "GENERATING" && exp.status === "COMPLETED") {
        setCompletedNotification(
          `${exp.format} export completed successfully!`
        );
        setTimeout(() => setCompletedNotification(null), 5000);
      }
    }

    // Store current statuses for next comparison
    const newStatuses: Record<string, string> = {};
    for (const exp of exports) {
      newStatuses[exp.id] = exp.status;
    }
    previousStatusesRef.current = newStatuses;
  }, [exportsQuery.data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Exports</h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          Generate and download transaction reports
        </p>
      </div>

      {/* Create Export */}
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-6">
        <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
          New Export
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as typeof format)}
              className="mt-1 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none"
            >
              <option value="CSV">CSV</option>
              <option value="XLSX">XLSX</option>
              <option value="PDF">PDF</option>
            </select>
          </div>
          <button
            onClick={() => createMutation.mutate({ format, taxYear: new Date().getFullYear(), method: "FIFO" as const })}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-primary-hover)] disabled:opacity-50"
          >
            {createMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileText size={16} />
            )}
            {createMutation.isPending ? "Creating..." : "Generate Export"}
          </button>
        </div>
        {createMutation.error && (
          <p className="mt-2 text-sm text-[var(--color-accent-danger)]">
            {createMutation.error.message}
          </p>
        )}
      </div>

      {/* Export Completed Notification */}
      {completedNotification && (
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-accent-success)]/30 bg-[var(--color-accent-success)]/10 px-4 py-3 text-sm font-medium text-[var(--color-accent-success)]">
          <CheckCircle size={16} />
          {completedNotification}
        </div>
      )}

      {/* Export History */}
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)]">
        <div className="border-b border-[var(--color-border-default)] px-6 py-4">
          <h3 className="font-semibold text-[var(--color-text-primary)]">Export History</h3>
        </div>
        {exportsQuery.isLoading && (
          <div className="px-6 py-12 text-center text-[var(--color-text-tertiary)]">
            Loading exports...
          </div>
        )}
        {exportsQuery.data?.length === 0 && (
          <div className="px-6 py-12 text-center text-[var(--color-text-tertiary)]">
            No exports yet. Generate your first export above.
          </div>
        )}
        {exportsQuery.data && exportsQuery.data.length > 0 && (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {exportsQuery.data.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-[var(--color-text-tertiary)]" />
                  <div>
                    <p className="text-sm font-medium uppercase text-[var(--color-text-primary)]">
                      {exp.format}
                    </p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {new Date(exp.generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                      exp.status === "COMPLETED"
                        ? "bg-[var(--color-accent-success)]/10 text-[var(--color-accent-success)]"
                        : exp.status === "GENERATING"
                          ? "bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]"
                          : exp.status === "PENDING"
                            ? "bg-[var(--color-accent-warning)]/10 text-[var(--color-accent-warning)]"
                            : "bg-[var(--color-accent-danger)]/10 text-[var(--color-accent-danger)]"
                    }`}
                  >
                    {(exp.status === "GENERATING" || exp.status === "PENDING") && (
                      <Loader2 size={12} className="animate-spin" />
                    )}
                    {exp.status}
                  </span>
                  {exp.status === "COMPLETED" && exp.filePath && (
                    <a
                      href={exp.filePath}
                      className="flex items-center gap-1 rounded-lg border border-[var(--color-border-default)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]"
                    >
                      <Download size={12} />
                      Download
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
