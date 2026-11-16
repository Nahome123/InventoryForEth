import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getSettings } from "@/lib/analytics";
import { allTimeZones, COMMON_CURRENCIES } from "@/lib/locale";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { Badge, PageHeader } from "@/components/ui";
import { listOrigins } from "@/lib/profit";
import { AddOriginForm, AddUserForm, EditOriginForm, EditUserForm, StoreSettingsForm } from "./forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireUser("manageUsers");
  const db = await getDb();
  const [s, people, origins] = await Promise.all([getSettings(db), db.select().from(users).orderBy(asc(users.fullName)), listOrigins(db)]);
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Settings" />
      <section className="card p-5 sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Store</h2>
        <StoreSettingsForm initial={s} currencies={COMMON_CURRENCIES} timeZones={allTimeZones()} />
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Item origins</h2>
        <p className="mb-4 mt-1 text-sm text-ink-2">
          When recording a sale, each item can be marked as coming from <strong>Store stock</strong> (the default) or from one of these suppliers. Profit is then
          broken down by origin on the Profit page.
        </p>
        <ul className="mb-4 space-y-2">
          {origins.map((o) => (
            <li key={o.id}>
              <EditOriginForm origin={o} />
            </li>
          ))}
        </ul>
        <AddOriginForm />
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">People</h2>
        <ul className="mb-4 mt-1 space-y-0.5 text-xs text-ink-3">
          {(["owner", "manager", "cashier"] as const).map((r) => (
            <li key={r}>
              <strong className="text-ink-2">{ROLE_LABELS[r]}:</strong> {ROLE_DESCRIPTIONS[r]}
            </li>
          ))}
        </ul>
        <ul className="divide-y divide-line">
          {people.map((u) => (
            <li key={u.id} className="py-3">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span className="font-mono text-ink-2">@{u.username}</span>
                {u.id === me.id && <Badge tone="accent">You</Badge>}
                {!u.active && <Badge tone="bad">Deactivated</Badge>}
              </div>
              <EditUserForm user={u} isMe={u.id === me.id} />
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Add a family member or employee</h2>
        <AddUserForm />
      </section>
    </div>
  );
}
