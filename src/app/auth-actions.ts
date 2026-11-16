"use server";

import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings, users } from "@/lib/db/schema";
import { hashPassword, login, logout, startSession } from "@/lib/auth";
import { errorMessage, UserError } from "@/lib/errors";
import { isValidCurrency, isValidTimeZone } from "@/lib/locale";
import type { ActionState } from "@/components/form";

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await login(String(fd.get("username") ?? ""), String(fd.get("password") ?? ""));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect("/");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

export async function setupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const storeName = String(fd.get("storeName") ?? "").trim();
    const currency = String(fd.get("currency") ?? "").trim().toUpperCase();
    const timezone = String(fd.get("timezone") ?? "").trim();
    const fullName = String(fd.get("fullName") ?? "").trim();
    const username = String(fd.get("username") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (!storeName) throw new UserError("Store name is required.");
    if (!isValidCurrency(currency)) throw new UserError("Choose a valid 3-letter currency code, e.g. ETB or USD.");
    if (!isValidTimeZone(timezone)) throw new UserError("Choose a valid time zone.");
    if (!fullName) throw new UserError("Your name is required.");
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) throw new UserError("Username must be 3–32 letters, numbers, dots, dashes or underscores.");
    if (password !== String(fd.get("confirm") ?? "")) throw new UserError("The two passwords don't match.");
    const passwordHash = await hashPassword(password);

    const db = await getDb();
    const userId = await db.transaction(async (tx) => {
      // Serialize concurrent setups; only the very first account may be created here.
      await tx.execute(sql`lock table ${users} in exclusive mode`);
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(users);
      if (Number(n) > 0) throw new UserError("Setup is already complete. Please sign in.");
      await tx.update(settings).set({ storeName, currency, timezone, updatedAt: new Date() }).where(eq(settings.id, 1));
      const [u] = await tx.insert(users).values({ username, fullName, passwordHash, role: "owner" }).returning({ id: users.id });
      return u.id;
    });
    await startSession(userId);
  } catch (e) {
    return { error: errorMessage(e) };
  }
  redirect("/");
}
