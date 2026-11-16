"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";
import { hashPassword, requireActionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { sessions, settings, userRole, users, type Role } from "@/lib/db/schema";
import { errorMessage, UserError } from "@/lib/errors";
import { isValidCurrency, isValidTimeZone } from "@/lib/locale";
import type { ActionState } from "@/components/form";

const int = (v: FormDataEntryValue | null, label: string, min: number, max: number) => {
  const n = Number(String(v ?? "").trim());
  if (!Number.isInteger(n) || n < min || n > max) throw new UserError(`${label} must be a whole number between ${min} and ${max}.`);
  return n;
};

export async function saveSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireActionUser("manageSettings");
    const storeName = String(fd.get("storeName") ?? "").trim();
    const currency = String(fd.get("currency") ?? "").trim().toUpperCase();
    const timezone = String(fd.get("timezone") ?? "").trim();
    if (!storeName) throw new UserError("Store name is required.");
    if (!isValidCurrency(currency)) throw new UserError("Invalid currency code.");
    if (!isValidTimeZone(timezone)) throw new UserError("Invalid time zone.");
    const db = await getDb();
    await db
      .update(settings)
      .set({
        storeName,
        currency,
        timezone,
        defaultLeadTimeDays: int(fd.get("defaultLeadTimeDays"), "Lead time", 0, 365),
        coverDays: int(fd.get("coverDays"), "Cover days", 1, 365),
        updatedAt: new Date(),
      })
      .where(eq(settings.id, 1));
    revalidatePath("/", "layout");
    return { ok: "Settings saved." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

function readRole(v: FormDataEntryValue | null): Role {
  const r = String(v ?? "") as Role;
  if (!userRole.enumValues.includes(r)) throw new UserError("Choose a role.");
  return r;
}

export async function addUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireActionUser("manageUsers");
    const username = String(fd.get("username") ?? "").trim();
    const fullName = String(fd.get("fullName") ?? "").trim();
    if (!fullName) throw new UserError("Name is required.");
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) throw new UserError("Username must be 3–32 letters, numbers, dots, dashes or underscores.");
    const passwordHash = await hashPassword(String(fd.get("password") ?? ""));
    const db = await getDb();
    const [clash] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.username}) = lower(${username})`);
    if (clash) throw new UserError("That username is taken.");
    await db.insert(users).values({ username, fullName, passwordHash, role: readRole(fd.get("role")) });
    revalidatePath("/settings");
    return { ok: `Account created for ${fullName}. They can sign in as “${username}”.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

async function assertNotLastOwner(userId: number) {
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, "owner"), eq(users.active, true), ne(users.id, userId)));
  if (Number(n) === 0) throw new UserError("There must always be at least one active owner.");
}

export async function updateUserAction(userId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const me = await requireActionUser("manageUsers");
    const db = await getDb();
    const [target] = await db.select().from(users).where(eq(users.id, userId));
    if (!target) throw new UserError("User not found.");
    const role = readRole(fd.get("role"));
    const active = fd.get("active") === "on";
    const fullName = String(fd.get("fullName") ?? "").trim() || target.fullName;
    if (target.role === "owner" && (role !== "owner" || !active)) await assertNotLastOwner(userId);
    if (userId === me.id && !active) throw new UserError("You can't deactivate your own account.");
    const newPassword = String(fd.get("password") ?? "");
    const patch: Partial<typeof users.$inferInsert> = { role, active, fullName };
    if (newPassword) patch.passwordHash = await hashPassword(newPassword);
    await db.update(users).set(patch).where(eq(users.id, userId));
    // Sign the person out everywhere if access changed, so new rights apply immediately.
    if (!active || role !== target.role || newPassword) {
      if (userId !== me.id) await db.delete(sessions).where(eq(sessions.userId, userId));
    }
    revalidatePath("/settings");
    return { ok: "Saved." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
