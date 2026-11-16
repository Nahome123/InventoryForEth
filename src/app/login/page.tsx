import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/analytics";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (!(await hasAnyUser())) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  const s = await getSettings(await getDb());
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-xl font-bold text-accent-ink">{s.storeName.slice(0, 1).toUpperCase()}</div>
          <h1 className="text-xl font-bold">{s.storeName}</h1>
          <p className="text-sm text-ink-2">Sign in to continue</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
