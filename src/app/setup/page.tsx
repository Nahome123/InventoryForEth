import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth";
import { allTimeZones, COMMON_CURRENCIES } from "@/lib/locale";
import { SetupForm } from "./setup-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "Set up your store" };

export default async function SetupPage() {
  if (await hasAnyUser()) redirect("/login");
  return (
    <AuthShell storeName="Store ERP" title="Let's set up your store." subtitle="This creates the owner account. You can add family members and staff afterwards in Settings.">
      <SetupForm currencies={COMMON_CURRENCIES} timeZones={allTimeZones()} />
    </AuthShell>
  );
}
