import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  let session = null;
  try {
    session = await auth();
  } catch {
    // Auth error (e.g. missing env vars) — fall through to login redirect
  }

  if (session?.user) {
    redirect("/wallets");
  }

  redirect("/login");
}
