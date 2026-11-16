import Link from "next/link";
import clsx from "clsx";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getRestockReport, getSettings, type RestockRow } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import { formatPlainDate } from "@/lib/format";
import { MIN_HISTORY_DAYS, MIN_SALE_DAYS, WINDOW_DAYS } from "@/lib/forecast";
import { Badge, Empty, PageHeader, StatTile, TableWrap } from "@/components/ui";

export const metadata = { title: "Demand & restock" };

const VIEWS = [
  { key: "restock", label: "Restock list" },
  { key: "demand", label: "Demand ranking" },
  { key: "trends", label: "Trends" },
  { key: "slow", label: "Slow movers" },
] as const;

function UrgencyBadge({ r }: { r: RestockRow }) {
  if (r.forecast.urgency === "order_now") return <Badge tone="bad">● Order now</Badge>;
  if (r.forecast.urgency === "order_soon") return <Badge tone="warn">▲ Order soon</Badge>;
  return <Badge tone="good">✓ OK</Badge>;
}

function TrendCell({ r }: { r: RestockRow }) {
  const t = r.forecast.trend;
  if (t === "unknown") return <span className="text-ink-3">—</span>;
  const arrow = t === "rising" ? "↑" : t === "falling" ? "↓" : "→";
  return (
    <span className={clsx("whitespace-nowrap", t === "rising" && "text-good", t === "falling" && "text-bad")}>
      {arrow} {t}
      {r.forecast.trendPct !== null && <span className="text-ink-3"> ({r.forecast.trendPct > 0 ? "+" : ""}{r.forecast.trendPct}%)</span>}
    </span>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireUser("viewAnalytics");
  const { view: v } = await searchParams;
  const view = VIEWS.find((x) => x.key === v)?.key ?? "restock";
  const db = await getDb();
  const [{ rows, windowStart, today }, s] = await Promise.all([getRestockReport(db), getSettings(db)]);
  const money = (c: number) => formatMoney(c, s.currency);
  const weekly = (r: RestockRow) => (r.forecast.enoughHistory ? (r.forecast.avgDailyDemand * 7).toFixed(1) : "—");

  const restock = rows.filter((r) => r.forecast.urgency !== "ok").sort((a, b) => (a.forecast.urgency === b.forecast.urgency ? a.abc.localeCompare(b.abc) || a.available - b.available : a.forecast.urgency === "order_now" ? -1 : 1));
  const restockCost = restock.reduce((a, r) => a + r.forecast.suggestedOrderQty * r.costPriceCents, 0);
  const forecastable = rows.filter((r) => r.forecast.enoughHistory).length;
  const demand = [...rows].sort((a, b) => b.revenueInWindow - a.revenueInWindow || b.forecast.unitsSoldInWindow - a.forecast.unitsSoldInWindow);
  const trends = rows.filter((r) => r.forecast.trend === "rising" || r.forecast.trend === "falling").sort((a, b) => (b.forecast.trendPct ?? 999) - (a.forecast.trendPct ?? 999));
  const slow = rows.filter((r) => r.onHand > 0 && r.forecast.unitsSoldInWindow === 0).sort((a, b) => b.onHand * b.costPriceCents - a.onHand * a.costPriceCents);
  const slowValue = slow.reduce((a, r) => a + r.onHand * r.costPriceCents, 0);

  return (
    <>
      <PageHeader
        title="Demand & restock"
        subtitle={`Based on completed sales from ${formatPlainDate(windowStart)} to ${formatPlainDate(today)} (${WINDOW_DAYS / 7} weeks).`}
        actions={
          <a className="btn-secondary" href="/api/export/restock">
            Export restock list
          </a>
        }
      />
      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        <StatTile label="Order now" value={restock.filter((r) => r.forecast.urgency === "order_now").length} hint="Out, or runs out before a delivery could arrive" href="/analytics?view=restock" />
        <StatTile label="Order soon" value={restock.filter((r) => r.forecast.urgency === "order_soon").length} hint="At or below reorder point" href="/analytics?view=restock" />
        <StatTile label="Suggested purchase" value={money(restockCost)} hint="At cost price" />
        <StatTile label="Forecast coverage" value={`${forecastable} / ${rows.length}`} hint="Products with enough sales history" />
      </div>

      <nav className="my-4 flex gap-1 overflow-x-auto rounded-lg bg-surface-2 p-1" aria-label="Analytics views">
        {VIEWS.map((x) => (
          <Link key={x.key} href={`/analytics?view=${x.key}`} aria-current={x.key === view ? "page" : undefined} className={clsx("whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium", x.key === view ? "bg-surface shadow-sm" : "text-ink-2")}>
            {x.label}
          </Link>
        ))}
      </nav>

      {view === "restock" && (
        <TableWrap>
          {restock.length === 0 ? (
            <Empty>Nothing needs ordering right now.</Empty>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Urgency</th>
                  <th className="num">Available</th>
                  <th className="num hidden sm:table-cell">Sells / week</th>
                  <th className="num hidden md:table-cell">Days left</th>
                  <th className="num hidden md:table-cell">Reorder point</th>
                  <th className="num">Suggested order</th>
                  <th className="hidden lg:table-cell">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {restock.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="max-w-sm">
                      <Link href={`/products/${r.id}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                      <div className="font-mono text-xs text-ink-3">{r.sku}</div>
                      <details className="mt-1 text-xs text-ink-2">
                        <summary className="cursor-pointer select-none text-accent">Why?</summary>
                        <p className="mt-1">{r.forecast.explanation}</p>
                      </details>
                    </td>
                    <td>
                      <UrgencyBadge r={r} />
                    </td>
                    <td className={clsx("num", r.available < 0 && "font-semibold text-bad")}>
                      {r.available}
                      {r.committed > 0 && <div className="text-xs text-ink-3">{r.committed} reserved</div>}
                    </td>
                    <td className="num hidden sm:table-cell">{weekly(r)}</td>
                    <td className="num hidden md:table-cell">{r.forecast.daysOfCover === null ? "—" : Math.floor(r.forecast.daysOfCover)}</td>
                    <td className="num hidden md:table-cell">{r.forecast.reorderPoint}</td>
                    <td className="num text-base font-bold">
                      {r.forecast.suggestedOrderQty}
                      <div className="text-xs font-normal text-ink-3">{money(r.forecast.suggestedOrderQty * r.costPriceCents)}</div>
                    </td>
                    <td className="hidden text-ink-2 lg:table-cell">{r.supplier ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableWrap>
      )}

      {view === "demand" && (
        <TableWrap>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th title="A = top 80% of revenue, B = next 15%, C = the rest">Class</th>
                <th className="num">Units sold</th>
                <th className="num">Revenue</th>
                <th className="num hidden sm:table-cell">Sells / week</th>
                <th className="num hidden md:table-cell">Next 30 days</th>
                <th className="hidden sm:table-cell">Trend</th>
              </tr>
            </thead>
            <tbody>
              {demand.map((r, i) => (
                <tr key={r.id}>
                  <td className="text-ink-3">{i + 1}</td>
                  <td>
                    <Link href={`/products/${r.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    <div className="text-xs text-ink-3">{r.category ?? ""}</div>
                  </td>
                  <td>
                    <Badge tone={r.abc === "A" ? "accent" : "neutral"}>{r.abc === "A" ? "A · high" : r.abc === "B" ? "B · medium" : "C · low"}</Badge>
                  </td>
                  <td className="num">{r.forecast.unitsSoldInWindow}</td>
                  <td className="num">{money(r.revenueInWindow)}</td>
                  <td className="num hidden sm:table-cell">{weekly(r)}</td>
                  <td className="num hidden md:table-cell">{r.forecast.enoughHistory ? `~${r.forecast.forecastNext30}` : "—"}</td>
                  <td className="hidden sm:table-cell">
                    <TrendCell r={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {view === "trends" && (
        <TableWrap>
          {trends.length === 0 ? (
            <Empty>No clear rising or falling trends yet. Trends need 8 weeks of sales.</Empty>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Trend (last 4 weeks vs 4 before)</th>
                  <th className="num">Sells / week</th>
                  <th className="num">Available</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/products/${r.id}`} className="font-medium hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td>
                      <TrendCell r={r} />
                    </td>
                    <td className="num">{weekly(r)}</td>
                    <td className="num">{r.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableWrap>
      )}

      {view === "slow" && (
        <>
          <p className="mb-3 text-sm text-ink-2">
            In stock but not sold at all in the last {WINDOW_DAYS / 7} weeks. That&apos;s {money(slowValue)} of stock at cost. Consider a discount, a bundle, or not reordering.
          </p>
          <TableWrap>
            {slow.length === 0 ? (
              <Empty>Every product in stock sold at least once recently.</Empty>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">On hand</th>
                    <th className="num">Value at cost</th>
                    <th className="hidden sm:table-cell">Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {slow.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/products/${r.id}`} className="font-medium hover:underline">
                          {r.name}
                        </Link>
                        <div className="font-mono text-xs text-ink-3">{r.sku}</div>
                      </td>
                      <td className="num">{r.onHand}</td>
                      <td className="num">{money(r.onHand * r.costPriceCents)}</td>
                      <td className="hidden text-ink-2 sm:table-cell">{r.supplier ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableWrap>
        </>
      )}

      <details className="card mt-6 p-5 sm:p-6 text-sm text-ink-2">
        <summary className="cursor-pointer font-semibold text-ink">How the forecast works</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>We add up each product&apos;s completed sales for each of the last {WINDOW_DAYS / 7} weeks (voided sales are ignored).</li>
          <li>Weekly demand is a weighted average: the most recent week counts most, the oldest least, so the forecast reacts to change without jumping on one odd week.</li>
          <li>
            A product needs at least {MIN_HISTORY_DAYS} days of history and sales on {MIN_SALE_DAYS}+ different days before we forecast it. Until then we use its reorder level.
          </li>
          <li>Reorder point = expected sales during the supplier lead time + a safety buffer (half the lead time&apos;s demand). Your reorder level is used if it&apos;s higher.</li>
          <li>
            When available stock (on hand minus customer orders) reaches the reorder point, we suggest enough to cover the lead time plus {s.coverDays} days, and never less than your usual reorder quantity or what customers have already ordered.
          </li>
          <li>Trend compares the last 4 weeks with the 4 weeks before (±15% or more counts as rising/falling).</li>
        </ol>
        <p className="mt-2">Lead time and cover days can be changed in Settings and per product.</p>
      </details>
    </>
  );
}
