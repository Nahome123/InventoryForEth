import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { products, users } from "@/lib/db/schema";
import { getSettings } from "@/lib/analytics";
import { listSales, type SalesFilter } from "@/lib/sales-query";
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
  const [{ rows, count, revenue, completed }, prods, staff] = await Promise.all([
    listSales(db, sp, s.timezone, PAGE, (page - 1) * PAGE),
    db.select({ id: products.id, name: products.name }).from(products).orderBy(asc(products.name)),
    db.select({ id: users.id, name: users.fullName }).from(users).orderBy(asc(users.fullName)),
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
        <div className="flex gap-2">
          <button className="btn-primary flex-1">Search</button>
          <Link className="btn-secondary" href="/sales">
            Reset
          </Link>
        </div>
      </form>
      </FilterPanel>

      <div className="mb-4 grid gap-2.5 sm:grid-cols-3 sm:gap-3">
        <StatTile label="Sales found" value={count} hint={count !== completed ? `${count - completed} voided` : undefined} />
        <StatTile label="Revenue (completed)" value={money(revenue)} />
        <StatTile label="Average sale" value={completed ? money(Math.round(revenue / completed)) : "—"} />
      </div>

      {rows.length === 0 ? (
        <TableWrap>
          <Empty>No sales match these filters.</Empty>
        </TableWrap>
      ) : (
        <>
          <MobileList>
            {rows.map(({ sale, by, items, productNames }) => (
              <MobileCard
                key={sale.id}
                href={`/sales/${sale.id}`}
                muted={sale.status === "voided"}
                title={productNames ?? "—"}
                subtitle={
                  <>
                    <span className="font-mono">{saleNo(sale.id)}</span> · {formatDateTime(sale.soldAt, s.timezone)}
                  </>
                }
                aside={<span className={sale.status === "voided" ? "line-through" : ""}>{money(sale.totalCents)}</span>}
                asideSub={`${items} item${items === 1 ? "" : "s"}`}
                facts={[
                  { label: "Customer", value: sale.customerName ?? "—" },
                  { label: "Payment", value: PAYMENT_LABELS[sale.paymentMethod] },
                  { label: "By", value: by ?? "—" },
                ]}
                footer={
                  sale.status === "voided" || sale.source !== "pos" ? (
                    <>
                      {sale.status === "voided" && <Badge tone="bad">Voided</Badge>}
                      {sale.source === "order" && <Badge tone="accent">Order</Badge>}
                      {sale.source === "import" && <Badge>Imported</Badge>}
                    </>
                  ) : undefined
                }
              />
            ))}
          </MobileList>
          <div className="hidden sm:block">
          <TableWrap>
          <table className="data-table">
            <thead>
              <tr>
                <th>Products</th>
                <th>When</th>
                <th className="hidden md:table-cell">Customer</th>
                <th className="hidden sm:table-cell">Payment</th>
                <th className="num hidden sm:table-cell">Items</th>
                <th className="num">Total</th>
                <th className="hidden lg:table-cell">By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ sale, by, items, productNames }) => (
                <tr key={sale.id} className={`hover:bg-surface-2 ${sale.status === "voided" ? "text-ink-3" : ""}`}>
                  <td className="max-w-md">
                    <Link href={`/sales/${sale.id}`} className="line-clamp-2 font-medium hover:underline" translate="no">
                      {productNames ?? "—"}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                      <span className="font-mono">{saleNo(sale.id)}</span>
                      {sale.status === "voided" && <Badge tone="bad">Voided</Badge>}
                      {sale.source === "order" && <Badge tone="accent">Order</Badge>}
                      {sale.source === "import" && <Badge>Imported</Badge>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-ink-2">{formatDateTime(sale.soldAt, s.timezone)}</td>
                  <td className="hidden md:table-cell">{sale.customerName ?? "—"}</td>
                  <td className="hidden sm:table-cell">{PAYMENT_LABELS[sale.paymentMethod]}</td>
                  <td className="num hidden sm:table-cell">{items}</td>
                  <td className={`num font-semibold ${sale.status === "voided" ? "line-through" : ""}`}>{money(sale.totalCents)}</td>
                  <td className="hidden text-ink-2 lg:table-cell">{by ?? "—"}</td>
                </tr>
              ))}
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
