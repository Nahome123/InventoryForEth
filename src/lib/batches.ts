import { and, desc, eq, inArray, isNull, notInArray, or, sql, type SQL } from "drizzle-orm";
import type { Executor } from "./db/client";
import { batches, customerOrders, expenses, orderItems, products, saleItems, sales, stockMovements } from "./db/schema";
import { UserError } from "./errors";
import { toId } from "./ids";

/** URL value for products that aren't in any import batch. */
export const EARLIER = "earlier";
export const EARLIER_LABEL = "Earlier stock";

/** "?batch=" → undefined (all), null (earlier stock) or a batch id. */
export function parseBatch(v: string | undefined): number | null | undefined {
  if (!v) return undefined;
  if (v === EARLIER) return null;
  return toId(v) ?? undefined;
}

/** Condition on products.batch_id for a parsed batch filter. */
export function productBatchWhere(b: number | null | undefined): SQL | undefined {
  if (b === undefined) return undefined;
  return b === null ? isNull(products.batchId) : eq(products.batchId, b);
}

export type BatchRow = { id: number; name: string; supplier: string | null; createdAt: Date; products: number };

export async function listBatches(db: Executor): Promise<BatchRow[]> {
  const rows = await db
    .select({
      id: batches.id,
      name: batches.name,
      supplier: batches.supplier,
      createdAt: batches.createdAt,
      products: sql<number>`(select count(*)::int from ${products} where ${products.batchId} = "batches"."id")`,
    })
    .from(batches)
    .orderBy(desc(batches.id));
  return rows.map((r) => ({ ...r, products: Number(r.products) }));
}

export const batchLabel = (b: { name: string; supplier: string | null }) => b.name;

/** Options for <BatchFilter>: every batch, plus "Earlier stock" when some products have no batch. */
export async function batchOptions(db: Executor) {
  const [list, [earlier]] = await Promise.all([
    listBatches(db),
    db.select({ n: sql<number>`count(*)::int` }).from(products).where(isNull(products.batchId)),
  ]);
  const opts = list.map((b) => ({ value: String(b.id), label: `${batchLabel(b)} (${b.products})` }));
  if (Number(earlier.n) > 0) opts.push({ value: EARLIER, label: `${EARLIER_LABEL} (${Number(earlier.n)})` });
  return { list, options: opts };
}

export type BatchDetail = BatchRow & { units: number; sales: number; mixedSales: number; orders: number };

/** Batches with what deleting each would remove (products, units in stock, sales) and what would block it. */
export async function listBatchDetails(db: Executor): Promise<BatchDetail[]> {
  const list = await listBatches(db);
  if (!list.length) return [];
  const rows = await db.execute<{ batch_id: number; units: number; sales: number; mixed: number; orders: number }>(sql`
    select b.id as batch_id,
      coalesce((select sum(p.stock_on_hand) from products p where p.batch_id = b.id), 0)::int as units,
      (select count(distinct si.sale_id) from sale_items si join products p on p.id = si.product_id where p.batch_id = b.id)::int as sales,
      (select count(distinct si.sale_id) from sale_items si join products p on p.id = si.product_id
         where p.batch_id = b.id and exists (
           select 1 from sale_items o join products op on op.id = o.product_id
           where o.sale_id = si.sale_id and op.batch_id is distinct from b.id))::int as mixed,
      (select count(distinct oi.order_id) from order_items oi join products p on p.id = oi.product_id where p.batch_id = b.id)::int as orders
    from batches b`);
  const byId = new Map((("rows" in rows ? rows.rows : rows) as { batch_id: number; units: number; sales: number; mixed: number; orders: number }[]).map((r) => [Number(r.batch_id), r]));
  return list.map((b) => {
    const r = byId.get(b.id);
    return { ...b, units: Number(r?.units ?? 0), sales: Number(r?.sales ?? 0), mixedSales: Number(r?.mixed ?? 0), orders: Number(r?.orders ?? 0) };
  });
}

/** Renames a batch. Products that carried the old supplier name get the new one. */
export async function renameBatch(db: Executor, id: number, name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  // The supplier is always the batch name.
  const sup = clean || null;
  if (!clean) throw new UserError("Batch name can't be empty.");
  if (clean.length > 80 || (sup?.length ?? 0) > 120) throw new UserError("Name is too long.");
  await db.transaction(async (tx) => {
    const [b] = await tx.select().from(batches).where(eq(batches.id, id)).for("update");
    if (!b) throw new UserError("Batch not found.");
    await tx.update(batches).set({ name: clean, supplier: sup }).where(eq(batches.id, id));
    if (b.supplier !== sup) {
      await tx
        .update(products)
        .set({ supplier: sup, updatedAt: new Date() })
        .where(and(eq(products.batchId, id), b.supplier === null ? isNull(products.supplier) : or(isNull(products.supplier), eq(products.supplier, b.supplier))));
    }
  });
  return clean;
}

