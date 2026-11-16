"use server";

import { revalidatePath } from "next/cache";
import { inArray } from "drizzle-orm";
import { requireActionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { errorMessage, UserError } from "@/lib/errors";
import { parseLines } from "@/lib/validation";
import { applyMovement } from "@/lib/inventory";
import type { ActionState } from "@/components/form";

export async function receiveAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireActionUser("adjustStock");
    const lines = parseLines(fd.get("lines"));
    const supplier = String(fd.get("supplier") ?? "").trim().replace(/\s+/g, " ");
    if (supplier.length > 120) throw new UserError("Supplier name is too long.");
    const extra = String(fd.get("note") ?? "").trim();
    const note = [supplier ? `From ${supplier}` : "Delivery received", extra].filter(Boolean).join(" · ");
    const db = await getDb();
    await db.transaction(async (tx) => {
      for (const l of lines) await applyMovement(tx, { productId: l.productId, type: "receipt", quantity: l.quantity, note, userId: user.id });
      if (supplier && fd.get("label") === "on") {
        await tx
          .update(products)
          .set({ supplier, updatedAt: new Date() })
          .where(inArray(products.id, [...new Set(lines.map((l) => l.productId))]));
      }
    });
    revalidatePath("/inventory");
    revalidatePath("/products");
    const units = lines.reduce((s, l) => s + l.quantity, 0);
    return { ok: `Delivery saved: ${units} units across ${lines.length} product${lines.length === 1 ? "" : "s"}${supplier ? ` from ${supplier}` : ""}.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
