"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireActionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { expenses } from "@/lib/db/schema";
import { errorMessage, UserError } from "@/lib/errors";
import { parseMoneyToCents } from "@/lib/money";
import type { ActionState } from "@/components/form";

export async function addExpenseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireActionUser("viewCosts");
    const spentOn = String(fd.get("spentOn") ?? "").trim();
    const category = String(fd.get("category") ?? "").trim();
    const amount = parseMoneyToCents(String(fd.get("amount") ?? ""));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) throw new UserError("Choose the date of the expense.");
    if (!category) throw new UserError("Choose or type a category.");
    if (category.length > 60) throw new UserError("Category is too long.");
    if (amount === null || amount <= 0) throw new UserError("Amount must be more than 0.");
    await (await getDb()).insert(expenses).values({ spentOn, category, amountCents: amount, note: String(fd.get("note") ?? "").trim() || null, userId: user.id });
    revalidatePath("/profit");
    revalidatePath("/");
    return { ok: "Expense added." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function deleteExpenseAction(id: number): Promise<void> {
  await requireActionUser("viewCosts");
  await (await getDb()).delete(expenses).where(eq(expenses.id, id));
  revalidatePath("/profit");
  revalidatePath("/");
}
