"use server";

import { revalidatePath } from "next/cache";
import { requireActionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { paymentMethod, type PaymentMethod } from "@/lib/db/schema";
import { errorMessage, UserError } from "@/lib/errors";
import { parseMoneyToCents } from "@/lib/money";
import { createSale, voidSale } from "@/lib/sales";
import { parseLines } from "@/lib/validation";
import type { ActionState } from "@/components/form";

export type SaleState = (ActionState & { saleId?: number; totalCents?: number; changeCents?: number | null }) | null;

export async function createSaleAction(_: SaleState, fd: FormData): Promise<SaleState> {
  try {
    const user = await requireActionUser("recordSales");
    const items = parseLines(fd.get("lines"));
    if (items.some((i) => i.unitPriceCents === undefined)) throw new UserError("Enter the agreed selling price for every item.");
    const method = String(fd.get("paymentMethod") ?? "cash") as PaymentMethod;
    if (!paymentMethod.enumValues.includes(method)) throw new UserError("Choose a payment method.");
    const discountRaw = String(fd.get("discount") ?? "").trim();
    const discount = discountRaw ? parseMoneyToCents(discountRaw) : 0;
    if (discount === null || discount < 0) throw new UserError("Discount must be a valid amount.");
    if (method === "credit" && !String(fd.get("customerName") ?? "").trim()) throw new UserError("Enter the customer's name for a credit sale.");
    const tenderedRaw = String(fd.get("tendered") ?? "").trim();
    const tendered = tenderedRaw ? parseMoneyToCents(tenderedRaw) : null;

    const sale = await createSale(await getDb(), {
      items,
      discountCents: discount,
      paymentMethod: method,
      customerName: String(fd.get("customerName") ?? ""),
      note: String(fd.get("note") ?? ""),
      userId: user.id,
    });
    revalidatePath("/sales");
    revalidatePath("/");
    const change = tendered !== null && method === "cash" && tendered >= sale.totalCents ? tendered - sale.totalCents : null;
    return { ok: "Sale recorded.", saleId: sale.id, totalCents: sale.totalCents, changeCents: change };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function voidSaleAction(saleId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireActionUser("voidSales");
    await voidSale(await getDb(), saleId, user.id, String(fd.get("reason") ?? ""));
    revalidatePath(`/sales/${saleId}`);
    revalidatePath("/sales");
    return { ok: "Sale voided. Stock has been returned." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
