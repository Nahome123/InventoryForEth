import Link from "next/link";
import clsx from "clsx";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import { formatPlainDate, todayInZone } from "@/lib/format";
import { EXPENSE_CATEGORIES, getProfitSummary, listExpenses, parsePeriod, periodRange, PERIODS } from "@/lib/profit";
import { Alert, Empty, PageHeader, StatTile, TableWrap } from "@/components/ui";
import { AddExpenseForm, DeleteExpenseButton } from "./forms";
import { batchLabel, batchOptions, parseBatch } from "@/lib/batches";
import { BatchFilter } from "@/components/batch-filter";

export const metadata = { title: "Profit" };

export default async function ProfitPage({ searchParams }: { searchParams: Promise<{ period?: string; batch?: string }> }) {
  await requireUser("viewCosts");
  const sp = await searchParams;
  const period = parsePeriod(sp.period, "all");
  const batch = parseBatch(sp.batch);
  const db = await getDb();
  const s = await getSettings(db);
  const range = periodRange(period, s.timezone);
  const [p, exps, { list: batchList, options: batchOpts }] = await Promise.all([getProfitSummary(db, s.timezone, range, batch), listExpenses(db, range, batch), batchOptions(db)]);
  const batchName = new Map(batchList.map((b) => [b.id, batchLabel(b)]));
  const money = (c: number) => formatMoney(c, s.currency);
  const pct = (v: number | null) => (v === null ? "" : `${v}%`);
  const label = PERIODS.find((x) => x.key === period)!.label;

  return (
    <>
      <PageHeader
        eyebrow="Profit & loss"
        title="Profit"
        subtitle={range.from ? `${formatPlainDate(range.from)} – ${formatPlainDate(range.to!)}` : "Everything recorded so far, including sales without a date."}
      />

      <BatchFilter options={batchOpts} value={sp.batch} />
      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-surface-2 p-1" aria-label="Period">
        {PERIODS.map((x) => (
          <Link
            key={x.key}
            href={`/profit?period=${x.key}${sp.batch ? `&batch=${encodeURIComponent(sp.batch)}` : ""}`}
            aria-current={x.key === period ? "page" : undefined}
            className={clsx("whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium", x.key === period ? "bg-surface shadow-sm" : "text-ink-2")}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {p.undatedSales > 0 && (
        <div className="mb-4">
          <Alert tone="warn">
            {`${p.undatedSales} sale${p.undatedSales === 1 ? " has" : "s have"} no date, so ${p.undatedSales === 1 ? "it's" : "they're"} only counted under “All time”.`}
          </Alert>
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Revenue" value={money(p.revenue)} hint={`${p.sales} completed sale${p.sales === 1 ? "" : "s"}`} href="/sales" />
        <StatTile label="Gross profit" value={<span className={p.gross < 0 ? "text-bad" : "text-accent-fg"}>{money(p.gross)}</span>} hint={p.grossMarginPct !== null ? `${pct(p.grossMarginPct)} margin · revenue − cost of goods` : "Revenue − cost of goods"} />
        <StatTile label="Expenses" value={money(p.expenses)} hint={`${exps.length} expense${exps.length === 1 ? "" : "s"} recorded`} />
        <StatTile label="Net profit" value={<span className={p.net < 0 ? "text-bad" : "text-good"}>{money(p.net)}</span>} hint={p.netMarginPct !== null ? `${pct(p.netMarginPct)} margin · gross profit − expenses` : "Gross profit − expenses"} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-semibold">{`Profit & loss · ${label}`}</h2>
          <dl className="mt-3 text-sm">
            <Row label="Sales revenue" hint="After discounts, voided sales excluded" value={money(p.revenue)} />
            <Row label="− Cost of goods sold" hint="What the sold items cost you" value={`−${money(p.cost)}`} muted />
            <Row label="= Gross profit" value={money(p.gross)} strong tone={p.gross < 0 ? "bad" : "accent"} sub={pct(p.grossMarginPct)} />
            <Row label="− Expenses" hint="Rent, salaries, freight, customs…" value={`−${money(p.expenses)}`} muted />
            <Row label="= Net profit" value={money(p.net)} strong big tone={p.net < 0 ? "bad" : "good"} sub={pct(p.netMarginPct)} />
          </dl>
          <p className="mt-4 text-xs text-ink-3">Buying stock isn&apos;t an expense here. Its cost counts once the items are sold, as cost of goods.</p>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-semibold">By item origin</h2>
          <p className="mb-3 text-xs text-ink-3">Where the sold items came from, chosen on each sale line.</p>
          {p.byOrigin.length === 0 ? (
            <Empty>No sales in this period.</Empty>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Origin</th>
                    <th className="num">Units</th>
                    <th className="num">Revenue</th>
                    <th className="num hidden sm:table-cell">Cost</th>
                    <th className="num">Gross profit</th>
                  </tr>
                </thead>
                <tbody>
                  {p.byOrigin.map((o) => (
                    <tr key={o.originId ?? "store"}>
                      <td className="font-medium" translate={o.originId === null ? undefined : "no"}>
                        {o.name}
                      </td>
                      <td className="num">{o.units}</td>
                      <td className="num">{money(o.revenue)}</td>
                      <td className="num hidden text-ink-2 sm:table-cell">{money(o.cost)}</td>
                      <td className={clsx("num font-semibold", o.gross < 0 && "text-bad")}>
                        {money(o.gross)}
                        {o.revenue > 0 && <div className="text-xs font-normal text-ink-3">{`${Math.round((o.gross / o.revenue) * 100)}%`}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[340px_1fr]">
        <section className="card h-fit p-5 sm:p-6">
          <h2 className="mb-3 text-lg font-semibold">Add an expense</h2>
          <AddExpenseForm today={todayInZone(s.timezone)} categories={EXPENSE_CATEGORIES} batches={batchList.map((b) => ({ id: b.id, label: batchLabel(b) }))} defaultBatch={typeof batch === "number" ? batch : null} />
        </section>

        <section className="min-w-0">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">{`Expenses · ${label}`}</h2>
            {p.byExpenseCategory.length > 0 && (
              <p className="text-xs text-ink-2">
                {p.byExpenseCategory.map((c) => `${c.category} ${money(c.amount)}`).join(" · ")}
              </p>
            )}
          </div>
          <TableWrap>
            {exps.length === 0 ? (
              <Empty>No expenses recorded for this period.</Empty>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th className="hidden sm:table-cell">Note</th>
                    <th className="num">Amount</th>
                    <th className="w-8">
                      <span className="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {exps.map(({ expense: e, by }) => (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap text-ink-2">{formatPlainDate(e.spentOn)}</td>
                      <td>
                        <div className="font-medium">{e.category}</div>
                        {e.batchId && <div className="text-xs text-ink-3" translate="no">{batchName.get(e.batchId)}</div>}
                        {e.note && <div className="text-xs text-ink-3 sm:hidden">{e.note}</div>}
                      </td>
                      <td className="hidden text-ink-2 sm:table-cell">
                        {e.note ?? "—"}
                        {by && <div className="text-xs text-ink-3">{by}</div>}
                      </td>
                      <td className="num font-semibold">{money(e.amountCents)}</td>
                      <td>
                        <DeleteExpenseButton id={e.id} label={`${e.category} ${money(e.amountCents)}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableWrap>
        </section>
      </div>
    </>
  );
}

function Row({ label, hint, value, sub, strong, big, muted, tone }: { label: string; hint?: string; value: string; sub?: string; strong?: boolean; big?: boolean; muted?: boolean; tone?: "good" | "bad" | "accent" }) {
  return (
    <div className={clsx("flex items-baseline justify-between gap-4 py-2.5", strong ? "border-t border-line-strong" : "")}>
      <dt className="min-w-0">
        <span className={clsx(strong ? "font-semibold text-ink" : "text-ink-2")}>{label}</span>
        {hint && <span className="block text-xs text-ink-3">{hint}</span>}
      </dt>
      <dd className="shrink-0 text-right tabular-nums">
        <span
          className={clsx(
            strong && "font-display font-semibold",
            big ? "text-2xl" : strong ? "text-lg" : "",
            muted && "text-ink-2",
            tone === "good" && "text-good",
            tone === "bad" && "text-bad",
            tone === "accent" && "text-accent-fg",
          )}
        >
          {value}
        </span>
        {sub && <span className="block text-xs text-ink-3">{`${sub} margin`}</span>}
      </dd>
    </div>
  );
}
