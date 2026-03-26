"use client";

import { useSession } from "next-auth/react";
import { Shield, User, CreditCard } from "lucide-react";
import { trpc } from "@/lib/trpc-client";

const PLANS = [
  {
    id: "STARTER" as const,
    name: "Starter",
    price: "0",
    features: ["3 wallets", "100 transactions/month", "CSV export"],
  },
  {
    id: "PRO" as const,
    name: "Pro",
    price: "19",
    features: [
      "Unlimited wallets",
      "Unlimited transactions",
      "CSV + PDF export",
      "Priority sync",
    ],
  },
  {
    id: "BUSINESS" as const,
    name: "Business",
    price: "99",
    features: [
      "Everything in Pro",
      "API access",
      "Custom classifications",
      "Dedicated support",
    ],
  },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const userQuery = trpc.user.me.useQuery();
  const updatePlanMutation = trpc.user.updatePlan.useMutation({
    onSuccess: () => userQuery.refetch(),
  });

  const currentPlan = userQuery.data?.plan ?? "STARTER";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">
          Manage your account and subscription
        </p>
      </div>

      {/* Profile Section */}
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-6">
        <div className="mb-4 flex items-center gap-3">
          <User size={20} className="text-[var(--color-text-tertiary)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Profile</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Email
            </label>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">
              {session?.user?.email ?? "Loading..."}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
              Member Since
            </label>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">
              {userQuery.data?.createdAt
                ? new Date(userQuery.data.createdAt).toLocaleDateString()
                : "Loading..."}
            </p>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)] p-6">
        <div className="mb-4 flex items-center gap-3">
          <Shield size={20} className="text-[var(--color-text-tertiary)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Security</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Two-Factor Authentication
            </p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {userQuery.data?.totpEnabled
                ? "TOTP is enabled on your account"
                : "Add an extra layer of security"}
            </p>
          </div>
          <button className="rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-secondary)]">
            {userQuery.data?.totpEnabled ? "Disable" : "Enable"}
          </button>
        </div>
      </div>

      {/* Plan Section */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <CreditCard size={20} className="text-[var(--color-text-tertiary)]" />
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Subscription</h2>
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
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">{plan.name}</h3>
              <p className="mt-1">
                <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                  &euro;{plan.price}
                </span>
                <span className="text-sm text-[var(--color-text-tertiary)]">/month</span>
              </p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-[var(--color-text-secondary)]">
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
                disabled={plan.id === currentPlan || updatePlanMutation.isPending}
                className={`mt-4 w-full rounded-lg py-2 text-sm font-medium transition ${
                  plan.id === currentPlan
                    ? "bg-[var(--color-bg-tertiary)] text-[var(--color-text-tertiary)]"
                    : "bg-[var(--color-accent-primary)] text-white hover:bg-[var(--color-accent-primary-hover)]"
                }`}
              >
                {plan.id === currentPlan ? "Current Plan" : "Upgrade"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
