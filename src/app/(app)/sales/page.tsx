import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { products, users } from "@/lib/db/schema";
import { getSettings } from "@/lib/analytics";
import { listSales, type SalesFilter } from "@/lib/sales-query";
import { listOrigins } from "@/lib/profit";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { formatDateTime, PAYMENT_LABELS, saleNo } from "@/lib/format";
import { Badge, Empty, MobileCard, MobileList, PageHeader, Pagination, StatTile, TableWrap } from "@/components/ui";
import { FilterPanel } from "@/components/filter-panel";

export const metadata = { title: "Sales history" };
const PAGE = 50;

export default async function SalesPage({ searchParams }: { searchParams: Promise<SalesFilter & { page?: string }> }) {
  const user = await requireUser("recordSales");
  const sp = await searchParams;
  const db = await getDb();
  const s = await getSettings(db);
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ rows, count, revenue, completed, units, totalSales }, prods, staff, origins] = await Promise.all([
    listSales(db, sp, s.timezone, PAGE, (page - 1) * PAGE),
    db.select({ id: products.id, name: products.name }).from(products).orderBy(asc(products.name)),
    db.select({ id: users.id, name: users.fullName }).from(users).orderBy(asc(users.fullName)),
    listOrigins(db),
  ]);
  const filters = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page")) as Record<string, string>;
  const qs = (p: number) => "?" + new URLSearchParams({ ...filters, page: String(p) }).toString();
  const money = (c: number) => formatMoney(c, s.currency);

  return (
    <>
      <PageHeader
        title="Sales history"
        actions={
          <>
            {can(user.role, "importExport") && (
              <a className="btn-secondary" href={`/api/export/sales?${new URLSearchParams(filters)}`}>
                Export CSV
              </a>
            )}
            <Link className="btn-primary" href="/sales/new">
              + New sale
            </Link>
          </>
        }
      />
      <FilterPanel active={Object.keys(filters).length}>
      <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input className="input" type="search" name="q" defaultValue={sp.q} placeholder="Product, customer or sale #" aria-label="Product, customer or sale number" />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" type="date" name="from" defaultValue={sp.from} aria-label="From date" />
          <input className="input" type="date" name="to" defaultValue={sp.to} aria-label="To date" />
        </div>
        <select className="input" name="product" defaultValue={sp.product ?? ""} aria-label="Product">
          <option value="">Any product</option>
          {prods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select className="input" name="method" defaultValue={sp.method ?? ""} aria-label="Payment method">
          <option value="">Any payment</option>
          {Object.entries(PAYMENT_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className="input" name="user" defaultValue={sp.user ?? ""} aria-label="Recorded by">
          <option value="">Anyone</option>
          {staff.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select className="input" name="status" defaultValue={sp.status ?? ""} aria-label="Status">
          <option value="">Completed & voided</option>
          <option value="completed">Completed</option>
          <option value="voided">Voided</option>
        </select>
        <select className="input" name="source" defaultValue={sp.source ?? ""} aria-label="Source">
          <option value="">All sources</option>
          <option value="pos">In-store sale</option>
          <option value="order">Customer order</option>
          <option value="import">Imported</option>
        </select>
        <select className="input" name="origin" defaultValue={sp.origin ?? ""} aria-label="Item origin">
          <option value="">Any origin</option>
          <option value="store">Store stock</option>
          {origins.map((o) => (
            <option key={o.id} value={o.id} translate="no">
              {o.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button className="btn-primary flex-1">Search</button>
          <Link className="btn-secondary" href="/sales">
            Reset
          </Link>
        </div>
      </form>
      </FilterPanel>

      <div className="mb-4 grid gap-2.5 sm:grid-cols-3 sm:gap-3">
        <StatTile
          label="Sales found"
          value={
            <>
              {count}
              <span className="text-ink-3">{` / ${totalSales}`}</span>
            </>
          }
          hint={count !== completed ? `${count - completed} voided` : `of ${totalSales} sales in total`}
        />
        <StatTile label="Quantity sold" value={units} hint="Units in the completed sales found" />
        <StatTile label="Revenue (completed)" value={money(revenue)} />
      </div>

      {rows.length === 0 ? (
        <TableWrap>
          <Empty>No sales match these filters.</Empty>
        </TableWrap>
      ) : (
        <>
          <MobileList>
            {rows.map(({ sale, by, lines }) => {
              const ls = lines ?? [];
              const one = ls.length === 1 ? ls[0] : null;
              return (
                <MobileCard
                  key={sale.id}
                  href={`/sales/${sale.id}`}
                  muted={sale.status === "voided"}
                  title={ls.map((l) => l.name).join(", ") || "—"}
                  subtitle={
                    <>
                      <span className="font-mono">{saleNo(sale.id)}</span>
                      {sale.soldAt ? ` · ${formatDateTime(sale.soldAt, s.timezone)}` : ""}
                      {sale.customerName ? ` · ${sale.customerName}` : ""}
                    </>
                  }
                  aside={<span className={sale.status === "voided" ? "line-through" : ""}>{money(sale.totalCents)}</span>}
                  asideSub={PAYMENT_LABELS[sale.paymentMethod]}
                  facts={
                    one
                      ? [
                          { label: "Sold unit price", value: money(one.soldCents), className: "font-semibold" },
                          { label: "Qty", value: one.qty },
                          { label: "From", value: <span translate="no">{one.origin ?? "Store stock"}</span> },
                          { label: "Cost", value: money(one.costCents), className: "text-xs font-normal text-ink-3" },
                        ]
                      : [
                          { label: "Products", value: ls.length },
                          { label: "Qty", value: ls.reduce((a, l) => a + l.qty, 0) },
                          { label: "By", value: by ?? "—" },
                        ]
                  }
                  footer={
                    <>
                      {!one &&
                        ls.map((l, i) => (
                          <div key={i} className="flex w-full justify-between gap-3 text-xs text-ink-2">
                            <span className="truncate" translate="no">
                              {l.name}
                              {l.origin && <span className="text-ink-3">{` · ${l.origin}`}</span>}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {money(l.soldCents)} × {l.qty}
                              <span className="ml-1 text-ink-3">{`(cost ${money(l.costCents)})`}</span>
                            </span>
                          </div>
                        ))}
                      {sale.status === "voided" && <Badge tone="bad">Voided</Badge>}
                      {sale.source === "order" && <Badge tone="accent">Order</Badge>}
                      {sale.source === "import" && <Badge>Imported</Badge>}
                    </>
                  }
                />
              );
            })}
          </MobileList>
          <div className="hidden sm:block">
          <TableWrap>
          <table className="data-table">
            <thead>
              <tr>
                <th>Products</th>
                <th className="num">Sold unit price</th>
                <th className="num">Qty</th>
                <th className="num">Total</th>
                <th className="hidden md:table-cell">When</th>
                <th className="hidden lg:table-cell">Customer</th>
                <th className="hidden xl:table-cell">Payment</th>
                <th className="hidden xl:table-cell">By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ sale, by, lines }) => {
                const ls = lines ?? [];
                return (
                  <tr key={sale.id} className={`align-top hover:bg-surface-2 ${sale.status === "voided" ? "text-ink-3" : ""}`}>
                    <td className="max-w-xs">
                      <Link href={`/sales/${sale.id}`} className="block font-medium hover:underline" translate="no">
                        {ls.length
                          ? ls.map((l, i) => (
                              <div key={i} className="truncate leading-6">
                                {l.name}
                                {l.origin && <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-normal text-accent-fg">{l.origin}</span>}
                              </div>
                            ))
                          : "—"}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                        <span className="font-mono">{saleNo(sale.id)}</span>
                        {sale.status === "voided" && <Badge tone="bad">Voided</Badge>}
                        {sale.source === "order" && <Badge tone="accent">Order</Badge>}
                        {sale.source === "import" && <Badge>Imported</Badge>}
                      </div>
                    </td>
                    <td className="num font-medium">
                      {ls.map((l, i) => (
                        <div key={i} className="whitespace-nowrap leading-6">
                          {money(l.soldCents)}
                          <span className="ml-1.5 text-[11px] font-normal text-ink-3">{`cost ${money(l.costCents)}`}</span>
                        </div>
                      ))}
                    </td>
                    <td className="num">
                      {ls.map((l, i) => (
                        <div key={i} className="leading-6">{l.qty}</div>
                      ))}
                    </td>
                    <td className={`num font-semibold leading-6 ${sale.status === "voided" ? "line-through" : ""}`}>{money(sale.totalCents)}</td>
                    <td className="hidden whitespace-nowrap leading-6 text-ink-2 md:table-cell">{formatDateTime(sale.soldAt, s.timezone)}</td>
                    <td className="hidden leading-6 lg:table-cell">{sale.customerName ?? "—"}</td>
                    <td className="hidden leading-6 xl:table-cell">{PAYMENT_LABELS[sale.paymentMethod]}</td>
                    <td className="hidden leading-6 text-ink-2 xl:table-cell">{by ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </TableWrap>
          </div>
        </>
      )}
      <Pagination page={page} hasMore={page * PAGE < count} makeHref={qs} />
    </>
  );
}
