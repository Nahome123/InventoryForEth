import { and, eq, inArray } from "drizzle-orm";
import type { Executor, Tx } from "./db/client";
import { customerOrders, paymentMethod as paymentMethodEnum, products, saleItems, sales, stockMovements, type PaymentMethod } from "./db/schema";
import { UserError } from "./errors";
import { applyMovement } from "./inventory";

export type SaleLineInput = { productId: number; quantity: number; unitPriceCents?: number };

export type CreateSaleInput = {
  items: SaleLineInput[];
  discountCents?: number;
  paymentMethod?: PaymentMethod;
  customerName?: string | null;
  note?: string | null;
  userId: number | null;
  source?: "pos" | "order" | "import";
  orderId?: number | null;
  soldAt?: Date;
  /** Imported historical sales already happened before the current stock count, so they don't move stock. */
  affectStock?: boolean;
  /** Allow sale of inactive products (imports of historical data). */
  allowInactive?: boolean;
};

/** Records a sale and decrements inventory in one transaction. */
export async function createSaleTx(tx: Tx, input: CreateSaleInput) {
  if (!input.items.length) throw new UserError("Add at least one product to the sale.");
  const method = input.paymentMethod ?? "cash";
  if (!paymentMethodEnum.enumValues.includes(method)) throw new UserError("Unknown payment method.");

  // Merge duplicate lines for the same product + price.
  const merged = new Map<string, SaleLineInput>();
  for (const it of input.items) {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) throw new UserError("Each quantity must be a whole number of at least 1.");
    const key = `${it.productId}:${it.unitPriceCents ?? ""}`;
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, quantity: prev.quantity + it.quantity } : { ...it });
  }
  const lines = [...merged.values()];

  const ids = [...new Set(lines.map((l) => l.productId))];
  const prods = await tx.select().from(products).where(inArray(products.id, ids));
  const byId = new Map(prods.map((p) => [p.id, p]));

  const priced = lines.map((l) => {
    const p = byId.get(l.productId);
    if (!p) throw new UserError("One of the products no longer exists.");
    if (!p.active && !input.allowInactive) throw new UserError(`"${p.name}" is deactivated and can't be sold.`);
    const unit = l.unitPriceCents ?? p.sellPriceCents;
    if (!Number.isInteger(unit) || unit < 0) throw new UserError("Invalid price.");
    return { product: p, quantity: l.quantity, unitPriceCents: unit, lineTotalCents: unit * l.quantity };
  });

  const subtotal = priced.reduce((s, l) => s + l.lineTotalCents, 0);
  const discount = input.discountCents ?? 0;
  if (!Number.isInteger(discount) || discount < 0) throw new UserError("Discount must be 0 or more.");
  if (discount > subtotal) throw new UserError("Discount can't be larger than the subtotal.");

  const [sale] = await tx
    .insert(sales)
    .values({
      soldAt: input.soldAt ?? new Date(),
      customerName: input.customerName?.trim() || null,
      paymentMethod: method,
      subtotalCents: subtotal,
      discountCents: discount,
      totalCents: subtotal - discount,
      source: input.source ?? "pos",
      orderId: input.orderId ?? null,
      note: input.note?.trim() || null,
      userId: input.userId,
    })
    .returning();

  await tx.insert(saleItems).values(
    priced.map((l) => ({
      saleId: sale.id,
      productId: l.product.id,
      quantity: l.quantity,
      unitPriceCents: l.unitPriceCents,
      unitCostCents: l.product.costPriceCents,
      lineTotalCents: l.lineTotalCents,
    })),
  );

  if (input.affectStock !== false) {
    for (const l of priced) {
      await applyMovement(tx, { productId: l.product.id, type: "sale", quantity: -l.quantity, saleId: sale.id, userId: input.userId });
    }
  }
  return sale;
}

export function createSale(db: Executor, input: CreateSaleInput) {
  return db.transaction((tx) => createSaleTx(tx, input));
}

/**
 * Voids a completed sale. Stock taken by the sale is returned by reversing its
 * exact ledger rows, so imported (non-stock) sales return nothing.
 * A voided order sale re-opens its customer order as "ready".
 */
export async function voidSale(db: Executor, saleId: number, userId: number, reason: string) {
  if (!reason.trim()) throw new UserError("Please give a reason for voiding the sale.");
  return db.transaction(async (tx) => {
    const [sale] = await tx.select().from(sales).where(eq(sales.id, saleId)).for("update");
    if (!sale) throw new UserError("Sale not found.");
    if (sale.status === "voided") throw new UserError("This sale is already voided.");

    const moves = await tx
      .select()
      .from(stockMovements)
      .where(and(eq(stockMovements.saleId, saleId), eq(stockMovements.type, "sale")));
    for (const m of moves) {
      await applyMovement(tx, { productId: m.productId, type: "sale_void", quantity: -m.quantity, saleId, userId, note: reason });
    }

    await tx.update(sales).set({ status: "voided", voidedAt: new Date(), voidedBy: userId, voidReason: reason.trim() }).where(eq(sales.id, saleId));

    if (sale.orderId) {
      await tx
        .update(customerOrders)
        .set({ status: "ready", fulfilledSaleId: null, updatedAt: new Date() })
        .where(eq(customerOrders.id, sale.orderId));
    }
  });
}
