import { AppShell } from "@/components/layout/app-shell";

export const metadata = {
  title: "DeFi Tracker — Dashboard",
  description: "On-Chain Tax Intelligence for Flare Network DeFi users",
};

/**
 * Dashboard layout — wraps all authenticated pages with AppShell.
 * TODO: Add auth guard (redirect to /login if unauthenticated).
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: Protect route — check session via next-auth
  // const session = await auth();
  // if (!session) redirect("/login");

  return <AppShell>{children}</AppShell>;
}
