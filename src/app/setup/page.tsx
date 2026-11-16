import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth";
import { allTimeZones, COMMON_CURRENCIES } from "@/lib/locale";
import { SetupForm } from "./setup-form";

export const metadata = { title: "Set up your store" };

export default async function SetupPage() {
  if (await hasAnyUser()) redirect("/login");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold">Welcome! Let&apos;s set up your store</h1>
        <p className="mb-5 mt-1 text-sm text-ink-2">This creates the owner account. You can add family members and staff afterwards in Settings.</p>
        <SetupForm currencies={COMMON_CURRENCIES} timeZones={allTimeZones()} />
      </div>
    </main>
  );
}
