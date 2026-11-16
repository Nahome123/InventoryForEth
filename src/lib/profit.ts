import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import type { Executor } from "./db/client";
import { expenses, saleItems, saleOrigins, sales, users } from "./db/schema";
import { addDays } from "./analytics";
import { todayInZone } from "./format";

export const PERIODS = [
  { key: "month", label: "This month" },
  { key: "30d", label: "Last 30 days" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
] as const;
export type PeriodKey = (typeof PERIODS)[number]["key"];

export const EXPENSE_CATEGORIES = ["Rent", "Salaries", "Freight & transport", "Customs & taxes", "Utilities", "Shop supplies", "Other"];

export const STORE_ORIGIN = "Store stock";

export function periodRange(key: PeriodKey, tz: string): { from: string | null; to: string | null } {
  const today = todayInZone(tz);
  if (key === "all") return { from: null, to: null };
  if (key === "30d") return { from: addDays(today, -29), to: today };
  if (key === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

export function parsePeriod(v: string | undefined, fallback: PeriodKey = "month"): PeriodKey {
  return (PERIODS.find((p) => p.key === v)?.key ?? fallback) as PeriodKey;
}

export type OriginProfit = { originId: number | null; name: string; units: number; revenue: number; cost: number; gross: number };

export type ProfitSummary = {
  from: string | null;
  to: string | null;
  sales: number;
  /** Completed sales after discounts. */
  revenue: number;
  /** Cost of the goods sold (cost price at the time of sale). */
  cost: number;
  gross: number;
  expenses: number;
  net: number;
  grossMarginPct: number | null;
  netMarginPct: number | null;
  /** Completed sales with no date. They only count in "All time". */
  undatedSales: number;
  byOrigin: OriginProfit[];
  byExpenseCategory: { category: string; amount: number }[];
};

export async function getProfitSummary(db: Executor, tz: string, range: { from: string | null; to: string | null }): Promise<ProfitSummary> {
  const local = sql`(${sales.soldAt} at time zone ${tz})::date`;
  const saleWhere: SQL | undefined = and(
    eq(sales.status, "completed"),
    range.from ? sql`${local} >= ${range.from}::date` : undefined,
    range.to ? sql`${local} <= ${range.to}::date` : undefined,
  );
  const expWhere = and(range.from ? sql`${expenses.spentOn} >= ${range.from}::date` : undefined, range.to ? sql`${expenses.spentOn} <= ${range.to}::date` : undefined);

  const [[totals], [costRow], origins, [undated], [expTotal], expCats] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int`, revenue: sql<number>`coalesce(sum(${sales.totalCents}),0)::bigint` })
      .from(sales)
      .where(saleWhere),
    db
      .select({ cost: sql<number>`coalesce(sum(${saleItems.unitCostCents}::bigint * ${saleItems.quantity}),0)::bigint` })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(saleWhere),
    db
      .select({
        originId: saleItems.originId,
        name: saleOrigins.name,
        units: sql<number>`sum(${saleItems.quantity})::int`,
        // Spread each sale's discount over its lines so the origins add up to total revenue.
        revenue: sql<number>`round(coalesce(sum(${saleItems.lineTotalCents}::numeric * ${sales.totalCents} / nullif(${sales.subtotalCents},0)),0))::bigint`,
        cost: sql<number>`sum(${saleItems.unitCostCents}::bigint * ${saleItems.quantity})::bigint`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .leftJoin(saleOrigins, eq(saleOrigins.id, saleItems.originId))
      .where(saleWhere)
      .groupBy(saleItems.originId, saleOrigins.name),
    range.from || range.to
      ? db
          .select({ n: sql<number>`count(*)::int` })
          .from(sales)
          .where(and(eq(sales.status, "completed"), sql`${sales.soldAt} is null`))
      : Promise.resolve([{ n: 0 }]),
    db.select({ amount: sql<number>`coalesce(sum(${expenses.amountCents}),0)::bigint` }).from(expenses).where(expWhere),
    db
      .select({ category: expenses.category, amount: sql<number>`sum(${expenses.amountCents})::bigint` })
      .from(expenses)
      .where(expWhere)
      .groupBy(expenses.category)
      .orderBy(desc(sql`2`)),
  ]);

  const revenue = Number(totals.revenue);
  const cost = Number(costRow.cost);
  const gross = revenue - cost;
  const exp = Number(expTotal.amount);
  const net = gross - exp;
  const byOrigin = origins
    .map((o) => {
      const r = Number(o.revenue);
      const c = Number(o.cost);
      return { originId: o.originId, name: o.name ?? STORE_ORIGIN, units: Number(o.units), revenue: r, cost: c, gross: r - c };
    })
    .sort((a, b) => (a.originId === null ? -1 : b.originId === null ? 1 : b.revenue - a.revenue));

  return {
    ...range,
    sales: Number(totals.count),
    revenue,
    cost,
    gross,
    expenses: exp,
    net,
    grossMarginPct: revenue > 0 ? Math.round((gross / revenue) * 1000) / 10 : null,
    netMarginPct: revenue > 0 ? Math.round((net / revenue) * 1000) / 10 : null,
    undatedSales: Number(undated.n),
    byOrigin,
    byExpenseCategory: expCats.map((e) => ({ category: e.category, amount: Number(e.amount) })),
  };
}

export function listExpenses(db: Executor, range: { from: string | null; to: string | null }, limit = 200) {
  return db
    .select({ expense: expenses, by: users.fullName })
    .from(expenses)
    .leftJoin(users, eq(users.id, expenses.userId))
    .where(and(range.from ? sql`${expenses.spentOn} >= ${range.from}::date` : undefined, range.to ? sql`${expenses.spentOn} <= ${range.to}::date` : undefined))
    .orderBy(desc(expenses.spentOn), desc(expenses.id))
    .limit(limit);
}

export function listOrigins(db: Executor, activeOnly = false) {
  return db
    .select({ id: saleOrigins.id, name: saleOrigins.name, active: saleOrigins.active })
    .from(saleOrigins)
    .where(activeOnly ? eq(saleOrigins.active, true) : undefined)
    .orderBy(asc(saleOrigins.id));
}
