import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";

export const metadata = {
  title: "DeFi Tracker — Dashboard",
  description: "On-Chain Tax Intelligence for Flare Network DeFi users",
};

/**
 * Dashboard layout — wraps all authenticated pages with AppShell.
 * Server-side auth guard redirects unauthenticated users to /login.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return <AppShell>{children}</AppShell>;
}