/** Products imported before batches existed (no batch yet): how many, and units in stock. */
export async function earlierStockSummary(db: Executor) {
  const [r] = await db
    .select({ products: sql<number>`count(*)::int`, units: sql<number>`coalesce(sum(${products.stockOnHand}),0)::int` })
    .from(products)
    .where(isNull(products.batchId));
  return { products: Number(r?.products ?? 0), units: Number(r?.units ?? 0) };
}

/**
 * Gives the earlier (un-batched) inventory a name: creates a batch and moves every product without
 * a batch into it, so it can be renamed, filtered and managed like any other import.
 * The name is also the supplier: products that had no supplier get it.
 */
export async function nameEarlierStock(db: Executor, userId: number, name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  const sup = clean || null;
  if (!clean) throw new UserError("Name can't be empty.");
  if (clean.length > 80 || (sup?.length ?? 0) > 120) throw new UserError("Name is too long.");
  return db.transaction(async (tx) => {
    const [first] = await tx.select({ at: sql<string | null>`min(${products.createdAt})` }).from(products).where(isNull(products.batchId));
    const [b] = await tx
      .insert(batches)
      .values({ name: clean, supplier: sup, createdBy: userId, ...(first?.at ? { createdAt: new Date(first.at) } : {}) })
      .returning({ id: batches.id });
    const moved = await tx.update(products).set({ batchId: b.id, updatedAt: new Date() }).where(isNull(products.batchId)).returning({ id: products.id });
    if (!moved.length) throw new UserError("There is no earlier stock to name.");
    if (sup) await tx.update(products).set({ supplier: sup }).where(and(eq(products.batchId, b.id), isNull(products.supplier)));
    return { id: b.id, name: clean, products: moved.length };
  });
}

/**
 * Deletes an import batch and everything it brought in: its products, their stock history and the
 * sales made only of its products. Refuses if a sale or customer order also contains other stock,
 * so nothing outside the batch is ever changed. Expenses tied to it are kept (untagged).
 */
export async function deleteBatch(db: Executor, id: number) {
  return db.transaction(async (tx) => {
    const [b] = await tx.select().from(batches).where(eq(batches.id, id)).for("update");
    if (!b) throw new UserError("Batch not found.");
    const ids = (await tx.select({ id: products.id }).from(products).where(eq(products.batchId, id))).map((p) => p.id);
    let salesDeleted = 0;
    if (ids.length) {
      const saleIds = [...new Set((await tx.select({ saleId: saleItems.saleId }).from(saleItems).where(inArray(saleItems.productId, ids))).map((r) => r.saleId))];
      if (saleIds.length) {
        const mixed = await tx
          .select({ saleId: saleItems.saleId })
          .from(saleItems)
          .where(and(inArray(saleItems.saleId, saleIds), notInArray(saleItems.productId, ids)))
          .limit(5);
        if (mixed.length) {
          const nos = [...new Set(mixed.map((m) => `S-${String(m.saleId).padStart(6, "0")}`))].join(", ");
          throw new UserError(`Can't delete: sale ${nos} also contains items from other stock. Void or edit those sales first.`);
        }
      }
      const [ord] = await tx.select({ n: sql<number>`count(*)::int` }).from(orderItems).where(inArray(orderItems.productId, ids));
      if (Number(ord.n) > 0) throw new UserError("Can't delete: customer orders include products from this batch. Remove them from those orders first.");

      await tx.delete(stockMovements).where(inArray(stockMovements.productId, ids));
      if (saleIds.length) {
        await tx.update(customerOrders).set({ fulfilledSaleId: null }).where(inArray(customerOrders.fulfilledSaleId, saleIds));
        await tx.delete(sales).where(inArray(sales.id, saleIds));
        salesDeleted = saleIds.length;
      }
      await tx.delete(products).where(inArray(products.id, ids));
    }
    await tx.update(expenses).set({ batchId: null }).where(eq(expenses.batchId, id));
    await tx.delete(batches).where(eq(batches.id, id));
    return { name: b.name, products: ids.length, sales: salesDeleted };
  });
}
