import { and, desc, eq, exists, ilike, or, sql, type SQL } from "drizzle-orm";
import type { Executor } from "./db/client";
import { paymentMethod, saleItems, sales, users, type PaymentMethod } from "./db/schema";

export type SalesFilter = { from?: string; to?: string; method?: string; status?: string; product?: string; user?: string; q?: string; source?: string };

const isDate = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

export function salesWhere(f: SalesFilter, tz: string): SQL | undefined {
  const local = sql`(${sales.soldAt} at time zone ${tz})::date`;
  const productId = Number(f.product) || null;
  const userId = Number(f.user) || null;
  const q = (f.q ?? "").trim();
  const idFromQ = /^s?-?0*(\d+)$/i.exec(q)?.[1];
  return and(
    isDate(f.from) ? sql`${local} >= ${f.from}::date` : undefined,
    isDate(f.to) ? sql`${local} <= ${f.to}::date` : undefined,
    paymentMethod.enumValues.includes(f.method as PaymentMethod) ? eq(sales.paymentMethod, f.method as PaymentMethod) : undefined,
    f.status === "completed" || f.status === "voided" ? eq(sales.status, f.status) : undefined,
    f.source === "pos" || f.source === "order" || f.source === "import" ? eq(sales.source, f.source) : undefined,
    userId ? eq(sales.userId, userId) : undefined,
    productId
      ? exists(
          sql`select 1 from ${saleItems} where ${saleItems.saleId} = ${sales.id} and ${saleItems.productId} = ${productId}`,
        )
      : undefined,
    q ? or(ilike(sales.customerName, `%${q.replace(/[%_\\]/g, "\\$&")}%`), idFromQ ? eq(sales.id, Number(idFromQ)) : undefined) : undefined,
  );
}

export async function listSales(db: Executor, f: SalesFilter, tz: string, limit: number, offset: number) {
  const where = salesWhere(f, tz);
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        sale: sales,
        by: users.fullName,
        items: sql<number>`(select coalesce(sum(${saleItems.quantity}),0)::int from ${saleItems} where ${saleItems.saleId} = ${sales.id})`,
      })
      .from(sales)
      .leftJoin(users, eq(users.id, sales.userId))
      .where(where)
      .orderBy(desc(sales.soldAt), desc(sales.id))
      .limit(limit)
      .offset(offset),
    db
      .select({
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(case when ${sales.status} = 'completed' then ${sales.totalCents} else 0 end),0)::bigint`,
        completed: sql<number>`count(*) filter (where ${sales.status} = 'completed')::int`,
      })
      .from(sales)
      .where(where),
  ]);
  return { rows, count: Number(totals.count), revenue: Number(totals.revenue), completed: Number(totals.completed) };
}
