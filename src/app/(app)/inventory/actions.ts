"use server";

import { revalidatePath } from "next/cache";
import { requireActionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorMessage } from "@/lib/errors";
import { parseLines } from "@/lib/validation";
import { applyMovement } from "@/lib/inventory";
import type { ActionState } from "@/components/form";

export async function receiveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireActionUser("adjustStock");
    const lines = parseLines(fd.get("lines"));
    const note = String(fd.get("note") ?? "").trim() || "Delivery received";
    const db = await getDb();
    await db.transaction(async (tx) => {
      for (const l of lines) await applyMovement(tx, { productId: l.productId, type: "receipt", quantity: l.quantity, note, userId: user.id });
    });
    revalidatePath("/inventory");
    const units = lines.reduce((s, l) => s + l.quantity, 0);
    return { ok: `Delivery saved: ${units} units across ${lines.length} product${lines.length === 1 ? "" : "s"}.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
