import { asc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { Executor } from "./db/client";
import { batches, expenses, products } from "./db/schema";

/** URL value for products without a supplier label. */
export const NO_SUPPLIER = "__none";

/**
 * A slice of the business: only the products from one supplier.
 * `products` is a condition on the products table, `expenses` picks the expenses that belong to it
 * (those tied to one of that supplier's import batches).
 */
export type Scope = { products: SQL; expenses: SQL };

export function supplierScope(v: string | undefined): Scope | undefined {
  if (!v) return undefined;
  if (v === NO_SUPPLIER) {
    return { products: isNull(products.supplier), expenses: sql`${expenses.batchId} in (select ${batches.id} from ${batches} where ${batches.supplier} is null)` };
  }
  return { products: eq(products.supplier, v), expenses: sql`${expenses.batchId} in (select ${batches.id} from ${batches} where ${batches.supplier} = ${v})` };
}

/** Supplier toggle options, with product counts. */
export async function supplierOptions(db: Executor) {
  const rows = await db
    .select({ supplier: products.supplier, n: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.active, true))
    .groupBy(products.supplier)
    .orderBy(asc(products.supplier));
  const named = rows.filter((r) => r.supplier).map((r) => ({ value: r.supplier!, label: `${r.supplier} (${Number(r.n)})` }));
  const none = rows.find((r) => !r.supplier);
  return none && named.length ? [...named, { value: NO_SUPPLIER, label: `No supplier (${Number(none.n)})` }] : named;
}
