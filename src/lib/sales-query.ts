import { and, desc, eq, exists, ilike, or, sql, type SQL } from "drizzle-orm";
import type { Executor } from "./db/client";
import { toId } from "./ids";
import { SALES_ID } from "./db/outer";
import { paymentMethod, products, saleItems, saleOrigins, sales, users, type PaymentMethod } from "./db/schema";

/** origin: supplier name, or null for store stock. */
export type SaleLineSummary = { name: string; sku: string; qty: number; soldCents: number; costCents: number; origin: string | null };

export type SalesFilter ={ from?: string; to?: string; method?: string; status?: string; product?: string; user?: string; q?: string; source?: string; origin?: string };

const isDate = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

export function salesWhere(f: SalesFilter, tz: string): SQL | undefined {
  const local = sql`(${sales.soldAt} at time zone ${tz})::date`;
  const productId = toId(f.product);
  const userId = toId(f.user);
  const originId = toId(f.origin);
  const q = (f.q ?? "").trim();
  const idFromQ = toId(/^s?-?0*(\d+)$/i.exec(q)?.[1]);
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  return and(
    isDate(f.from) ? sql`${local} >= ${f.from}::date` : undefined,
    isDate(f.to) ? sql`${local} <= ${f.to}::date` : undefined,
    paymentMethod.enumValues.includes(f.method as PaymentMethod) ? eq(sales.paymentMethod, f.method as PaymentMethod) : undefined,
    f.status === "completed" || f.status === "voided" ? eq(sales.status, f.status) : undefined,
    f.source === "pos" || f.source === "order" || f.source === "import" ? eq(sales.source, f.source) : undefined,
    userId ? eq(sales.userId, userId) : undefined,
    productId
      ? exists(
          sql`select 1 from ${saleItems} where ${saleItems.saleId} = ${SALES_ID} and ${saleItems.productId} = ${productId}`,
        )
      : undefined,
    f.origin === "store"
      ? exists(sql`select 1 from ${saleItems} where ${saleItems.saleId} = ${SALES_ID} and ${saleItems.originId} is null`)
      : originId
        ? exists(sql`select 1 from ${saleItems} where ${saleItems.saleId} = ${SALES_ID} and ${saleItems.originId} = ${originId}`)
        : undefined,
    q
      ? or(
          ilike(sales.customerName, like),
          exists(
            sql`select 1 from ${saleItems} join ${products} on ${products.id} = ${saleItems.productId} where ${saleItems.saleId} = ${SALES_ID} and (${products.name} ilike ${like} or ${products.sku} ilike ${like})`,
          ),
          idFromQ ? eq(sales.id, idFromQ) : undefined,
        )
      : undefined,
  );
}

export async function listSales(db: Executor, f: SalesFilter, tz: string, limit: number, offset: number) {
  const where = salesWhere(f, tz);
  const [rows, [totals], [prodCount], [allProducts]] = await Promise.all([
    db
      .select({
        sale: sales,
        by: users.fullName,
        items: sql<number>`(select coalesce(sum(${saleItems.quantity}),0)::int from ${saleItems} where ${saleItems.saleId} = ${SALES_ID})`,
        /** One entry per product line: sold unit price vs the product's own (original) price. */
        lines: sql<SaleLineSummary[] | null>`(select json_agg(json_build_object('name', ${products.name}, 'sku', ${products.sku}, 'qty', ${saleItems.quantity}, 'soldCents', ${saleItems.unitPriceCents}, 'costCents', ${saleItems.unitCostCents}, 'origin', ${saleOrigins.name}) order by ${saleItems.id}) from ${saleItems} join ${products} on ${products.id} = ${saleItems.productId} left join ${saleOrigins} on ${saleOrigins.id} = ${saleItems.originId} where ${saleItems.saleId} = ${SALES_ID})`,
      })
      .from(sales)
      .leftJoin(users, eq(users.id, sales.userId))
      .where(where)
      .orderBy(sql`${sales.soldAt} desc nulls last`, desc(sales.id))
      .limit(limit)
      .offset(offset),
    db
      .select({
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(case when ${sales.status} = 'completed' then ${sales.totalCents} else 0 end),0)::bigint`,
        completed: sql<number>`count(*) filter (where ${sales.status} = 'completed')::int`,
        units: sql<number>`coalesce(sum(case when ${sales.status} = 'completed' then (select sum(${saleItems.quantity}) from ${saleItems} where ${saleItems.saleId} = ${SALES_ID}) else 0 end),0)::int`,
      })
      .from(sales)
      .where(where),
    db
      .select({ n: sql<number>`count(distinct ${saleItems.productId})::int` })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(where),
    db.select({ n: sql<number>`count(*)::int` }).from(products),
  ]);
  return { rows, count: Number(totals.count), revenue: Number(totals.revenue), completed: Number(totals.completed), units: Number(totals.units), productsSold: Number(prodCount.n), totalProducts: Number(allProducts.n) };
}
