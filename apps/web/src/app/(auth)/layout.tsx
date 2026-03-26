import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0e27] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111738] p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">DeFi Tracker</h1>
          <p className="mt-2 text-sm text-gray-400">
            Track, classify &amp; export your DeFi transactions
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
