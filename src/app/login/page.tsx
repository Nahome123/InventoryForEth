import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/analytics";
import { LoginForm } from "./login-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (!(await hasAnyUser())) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  const s = await getSettings(await getDb());
  return (
    <AuthShell storeName={s.storeName} title="Welcome back." subtitle="Sign in with the username and password your store owner gave you.">
      <LoginForm />
    </AuthShell>
  );
}
