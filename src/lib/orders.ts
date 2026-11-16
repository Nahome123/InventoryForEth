import { eq, inArray } from "drizzle-orm";
import type { Executor } from "./db/client";
import { customerOrders, orderItems, products, type OrderStatus, type PaymentMethod } from "./db/schema";
import { UserError } from "./errors";
import { createSaleTx } from "./sales";

export type CreateOrderInput = {
  customerName: string;
  customerPhone?: string | null;
  dueDate?: string | null; // YYYY-MM-DD
  depositCents?: number;
  note?: string | null;
  items: { productId: number; quantity: number }[];
  userId: number;
};

/**
 * Creates a future customer order. Orders reserve ("commit") stock but don't move it;
 * they may exceed what's available, which shows up as a shortfall to restock.
 */
export async function createOrder(db: Executor, input: CreateOrderInput) {
  const name = input.customerName.trim();
  if (!name) throw new UserError("Customer name is required.");
  if (!input.items.length) throw new UserError("Add at least one product to the order.");
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new UserError("Invalid due date.");
  const deposit = input.depositCents ?? 0;
  if (!Number.isInteger(deposit) || deposit < 0) throw new UserError("Deposit must be 0 or more.");

  const qtyByProduct = new Map<number, number>();
  for (const it of input.items) {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) throw new UserError("Each quantity must be a whole number of at least 1.");
    qtyByProduct.set(it.productId, (qtyByProduct.get(it.productId) ?? 0) + it.quantity);
  }

  return db.transaction(async (tx) => {
    const prods = await tx.select().from(products).where(inArray(products.id, [...qtyByProduct.keys()]));
    if (prods.length !== qtyByProduct.size) throw new UserError("One of the products no longer exists.");
    const inactive = prods.find((p) => !p.active);
    if (inactive) throw new UserError(`"${inactive.name}" is deactivated.`);
    const total = prods.reduce((s, p) => s + p.sellPriceCents * qtyByProduct.get(p.id)!, 0);
    if (deposit > total) throw new UserError("Deposit can't be more than the order total.");

    const [order] = await tx
      .insert(customerOrders)
      .values({
        customerName: name,
        customerPhone: input.customerPhone?.trim() || null,
        dueDate: input.dueDate || null,
        depositCents: deposit,
        note: input.note?.trim() || null,
        createdBy: input.userId,
      })
      .returning();
    await tx.insert(orderItems).values(prods.map((p) => ({ orderId: order.id, productId: p.id, quantity: qtyByProduct.get(p.id)!, unitPriceCents: p.sellPriceCents })));
    return order;
  });
}

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pending: ["ready", "cancelled"],
  ready: ["pending", "cancelled"],
  fulfilled: [],
  cancelled: ["pending"],
};

export async function setOrderStatus(db: Executor, orderId: number, next: "pending" | "ready" | "cancelled") {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(customerOrders).where(eq(customerOrders.id, orderId)).for("update");
    if (!o) throw new UserError("Order not found.");
    if (!ALLOWED[o.status].includes(next)) throw new UserError(`Can't change a ${o.status} order to ${next}.`);
    await tx.update(customerOrders).set({ status: next, updatedAt: new Date() }).where(eq(customerOrders.id, orderId));
  });
}

/** Hands the goods to the customer: records the sale (at the order's agreed prices) and deducts stock. */
export async function fulfillOrder(db: Executor, orderId: number, opts: { userId: number; paymentMethod?: PaymentMethod; discountCents?: number }) {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(customerOrders).where(eq(customerOrders.id, orderId)).for("update");
    if (!o) throw new UserError("Order not found.");
    if (o.status !== "pending" && o.status !== "ready") throw new UserError(`This order is already ${o.status}.`);
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const sale = await createSaleTx(tx, {
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPriceCents: i.unitPriceCents })),
      paymentMethod: opts.paymentMethod,
      discountCents: opts.discountCents,
      customerName: o.customerName,
      note: o.depositCents ? `Order ${orderId}; deposit of ${(o.depositCents / 100).toFixed(2)} paid earlier` : `Order ${orderId}`,
      userId: opts.userId,
      source: "order",
      orderId,
    });
    await tx.update(customerOrders).set({ status: "fulfilled", fulfilledSaleId: sale.id, updatedAt: new Date() }).where(eq(customerOrders.id, orderId));
    return sale;
  });
}
