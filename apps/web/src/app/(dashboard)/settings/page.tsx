"use client";
// @ts-nocheck

import { useState, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  User,
  Shield,
  CreditCard,
  Database,
  Bell,
  Download,
  Trash2,
  AlertTriangle,
  Check,
  X,
  Loader2,
  ChevronRight,
  Info,
  Lock,
  KeyRound,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import { trpc } from "@/lib/trpc-client";

// ---------------------------------------------------------------------------
// Plan data
// ---------------------------------------------------------------------------

const PLANS = [
  {
    id: "STARTER" as const,
    name: "Starter",
    price: "0",
    features: ["1 Wallet", "100 Transaktionen/Monat", "CSV-Export"],
  },
  {
    id: "PRO" as const,
    name: "Pro",
    price: "19",
    features: [
      "5 Wallets",
      "Unbegrenzte Transaktionen",
      "CSV + PDF Export",
      "Prioritäts-Sync",
    ],
  },
  {
    id: "BUSINESS" as const,
    name: "Business",
    price: "99",
    features: [
      "20 Wallets",
      "API-Zugang",
      "Eigene Klassifikationen",
      "Dedizierter Support",
    ],
  },
];

// ---------------------------------------------------------------------------
// Tax method options
// ---------------------------------------------------------------------------

type TaxMethodOption = "FIFO" | "LIFO";

const TAX_METHODS: {
  id: TaxMethodOption;
  label: string;
  desc: string;
  warning?: string;
}[] = [
  {
    id: "FIFO",
    label: "FIFO — First In, First Out",
    desc: "Gesetzlicher Standard in Deutschland. Empfohlen.",
  },
  {
    id: "LIFO",
    label: "LIFO — Last In, First Out",
    desc: "Erhöhtes Finanzamt-Risiko. Nur bei steuerlicher Beratung verwenden.",
    warning: "LIFO kann zu erhöhten Rückfragen beim Finanzamt führen.",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function PlanBadge({ plan }: { plan: string }) {
  const colorMap: Record<string, string> = {
    STARTER: "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]",
    PRO: "bg-[var(--color-accent-primary)]/15 text-[var(--color-accent-primary)]",
    BUSINESS:
      "bg-[var(--color-accent-warning)]/15 text-[var(--color-accent-warning)]",
    KANZLEI:
      "bg-[var(--color-accent-success)]/15 text-[var(--color-accent-success)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorMap[plan] ?? colorMap.STARTER}`}
    >
      {plan}
    </span>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-6">
      <div className="mb-5 flex items-center gap-3">
        <Icon size={20} className="text-[var(--color-accent-primary)]" />
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components for 2FA flow
// ---------------------------------------------------------------------------

function Setup2FAFlow({
  onComplete,
  onCancel,
}: {
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"generate" | "verify" | "done">("generate");
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  const setup2fa = trpc.user.setup2fa.useMutation({
    onSuccess: (data) => {
      setSecret(data.secret);
      setOtpauthUrl(data.otpauthUrl);
      setStep("verify");
    },
    onError: (err) => setError(err.message),
  });

  const verify2fa = trpc.user.verify2fa.useMutation({
    onSuccess: () => {
      setStep("done");
    },
    onError: (err) => setError(err.message),
  });

  if (step === "generate") {
    return (
      <div className="mt-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5">
        <h4 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
          Schritt 1: Authenticator App vorbereiten
        </h4>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          Verwenden Sie eine Authenticator-App (z.B. Google Authenticator, Authy
          oder 1Password) um den QR-Code zu scannen.
        </p>
        {error && (
          <p className="mb-3 text-sm text-[var(--color-accent-danger)]">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setError("");
              setup2fa.mutate();
            }}
            disabled={setup2fa.isPending}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-primary-hover)] disabled:opacity-50"
          >
            {setup2fa.isPending && (
              <Loader2 size={14} className="animate-spin" />
            )}
            QR-Code generieren
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)]"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="mt-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5">
        <h4 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
          Schritt 2: QR-Code scannen & Code eingeben
        </h4>
        <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
          Scannen Sie den folgenden Code mit Ihrer Authenticator-App oder geben
          Sie den geheimen Schlüssel manuell ein.
        </p>

        {/* OTPAuth URI for manual entry */}
        <div className="mb-4 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-3">
          <p className="mb-1 text-xs font-medium text-[var(--color-text-tertiary)]">
            Otpauth URI (in App einfügen):
          </p>
          <code className="block break-all text-xs text-[var(--color-accent-primary)]">
            {otpauthUrl}
          </code>
        </div>

        <div className="mb-4 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] p-3">
          <p className="mb-1 text-xs font-medium text-[var(--color-text-tertiary)]">
            Geheimer Schlüssel (manuell):
          </p>
          <code className="block font-mono text-sm tracking-widest text-[var(--color-text-primary)]">
            {secret}
          </code>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
            6-stelliger Code aus der App
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={token}
            onChange={(e) => {
              setToken(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError("");
            }}
            placeholder="000000"
            className="w-40 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-3 py-2 text-center font-mono text-lg tracking-widest text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
          />
        </div>

        {error && (
          <p className="mb-3 text-sm text-[var(--color-accent-danger)]">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => {
              setError("");
              verify2fa.mutate({ token, secret });
            }}
            disabled={token.length !== 6 || verify2fa.isPending}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-primary-hover)] disabled:opacity-50"
          >
            {verify2fa.isPending && (
              <Loader2 size={14} className="animate-spin" />
            )}
            Verifizieren & Aktivieren
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)]"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  // step === "done"
  return (
    <div className="mt-4 rounded-lg border border-[var(--color-accent-success)]/30 bg-[var(--color-accent-success)]/5 p-5">
      <div className="flex items-center gap-3">
        <ShieldCheck
          size={20}
          className="text-[var(--color-accent-success)]"
        />
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
            2FA erfolgreich aktiviert!
          </h4>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Bewahren Sie Ihren geheimen Schlüssel sicher auf. Ohne diesen
            Schlüssel können Sie sich bei Verlust Ihres Geräts nicht mehr
            anmelden.
          </p>
        </div>
      </div>
      <button
        onClick={onComplete}
        className="mt-3 rounded-lg bg-[var(--color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-accent-primary-hover)]"
      >
        Fertig
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Disable 2FA flow
// ---------------------------------------------------------------------------

function Disable2FAFlow({
  onComplete,
  onCancel,
}: {
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  const disable2fa = trpc.user.disable2fa.useMutation({
    onSuccess: () => onComplete(),
    onError: (err) => setError(err.message),
  });

  return (
    <div className="mt-4 rounded-lg border border-[var(--color-accent-danger)]/30 bg-[var(--color-accent-danger)]/5 p-5">
      <h4 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
        2FA deaktivieren
      </h4>
      <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
        Geben Sie Ihren aktuellen 6-stelligen Code ein, um die
        Zwei-Faktor-Authentifizierung zu deaktivieren.
      </p>

      <div className="mb-4">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={token}
          onChange={(e) => {
            setToken(e.target.value.replace(/\D/g, "").slice(0, 6));
            setError("");
          }}
          placeholder="000000"
          className="w-40 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-3 py-2 text-center font-mono text-lg tracking-widest text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
        />
      </div>

      {error && (
        <p className="mb-3 text-sm text-[var(--color-accent-danger)]">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => {
            setError("");
            disable2fa.mutate({ token });
          }}
          disabled={token.length !== 6 || disable2fa.isPending}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-accent-danger)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {disable2fa.isPending && (
            <Loader2 size={14} className="animate-spin" />
          )}
          2FA Deaktivieren
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)]"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete Account Modal
// ---------------------------------------------------------------------------

function DeleteAccountModal({
  onClose,
  onDeleted,
}: {
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  const deleteMutation = trpc.user.deleteAccount.useMutation({
    onSuccess: () => onDeleted(),
    onError: (err) => setError(err.message),
  });

  const canDelete = confirmation === "DELETE" && password.length >= 8;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-danger)]/10">
            <AlertTriangle
              size={20}
              className="text-[var(--color-accent-danger)]"
            />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
              Konto endgültig löschen
            </h3>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              DSGVO Art. 17 — Recht auf Löschung
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-[var(--color-accent-danger)]/20 bg-[var(--color-accent-danger)]/5 p-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            <strong>Achtung:</strong> Diese Aktion ist unwiderruflich. Folgende
            Daten werden permanent gelöscht:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-secondary)]">
            <li className="flex items-center gap-2">
              <X size={12} className="text-[var(--color-accent-danger)]" />
              Alle Wallets und Transaktionen
            </li>
            <li className="flex items-center gap-2">
              <X size={12} className="text-[var(--color-accent-danger)]" />
              Alle Steuerberechnungen und Tax Lots
            </li>
            <li className="flex items-center gap-2">
              <X size={12} className="text-[var(--color-accent-danger)]" />
              Alle Exporte und Klassifikationen
            </li>
            <li className="flex items-center gap-2">
              <X size={12} className="text-[var(--color-accent-danger)]" />
              Ihr Konto und alle Abonnements
            </li>
          </ul>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
            Passwort zur Bestätigung
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="Ihr aktuelles Passwort"
            className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
            Geben Sie{" "}
            <code className="rounded bg-[var(--color-bg-tertiary)] px-1.5 py-0.5 text-xs font-bold text-[var(--color-accent-danger)]">
              DELETE
            </code>{" "}
            ein, um zu bestätigen
          </label>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => {
              setConfirmation(e.target.value);
              setError("");
            }}
            placeholder="DELETE"
            className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-danger)]"
          />
        </div>

        {error && (
          <p className="mb-3 text-sm text-[var(--color-accent-danger)]">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => {
              setError("");
              deleteMutation.mutate({
                password,
                confirmation: confirmation as "DELETE",
              });
            }}
            disabled={!canDelete || deleteMutation.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-accent-danger)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {deleteMutation.isPending && (
              <Loader2 size={14} className="animate-spin" />
            )}
            <Trash2 size={14} />
            Konto endgültig löschen
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border-default)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-tertiary)]"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Settings Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { data: session } = useSession();
  const utils = trpc.useUtils();
  const userQuery = trpc.user.me.useQuery();

  // Tax method — client-side preference
  const [taxMethod, setTaxMethod] = useState<TaxMethodOption>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("defi-tracker-tax-method") as TaxMethodOption) || "FIFO";
    }
    return "FIFO";
  });
  const [taxYear, setTaxYear] = useState(() => new Date().getFullYear());

  // 2FA state
  const [show2faSetup, setShow2faSetup] = useState(false);
  const [show2faDisable, setShow2faDisable] = useState(false);

  // Data export
  const exportDataQuery = trpc.user.exportPersonalData.useQuery(undefined, {
    enabled: false, // manual trigger
  });

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Plan
  const updatePlanMutation = trpc.user.updatePlan.useMutation({
    onSuccess: () => utils.user.me.invalidate(),
  });

  const currentPlan = userQuery.data?.plan ?? "STARTER";

  const handleTaxMethodChange = useCallback(
    (method: TaxMethodOption) => {
      setTaxMethod(method);
      if (typeof window !== "undefined") {
        localStorage.setItem("defi-tracker-tax-method", method);
      }
    },
    []
  );

  const handleExportData = useCallback(async () => {
    const result = await exportDataQuery.refetch();
    if (result.data) {
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `defi-tracker-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [exportDataQuery]);

  const handleAccountDeleted = useCallback(() => {
    setShowDeleteModal(false);
    signOut({ callbackUrl: "/" });
  }, []);

  const handle2faComplete = useCallback(() => {
    setShow2faSetup(false);
    setShow2faDisable(false);
    utils.user.me.invalidate();
  }, [utils]);

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          Konto, Sicherheit und Steuereinstellungen verwalten
        </p>
      </div>

      {/* ================================================================= */}
      {/* Section 1: Profile */}
      {/* ================================================================= */}
      <SectionCard icon={User} title="Profile">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Email
            </label>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">
              {session?.user?.email ?? "Loading..."}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Plan
            </label>
            <div className="mt-1">
              <PlanBadge plan={currentPlan} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Mitglied seit
            </label>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">
              {userQuery.data?.createdAt
                ? formatDate(userQuery.data.createdAt)
                : "..."}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Wallets / Transaktionen
            </label>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">
              {userQuery.data
                ? `${userQuery.data.walletCount} Wallet${userQuery.data.walletCount !== 1 ? "s" : ""} / ${userQuery.data.txCount} Transaktionen`
                : "..."}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ================================================================= */}
      {/* Section 2: Tax Settings */}
      {/* ================================================================= */}
      <SectionCard icon={CreditCard} title="Steuereinstellungen">
        <div className="space-y-5">
          {/* Tax Method */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
              Bewertungsmethode (Tax Method)
            </label>
            <div className="space-y-3">
              {TAX_METHODS.map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition ${
                    taxMethod === m.id
                      ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/5"
                      : "border-[var(--color-border-default)] hover:border-[var(--color-border-default)]/80"
                  }`}
                >
                  <input
                    type="radio"
                    name="taxMethod"
                    value={m.id}
                    checked={taxMethod === m.id}
                    onChange={() => handleTaxMethodChange(m.id)}
                    className="mt-0.5 accent-[var(--color-accent-primary)]"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {m.label}
                    </span>
                    <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                      {m.desc}
                    </p>
                    {m.warning && taxMethod === m.id && (
                      <div className="mt-2 flex items-center gap-2 rounded-md bg-[var(--color-accent-warning)]/10 px-3 py-2">
                        <AlertTriangle
                          size={14}
                          className="shrink-0 text-[var(--color-accent-warning)]"
                        />
                        <span className="text-xs text-[var(--color-accent-warning)]">
                          {m.warning}
                        </span>
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Default Tax Year */}
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
              Standard-Steuerjahr
            </label>
            <select
              value={taxYear}
              onChange={(e) => setTaxYear(Number(e.target.value))}
              className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent-primary)]"
            >
              {Array.from(
                { length: new Date().getFullYear() - 2019 },
                (_, i) => new Date().getFullYear() - i
              ).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      {/* ================================================================= */}
      {/* Section 3: Security */}
      {/* ================================================================= */}
      <SectionCard icon={Shield} title="Sicherheit">
        <div className="space-y-5">
          {/* 2FA Status */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {userQuery.data?.totpEnabled ? (
                  <ShieldCheck
                    size={18}
                    className="text-[var(--color-accent-success)]"
                  />
                ) : (
                  <ShieldOff
                    size={18}
                    className="text-[var(--color-text-tertiary)]"
                  />
                )}
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    Zwei-Faktor-Authentifizierung (2FA)
                  </p>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {userQuery.data?.totpEnabled
                      ? "TOTP ist aktiviert — Ihr Konto ist geschützt"
                      : "Zusätzliche Sicherheitsebene hinzufügen"}
                  </p>
                </div>
              </div>
              {!show2faSetup && !show2faDisable && (
                <button
                  onClick={() => {
                    if (userQuery.data?.totpEnabled) {
                      setShow2faDisable(true);
                    } else {
                      setShow2faSetup(true);
                    }
                  }}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    userQuery.data?.totpEnabled
                      ? "border-[var(--color-accent-danger)]/30 text-[var(--color-accent-danger)] hover:bg-[var(--color-accent-danger)]/5"
                      : "border-[var(--color-accent-primary)]/30 text-[var(--color-accent-primary)] hover:bg-[var(--color-accent-primary)]/5"
                  }`}
                >
                  {userQuery.data?.totpEnabled ? (
                    <>
                      <ShieldOff size={14} />
                      Deaktivieren
                    </>
                  ) : (
                    <>
                      <KeyRound size={14} />
                      Aktivieren
                    </>
                  )}
                </button>
              )}
            </div>

            {/* 2FA Setup Flow */}
            {show2faSetup && (
              <Setup2FAFlow
                onComplete={handle2faComplete}
                onCancel={() => setShow2faSetup(false)}
              />
            )}

            {/* 2FA Disable Flow */}
            {show2faDisable && (
              <Disable2FAFlow
                onComplete={handle2faComplete}
                onCancel={() => setShow2faDisable(false)}
              />
            )}
          </div>

          {/* Password change placeholder */}
          <div className="flex items-center justify-between border-t border-[var(--color-border-default)] pt-5">
            <div className="flex items-center gap-3">
              <Lock size={18} className="text-[var(--color-text-tertiary)]" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  Passwort ändern
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  Coming soon
                </p>
              </div>
            </div>
            <button
              disabled
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-tertiary)] opacity-50"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ================================================================= */}
      {/* Section 4: Data & Privacy (DSGVO) */}
      {/* ================================================================= */}
      <SectionCard icon={Database} title="Daten & Datenschutz (DSGVO)">
        <div className="space-y-5">
          {/* Export personal data */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Meine Daten exportieren
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                DSGVO Art. 15 — Auskunftsrecht. Lädt alle Ihre Daten als JSON
                herunter.
              </p>
            </div>
            <button
              onClick={handleExportData}
              disabled={exportDataQuery.isFetching}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)] disabled:opacity-50"
            >
              {exportDataQuery.isFetching ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Daten exportieren
            </button>
          </div>

          {/* Delete account */}
          <div className="flex items-center justify-between border-t border-[var(--color-border-default)] pt-5">
            <div>
              <p className="text-sm font-medium text-[var(--color-accent-danger)]">
                Konto löschen
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)]">
                DSGVO Art. 17 — Recht auf Löschung. Alle Daten werden
                unwiderruflich entfernt.
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-accent-danger)]/30 px-4 py-2 text-sm font-medium text-[var(--color-accent-danger)] transition hover:bg-[var(--color-accent-danger)]/5"
            >
              <Trash2 size={14} />
              Konto löschen
            </button>
          </div>

          {/* Data retention notice */}
          <div className="flex items-start gap-3 rounded-lg border border-[var(--color-accent-info)]/20 bg-[var(--color-accent-info)]/5 p-4">
            <Info
              size={16}
              className="mt-0.5 shrink-0 text-[var(--color-accent-info)]"
            />
            <p className="text-xs text-[var(--color-text-secondary)]">
              <strong>Aufbewahrungspflicht:</strong> Audit-Logs werden gemäß
              §147 AO (GoBD) für 10 Jahre aufbewahrt. Diese
              Aufbewahrungspflicht gilt auch nach Kontolöschung für
              steuerrelevante Protokolldaten.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* ================================================================= */}
      {/* Section 5: Notifications (placeholder) */}
      {/* ================================================================= */}
      <SectionCard icon={Bell} title="Benachrichtigungen">
        <div className="space-y-4">
          {[
            {
              label: "Export abgeschlossen",
              desc: "E-Mail erhalten, wenn ein Export bereit ist",
            },
            {
              label: "Sync-Fehler",
              desc: "E-Mail bei Wallet-Sync-Problemen",
            },
            {
              label: "Steuer-Erinnerungen",
              desc: "Erinnerungen zu wichtigen Steuerfristen",
            },
          ].map((n) => (
            <div
              key={n.label}
              className="flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {n.label}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {n.desc}
                </p>
              </div>
              <button
                disabled
                className="relative inline-flex h-6 w-11 cursor-not-allowed items-center rounded-full bg-[var(--color-bg-tertiary)] opacity-50 transition"
                title="Coming soon"
              >
                <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-[var(--color-text-tertiary)] transition" />
              </button>
            </div>
          ))}
          <p className="text-xs text-[var(--color-text-tertiary)] italic">
            E-Mail-Benachrichtigungen werden bald verfügbar sein.
          </p>
        </div>
      </SectionCard>

      {/* ================================================================= */}
      {/* Section: Subscription Plans */}
      {/* ================================================================= */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <CreditCard
            size={20}
            className="text-[var(--color-accent-primary)]"
          />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Abonnement
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-lg border p-5 transition ${
                currentPlan === plan.id
                  ? "border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/5"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-card)]"
              }`}
            >
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                {plan.name}
              </h3>
              <p className="mt-1">
                <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                  &euro;{plan.price}
                </span>
                <span className="text-sm text-[var(--color-text-tertiary)]">
                  /Monat
                </span>
              </p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]"
                  >
                    <Check
                      size={14}
                      className="text-[var(--color-accent-success)]"
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  if (plan.id !== currentPlan) {
                    updatePlanMutation.mutate({ plan: plan.id });
                  }
                }}
                disabled={
                  plan.id === currentPlan || updatePlanMutation.isPending
                }
                className={`mt-4 w-full rounded-lg py-2 text-sm font-medium transition ${
                  plan.id === currentPlan
                    ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]"
                    : "bg-[var(--color-accent-primary)] text-white hover:bg-[var(--color-accent-primary-hover)]"
                }`}
              >
                {plan.id === currentPlan ? "Aktueller Plan" : "Upgrade"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => setShowDeleteModal(false)}
          onDeleted={handleAccountDeleted}
        />
      )}
    </div>
  );
}
