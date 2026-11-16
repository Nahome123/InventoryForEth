"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { paymentMethod, type PaymentMethod } from "@/lib/db/schema";
import { errorMessage, UserError } from "@/lib/errors";
import { parseMoneyToCents } from "@/lib/money";
import { createOrder, fulfillOrder, setOrderStatus } from "@/lib/orders";
import { parseLines } from "@/lib/validation";
import type { ActionState } from "@/components/form";

export async function createOrderAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: number;
  try {
    const user = await requireActionUser("manageOrders");
    const depositRaw = String(fd.get("deposit") ?? "").trim();
    const deposit = depositRaw ? parseMoneyToCents(depositRaw) : 0;
    if (deposit === null || deposit < 0) throw new UserError("Deposit must be a valid amount.");
    const order = await createOrder(await getDb(), {
      customerName: String(fd.get("customerName") ?? ""),
      customerPhone: String(fd.get("customerPhone") ?? ""),
      dueDate: String(fd.get("dueDate") ?? "") || null,
      depositCents: deposit,
      note: String(fd.get("note") ?? ""),
      items: parseLines(fd.get("lines")),
      userId: user.id,
    });
    id = order.id;
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/orders");
  redirect(`/orders/${id}?created=1`);
}

export async function setOrderStatusAction(orderId: number, status: "pending" | "ready" | "cancelled", _: ActionState): Promise<ActionState> {
  try {
    await requireActionUser("manageOrders");
    await setOrderStatus(await getDb(), orderId, status);
    revalidatePath(`/orders/${orderId}`);
    return { ok: status === "cancelled" ? "Order cancelled. Reserved stock is released." : status === "ready" ? "Marked ready for pickup." : "Order re-opened." };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function fulfillOrderAction(orderId: number, _: ActionState, fd: FormData): Promise<ActionState> {
  let saleId: number;
  try {
    const user = await requireActionUser("manageOrders");
    const method = String(fd.get("paymentMethod") ?? "cash") as PaymentMethod;
    if (!paymentMethod.enumValues.includes(method)) throw new UserError("Choose a payment method.");
    const sale = await fulfillOrder(await getDb(), orderId, { userId: user.id, paymentMethod: method });
    saleId = sale.id;
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/sales/${saleId}`);
}
