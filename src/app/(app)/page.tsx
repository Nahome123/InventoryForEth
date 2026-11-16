import Link from "next/link";
import { and, asc, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getDashboard, getRestockReport, getTopProducts } from "@/lib/analytics";
import { customerOrders } from "@/lib/db/schema";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { formatPlainDate, orderNo } from "@/lib/format";
import { Alert, Badge, Empty, PageHeader, StatTile, StockBadge } from "@/components/ui";
import { BarChart } from "@/components/bar-chart";

export const metadata = { title: "Home" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const db = await getDb();
  const [d, restock, top, orders] = await Promise.all([
    getDashboard(db),
    getRestockReport(db),
    getTopProducts(db, 30, 5),
    db
      .select()
      .from(customerOrders)
      .where(and(inArray(customerOrders.status, ["pending", "ready"])))
      .orderBy(asc(customerOrders.dueDate))
      .limit(5),
  ]);
  const cur = d.settings.currency;
  const money = (c: number) => formatMoney(c, cur);
  const urgent = restock.rows.filter((r) => r.forecast.urgency !== "ok").sort((a, b) => (a.forecast.urgency === b.forecast.urgency ? a.available - b.available : a.forecast.urgency === "order_now" ? -1 : 1));
  const showCosts = can(user.role, "viewCosts");
  const short = (ymd: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(ymd + "T00:00:00Z"));

  return (
    <>
      {denied && (
        <div className="mb-4">
          <Alert tone="warn">You don&apos;t have access to that page.</Alert>
        </div>
      )}
      <PageHeader
        eyebrow={new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeZone: d.settings.timezone }).format(new Date())}
        title={`Hello, ${user.fullName.split(" ")[0]}.`}
        subtitle="Here's how the shop is doing today."
        actions={
          can(user.role, "recordSales") && (
            <Link href="/sales/new" className="btn-primary lg:hidden">
              + New sale
            </Link>
          )
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Today" value={money(d.today.revenue)} hint={`${d.today.count} sale${d.today.count === 1 ? "" : "s"}`} href="/sales" />
        <StatTile label="Last 7 days" value={money(d.last7.revenue)} hint={`${d.last7.count} sales`} />
        {showCosts ? (
          <StatTile label="Gross profit · 30 days" value={money(d.grossProfit30)} hint={d.marginPct30 !== null ? `${d.marginPct30}% margin on ${money(d.last30.revenue)} sales` : "No sales yet"} />
        ) : (
          <StatTile label="Last 30 days" value={money(d.last30.revenue)} hint={`${d.last30.count} sales`} />
        )}
        <StatTile label="Open customer orders" value={d.openOrders} hint={d.ordersDueSoon ? `${d.ordersDueSoon} due within 3 days` : "None due soon"} href="/orders" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="card p-5 sm:p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold">Daily sales · last 30 days</h2>
          <p className="mb-2 text-xs text-ink-3">Completed sales, in {cur}</p>
          <BarChart
            ariaLabel="Daily sales revenue for the last 30 days"
            axisDivisor={100}
            data={d.series.map((p) => ({ label: short(p.day), value: p.revenue, display: money(p.revenue), sub: `${p.count} sale${p.count === 1 ? "" : "s"}` }))}
          />
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Top sellers · 30 days</h2>
          </div>
          {top.length === 0 ? (
            <Empty>No sales recorded yet.</Empty>
          ) : (
            <ol className="space-y-2">
              {top.map((t, i) => (
                <li key={t.productId} className="flex items-center justify-between gap-2 text-sm">
                  <Link href={`/products/${t.productId}`} className="min-w-0 truncate hover:underline">
                    <span className="mr-2 text-ink-3">{i + 1}.</span>
                    {t.name}
                  </Link>
                  <span className="shrink-0 tabular-nums text-ink-2">
                    {t.qty} · {money(t.revenue)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-5 sm:p-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Needs restocking</h2>
            <Link href={can(user.role, "viewAnalytics") ? "/analytics" : "/inventory?status=low"} className="text-sm font-semibold text-accent-fg hover:underline">
              View all
            </Link>
          </div>
          {urgent.length === 0 ? (
            <Empty>Nothing needs restocking right now. 🎉</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {urgent.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <Link href={`/products/${r.id}`} className="block truncate font-medium hover:underline">
                      {r.name}
                    </Link>
                    <span className="text-xs text-ink-3">
                      {`${r.available} available${r.committed ? ` · ${r.committed} reserved` : ""} · suggest ${r.forecast.suggestedOrderQty}`}
                    </span>
                  </div>
                  {r.forecast.urgency === "order_now" ? <Badge tone="bad">Order now</Badge> : <StockBadge status="low" />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5 sm:p-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Upcoming customer orders</h2>
            <Link href="/orders" className="text-sm font-semibold text-accent-fg hover:underline">
              View all
            </Link>
          </div>
          {orders.length === 0 ? (
            <Empty>No open orders.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <Link href={`/orders/${o.id}`} className="min-w-0 truncate hover:underline">
                    <span className="text-ink-3">{orderNo(o.id)}</span> {o.customerName}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-ink-2">
                    {o.dueDate ? `Due ${formatPlainDate(o.dueDate)}` : "No date"}
                    <Badge tone={o.status === "ready" ? "good" : "neutral"}>{o.status === "ready" ? "Ready" : "Pending"}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
