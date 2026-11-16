import { and, eq, inArray, sql } from "drizzle-orm";
import type { Executor, Tx } from "./db/client";
import { customerOrders, orderItems, products, stockMovements, type MovementType } from "./db/schema";
import { UserError } from "./errors";

export type MovementInput = {
  productId: number;
  type: MovementType;
  /** Signed quantity change. */
  quantity: number;
  saleId?: number | null;
  note?: string | null;
  userId?: number | null;
};

/**
 * The ONLY way stock levels change. Atomically updates the cached balance and
 * writes an immutable ledger row, so every change is traceable (PRD KPI: 100% logged).
 * Refuses to take stock below zero.
 */
export async function applyMovement(tx: Tx, m: MovementInput): Promise<number> {
  if (!Number.isInteger(m.quantity) || m.quantity === 0) throw new UserError("Quantity must be a non-zero whole number.");
  const [row] = await tx
    .update(products)
    .set({ stockOnHand: sql`${products.stockOnHand} + ${m.quantity}`, updatedAt: new Date() })
    .where(and(eq(products.id, m.productId), sql`${products.stockOnHand} + ${m.quantity} >= 0`))
    .returning({ balance: products.stockOnHand });

  if (!row) {
    const [p] = await tx.select({ name: products.name, onHand: products.stockOnHand }).from(products).where(eq(products.id, m.productId));
    if (!p) throw new UserError("Product not found.");
    throw new UserError(`Not enough stock for "${p.name}": ${p.onHand} on hand, ${-m.quantity} needed.`);
  }

  await tx.insert(stockMovements).values({
    productId: m.productId,
    type: m.type,
    quantity: m.quantity,
    balanceAfter: row.balance,
    saleId: m.saleId ?? null,
    note: m.note?.trim() || null,
    userId: m.userId ?? null,
  });
  return row.balance;
}

export type AdjustKind = "receipt" | "return" | "damage" | "count";

/** Manual stock changes from the inventory screens. */
export async function adjustStock(
  db: Executor,
  input: { productId: number; kind: AdjustKind; quantity: number; note?: string | null; userId: number },
): Promise<number> {
  const qty = input.quantity;
  if (!Number.isInteger(qty) || qty < 0) throw new UserError("Enter a whole number of units.");
  return db.transaction(async (tx) => {
    switch (input.kind) {
      case "receipt":
      case "return":
        if (qty === 0) throw new UserError("Quantity must be at least 1.");
        return applyMovement(tx, { productId: input.productId, type: input.kind, quantity: qty, note: input.note, userId: input.userId });
      case "damage":
        if (qty === 0) throw new UserError("Quantity must be at least 1.");
        return applyMovement(tx, { productId: input.productId, type: "damage", quantity: -qty, note: input.note, userId: input.userId });
      case "count": {
        // Physical count: the quantity entered is the new on-hand figure.
        const [p] = await tx.select({ onHand: products.stockOnHand }).from(products).where(eq(products.id, input.productId)).for("update");
        if (!p) throw new UserError("Product not found.");
        const delta = qty - p.onHand;
        if (delta === 0) return p.onHand;
        return applyMovement(tx, {
          productId: input.productId,
          type: "adjustment",
          quantity: delta,
          note: input.note || `Stock count: ${p.onHand} → ${qty}`,
          userId: input.userId,
        });
      }
    }
  });
}

/** Units reserved by open (pending / ready) customer orders, per product. */
export async function committedByProduct(db: Executor, productIds?: number[]): Promise<Map<number, number>> {
  const rows = await db
    .select({ productId: orderItems.productId, qty: sql<number>`sum(${orderItems.quantity})::int` })
    .from(orderItems)
    .innerJoin(customerOrders, eq(customerOrders.id, orderItems.orderId))
    .where(
      and(
        inArray(customerOrders.status, ["pending", "ready"]),
        productIds && productIds.length ? inArray(orderItems.productId, productIds) : undefined,
      ),
    )
    .groupBy(orderItems.productId);
  return new Map(rows.map((r) => [r.productId, Number(r.qty)]));
}

export type StockStatus = "out" | "low" | "ok";

export function stockStatus(available: number, onHand: number, reorderLevel: number): StockStatus {
  if (onHand <= 0 || available <= 0) return "out";
  if (available <= reorderLevel) return "low";
  return "ok";
}

export type StockLevel = {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  categoryId: number | null;
  unit: string;
  sellPriceCents: number;
  costPriceCents: number;
  reorderLevel: number;
  reorderQty: number;
  leadTimeDays: number | null;
  supplier: string | null;
  active: boolean;
  onHand: number;
  committed: number;
  available: number;
  status: StockStatus;
};

export async function getStockLevels(db: Executor, opts: { includeInactive?: boolean } = {}): Promise<StockLevel[]> {
  const rows = await db
    .select()
    .from(products)
    .where(opts.includeInactive ? undefined : eq(products.active, true))
    .orderBy(products.name);
  const committed = await committedByProduct(db);
  return rows.map((p) => {
    const c = committed.get(p.id) ?? 0;
    const available = p.stockOnHand - c;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      categoryId: p.categoryId,
      unit: p.unit,
      sellPriceCents: p.sellPriceCents,
      costPriceCents: p.costPriceCents,
      reorderLevel: p.reorderLevel,
      reorderQty: p.reorderQty,
      leadTimeDays: p.leadTimeDays,
      supplier: p.supplier,
      active: p.active,
      onHand: p.stockOnHand,
      committed: c,
      available,
      status: stockStatus(available, p.stockOnHand, p.reorderLevel),
    };
  });
}
