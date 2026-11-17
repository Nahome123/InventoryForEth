"use server";

import { revalidatePath } from "next/cache";
import { requireActionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { paymentMethod, type PaymentMethod } from "@/lib/db/schema";
import { errorMessage, UserError } from "@/lib/errors";
import { parseMoneyToCents } from "@/lib/money";
import { createSale, editSale, voidSale } from "@/lib/sales";
import { getSettings } from "@/lib/analytics";
import { parseLocalDateTime } from "@/lib/import";
import { z } from "zod";
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

export async function editSaleAction(saleId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireActionUser("editSales");
    const db = await getDb();
    const s = await getSettings(db);
    let raw: unknown;
    try {
      raw = JSON.parse(String(fd.get("lines") ?? "[]"));
    } catch {
      throw new UserError("Couldn't read the sale lines.");
    }
    const lines = editLinesSchema.safeParse(raw);
    if (!lines.success) throw new UserError(lines.error.issues[0].message);
    const method = String(fd.get("paymentMethod") ?? "cash") as PaymentMethod;
    const dateStr = String(fd.get("soldAt") ?? "").trim();
    let soldAt: Date | null = null;
    if (dateStr) {
      soldAt = parseLocalDateTime(dateStr.replace("T", " "), s.timezone);
      if (!soldAt) throw new UserError("Enter a valid date and time, or leave it blank if unknown.");
      if (soldAt.getTime() > Date.now() + 60_000) throw new UserError("The sale date can't be in the future.");
    }
    await editSale(db, saleId, user.id, { customerName: String(fd.get("customerName") ?? ""), soldAt, paymentMethod: method, lines: lines.data });
    revalidatePath("/sales");
    revalidatePath(`/sales/${saleId}`);
    revalidatePath("/");
    revalidatePath("/profit");
    revalidatePath("/inventory");
    return { ok: "Sale updated." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

const editLinesSchema = z
  .array(
    z.object({
      id: z.number().int().positive(),
      quantity: z.number().int().min(1, "Quantities must be at least 1."),
      unitPriceCents: z.number().int().min(0, "Prices can't be negative."),
      originId: z.number().int().positive().nullable(),
    }),
  )
  .min(1, "A sale needs at least one item.");
