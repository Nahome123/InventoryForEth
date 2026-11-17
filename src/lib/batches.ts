import { desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { Executor } from "./db/client";
import { batches, products } from "./db/schema";
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

export const batchLabel = (b: { name: string; supplier: string | null }) => (b.supplier && !b.name.includes(b.supplier) ? `${b.name} · ${b.supplier}` : b.name);

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
