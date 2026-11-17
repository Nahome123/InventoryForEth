import Link from "next/link";
import { asc, isNotNull } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { products, sales, users } from "@/lib/db/schema";
import { getSettings } from "@/lib/analytics";
import { listSales, type SalesFilter } from "@/lib/sales-query";
import { listOrigins } from "@/lib/profit";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { PAYMENT_LABELS } from "@/lib/format";
import { PageHeader, Pagination, StatTile } from "@/components/ui";
import { FilterPanel } from "@/components/filter-panel";
import { SuggestInput, type Suggestion } from "@/components/suggest-input";
import { SalesList } from "./sales-list";

export const metadata = { title: "Sales history" };
const PAGE = 50;

export default async function SalesPage({ searchParams }: { searchParams: Promise<SalesFilter & { page?: string }> }) {
  const user = await requireUser("recordSales");
  const { status: _ignored, ...sp } = await searchParams;
  const db = await getDb();
  const s = await getSettings(db);
  const page = Math.min(10_000, Math.max(1, Number(sp.page) || 1));
  // Voided sales live on their own page (/sales/voided), so history shows completed sales only.
  const filter: SalesFilter = { ...sp, status: "completed" };
  const [{ rows, count, revenue, units, productsSold, totalProducts }, prods, staff, origins, customers] = await Promise.all([
    listSales(db, filter, s.timezone, PAGE, (page - 1) * PAGE),
    db.select({ id: products.id, name: products.name, sku: products.sku }).from(products).orderBy(asc(products.name)),
    db.select({ id: users.id, name: users.fullName }).from(users).orderBy(asc(users.fullName)),
    listOrigins(db),
    db.selectDistinct({ name: sales.customerName }).from(sales).where(isNotNull(sales.customerName)).limit(500),
  ]);
  const filters = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page")) as Record<string, string>;
  const qs = (p: number) => "?" + new URLSearchParams({ ...filters, page: String(p) }).toString();
  const money = (c: number) => formatMoney(c, s.currency);
  const suggestions: Suggestion[] = [
    ...prods.map((p) => ({ value: p.name, label: p.name, sub: p.sku })),
    ...prods.map((p) => ({ value: p.sku, label: p.sku, sub: p.name })),
    ...customers.filter((c) => c.name).map((c) => ({ value: c.name!, label: c.name!, sub: "customer" })),
  ];

  return (
    <>
      <PageHeader
        title="Sales history"
        actions={
          <>
            <Link className="btn-secondary" href="/sales/voided">
              Voided sales
            </Link>
            {can(user.role, "importExport") && (
              <a className="btn-secondary" href={`/api/export/sales?${new URLSearchParams({ ...filters, status: "completed" })}`}>
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
          <SuggestInput name="q" defaultValue={sp.q} placeholder="Product, part no., customer or sale #" ariaLabel="Search sales" suggestions={suggestions} />
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
          label="Products sold"
          value={
            <>
              {productsSold}
              <span className="text-ink-3">{` / ${totalProducts}`}</span>
            </>
          }
          hint={`${count} sale${count === 1 ? "" : "s"} found`}
        />
        <StatTile label="Quantity sold" value={units} hint="Sum of the Qty column" />
        <StatTile label="Revenue" value={money(revenue)} />
      </div>

      <SalesList
        rows={rows}
        money={money}
        timezone={s.timezone}
        edit={can(user.role, "editSales") ? { origins: origins.map(({ id, name }) => ({ id, name })), currency: s.currency } : undefined}
        empty={sp.q ? `Not found: no sales match “${sp.q}”.` : "No sales match these filters."} />
      <Pagination page={page} hasMore={page * PAGE < count} makeHref={qs} />
    </>
  );
}
