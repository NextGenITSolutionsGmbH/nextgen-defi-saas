"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration. Please contact support.",
  AccessDenied: "You do not have access to this resource.",
  Verification: "The verification link has expired or has already been used.",
  CredentialsSignin: "Invalid email or password. Please try again.",
  Default: "An unexpected authentication error occurred.",
};

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>}>
      <ErrorContent />
    </Suspense>
  );
}

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "Default";
  const message = errorMessages[error] ?? errorMessages.Default;

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <AlertTriangle className="h-12 w-12 text-amber-400" />
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Authentication Error</h2>
        <p className="text-sm text-gray-400">{message}</p>
      </div>

      <Link
        href="/login"
        className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
      >
        Back to Sign In
      </Link>
    </div>
  );
}
