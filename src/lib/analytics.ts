import { and, eq, gte, sql, type SQL } from "drizzle-orm";
import type { Executor } from "./db/client";
import { categories, customerOrders, orderItems, products, saleItems, sales, settings } from "./db/schema";
import { abcClassify, forecastProduct, WINDOW_DAYS, type ForecastResult } from "./forecast";
import { getStockLevels, type StockLevel } from "./inventory";
import { todayInZone } from "./format";

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

export async function getSettings(db: Executor) {
  const [s] = await db.select().from(settings).where(eq(settings.id, 1));
  return s;
}

const localDay = (tz: string) => sql<string>`to_char(${sales.soldAt} at time zone ${tz}, 'YYYY-MM-DD')`;

/** Completed-sale units and revenue per product per local day since `fromDay`. */
async function dailyProductSales(db: Executor, tz: string, fromDay: string, scope?: SQL) {
  const day = localDay(tz);
  const rows = await db
    .select({
      productId: saleItems.productId,
      day,
      qty: sql<number>`sum(${saleItems.quantity})::int`,
      revenue: sql<number>`sum(${saleItems.lineTotalCents})::bigint`,
      cost: sql<number>`sum(${saleItems.unitCostCents} * ${saleItems.quantity})::bigint`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(
      and(
        eq(sales.status, "completed"),
        sql`(${sales.soldAt} at time zone ${tz})::date >= ${fromDay}::date`,
        scope ? sql`${saleItems.productId} in (select ${products.id} from ${products} where ${scope})` : undefined,
      ),
    )
    .groupBy(sql`1`, sql`2`);
  return rows.map((r) => ({ ...r, qty: Number(r.qty), revenue: Number(r.revenue), cost: Number(r.cost) }));
}

export type RestockRow = StockLevel & { category: string | null; forecast: ForecastResult; abc: "A" | "B" | "C"; revenueInWindow: number };

export async function getRestockReport(db: Executor): Promise<{ rows: RestockRow[]; today: string; windowStart: string }> {
  const s = await getSettings(db);
  const today = todayInZone(s.timezone);
  const windowStart = addDays(today, -(WINDOW_DAYS - 1));
  const [levels, daily, firstSales, cats] = await Promise.all([
    getStockLevels(db),
    dailyProductSales(db, s.timezone, windowStart),
    db
      .select({ productId: saleItems.productId, first: sql<string>`to_char(min(${sales.soldAt}) at time zone ${s.timezone}, 'YYYY-MM-DD')` })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(eq(sales.status, "completed"))
      .groupBy(saleItems.productId),
    db.select().from(categories),
  ]);
  const createdRows = await db.select({ id: products.id, created: sql<string>`to_char(${products.createdAt} at time zone ${s.timezone}, 'YYYY-MM-DD')` }).from(products);
  const created = new Map(createdRows.map((r) => [r.id, r.created]));
  const first = new Map(firstSales.map((r) => [r.productId, r.first]));
  const catName = new Map(cats.map((c) => [c.id, c.name]));

  const series = new Map<number, number[]>();
  const revenue = new Map<number, number>();
  for (const r of daily) {
    const idx = daysBetween(windowStart, r.day);
    if (idx < 0 || idx >= WINDOW_DAYS) continue;
    if (!series.has(r.productId)) series.set(r.productId, new Array(WINDOW_DAYS).fill(0));
    series.get(r.productId)![idx] += r.qty;
    revenue.set(r.productId, (revenue.get(r.productId) ?? 0) + r.revenue);
  }
  const abc = abcClassify(revenue, levels.map((l) => l.id));

  const rows = levels.map((l) => {
    const starts = [created.get(l.id), first.get(l.id)].filter(Boolean) as string[];
    const since = starts.sort()[0] ?? today;
    const forecast = forecastProduct({
      dailyQty: series.get(l.id) ?? new Array(WINDOW_DAYS).fill(0),
      historyDays: daysBetween(since, today) + 1,
      onHand: l.onHand,
      committed: l.committed,
      reorderLevel: l.reorderLevel,
      reorderQty: l.reorderQty,
      leadTimeDays: l.leadTimeDays ?? s.defaultLeadTimeDays,
      coverDays: s.coverDays,
    });
    return { ...l, category: l.categoryId ? (catName.get(l.categoryId) ?? null) : null, forecast, abc: abc.get(l.id) ?? "C", revenueInWindow: revenue.get(l.id) ?? 0 };
  });
  return { rows, today, windowStart };
}

/** `scope`: optional condition on products (e.g. one supplier); sales then count only those products' lines. */
export async function getDashboard(db: Executor, scope?: SQL) {
  const s = await getSettings(db);
  const tz = s.timezone;
  const today = todayInZone(tz);
  const from30 = addDays(today, -29);
  const day = localDay(tz);

  const inScope = scope ? sql`${saleItems.productId} in (select ${products.id} from ${products} where ${scope})` : undefined;
  const orderInScope = scope
    ? sql`exists (select 1 from ${orderItems} where ${orderItems.orderId} = "customer_orders"."id" and ${orderItems.productId} in (select ${products.id} from ${products} where ${scope}))`
    : undefined;
  const [byDay, openOrders, dueSoon] = await Promise.all([
    scope
      ? db
          .select({
            day,
            count: sql<number>`count(distinct ${sales.id})::int`,
            // Share of each sale's discounted total that came from in-scope lines.
            revenue: sql<number>`round(sum(${saleItems.lineTotalCents}::numeric * ${sales.totalCents} / nullif(${sales.subtotalCents},0)))::bigint`,
          })
          .from(saleItems)
          .innerJoin(sales, eq(sales.id, saleItems.saleId))
          .where(and(eq(sales.status, "completed"), sql`(${sales.soldAt} at time zone ${tz})::date >= ${from30}::date`, inScope))
          .groupBy(sql`1`)
      : db
          .select({
            day,
            count: sql<number>`count(*)::int`,
            revenue: sql<number>`sum(${sales.totalCents})::bigint`,
          })
          .from(sales)
          .where(and(eq(sales.status, "completed"), sql`(${sales.soldAt} at time zone ${tz})::date >= ${from30}::date`))
          .groupBy(sql`1`),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerOrders)
      .where(and(sql`${customerOrders.status} in ('pending','ready')`, orderInScope)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerOrders)
      .where(and(sql`${customerOrders.status} in ('pending','ready')`, sql`${customerOrders.dueDate} <= ${addDays(today, 3)}::date`, orderInScope)),
  ]);

  const map = new Map(byDay.map((r) => [r.day, { count: Number(r.count), revenue: Number(r.revenue) }]));
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = addDays(from30, i);
    return { day: d, revenue: map.get(d)?.revenue ?? 0, count: map.get(d)?.count ?? 0 };
  });
  const sum = (arr: typeof series) => arr.reduce((a, r) => ({ revenue: a.revenue + r.revenue, count: a.count + r.count }), { revenue: 0, count: 0 });

  const lines = await dailyProductSales(db, tz, from30, scope);
  const profit30 = lines.reduce((a, r) => a + r.revenue - r.cost, 0);
  const lineRevenue30 = lines.reduce((a, r) => a + r.revenue, 0);

  return {
    settings: s,
    today: sum(series.slice(-1)),
    yesterday: sum(series.slice(-2, -1)),
    last7: sum(series.slice(-7)),
    last30: sum(series),
    grossProfit30: profit30,
    marginPct30: lineRevenue30 > 0 ? Math.round((profit30 / lineRevenue30) * 100) : null,
    series,
    openOrders: Number(openOrders[0]?.count ?? 0),
    ordersDueSoon: Number(dueSoon[0]?.count ?? 0),
  };
}

export async function getTopProducts(db: Executor, days: number, limit = 10, scope?: SQL) {
  const s = await getSettings(db);
  const from = addDays(todayInZone(s.timezone), -(days - 1));
  const rows = await db
    .select({
      productId: saleItems.productId,
      name: products.name,
      sku: products.sku,
      qty: sql<number>`sum(${saleItems.quantity})::int`,
      revenue: sql<number>`sum(${saleItems.lineTotalCents})::bigint`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .innerJoin(products, eq(products.id, saleItems.productId))
    .where(and(eq(sales.status, "completed"), gte(sql`(${sales.soldAt} at time zone ${s.timezone})::date`, sql`${from}::date`), scope))
    .groupBy(saleItems.productId, products.name, products.sku)
    .orderBy(sql`sum(${saleItems.lineTotalCents}) desc`)
    .limit(limit);
  return rows.map((r) => ({ ...r, qty: Number(r.qty), revenue: Number(r.revenue) }));
}
