import Link from "next/link";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { movementType, products, stockMovements, users, type MovementType } from "@/lib/db/schema";
import { getSettings } from "@/lib/analytics";
import { formatDateTime, MOVEMENT_LABELS, saleNo } from "@/lib/format";
import { Empty, MobileCard, MobileList, PageHeader, Pagination, TableWrap } from "@/components/ui";
import { Filters } from "@/components/filters";

export const metadata = { title: "Stock history" };
const PAGE = 50;

type SP = { product?: string; type?: string; from?: string; to?: string; page?: string };

export default async function MovementsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser("viewInventory");
  const sp = await searchParams;
  const db = await getDb();
  const s = await getSettings(db);
  const page = Math.max(1, Number(sp.page) || 1);
  const productId = Number(sp.product) || undefined;
  const type = movementType.enumValues.includes(sp.type as MovementType) ? (sp.type as MovementType) : undefined;
  const isDate = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const local = sql`(${stockMovements.createdAt} at time zone ${s.timezone})::date`;

  const where = and(
    productId ? eq(stockMovements.productId, productId) : undefined,
    type ? eq(stockMovements.type, type) : undefined,
    isDate(sp.from) ? sql`${local} >= ${sp.from}::date` : undefined,
    isDate(sp.to) ? sql`${local} <= ${sp.to}::date` : undefined,
  );
  const [rows, prods] = await Promise.all([
    db
      .select({ m: stockMovements, name: products.name, sku: products.sku, by: users.fullName })
      .from(stockMovements)
      .innerJoin(products, eq(products.id, stockMovements.productId))
      .leftJoin(users, eq(users.id, stockMovements.userId))
      .where(where)
      .orderBy(desc(stockMovements.id))
      .limit(PAGE + 1)
      .offset((page - 1) * PAGE),
    db.select({ id: products.id, name: products.name }).from(products).orderBy(asc(products.name)),
  ]);
  const hasMore = rows.length > PAGE;
  const qs = (p: number) => "?" + new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), page: String(p) }).toString();

  return (
    <>
      <PageHeader title="Stock history" subtitle="Every change to stock levels, newest first. Entries can't be edited or deleted." />
      <Filters active={[sp.type, sp.from, sp.to].filter(Boolean).length}>
      <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <select className="input" name="product" defaultValue={sp.product ?? ""} aria-label="Product">
          <option value="">All products</option>
          {prods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select className="input filter-extra" name="type" defaultValue={sp.type ?? ""} aria-label="Type">
          <option value="">All types</option>
          {movementType.enumValues.map((t) => (
            <option key={t} value={t}>
              {MOVEMENT_LABELS[t]}
            </option>
          ))}
        </select>
        <input className="input filter-extra" type="date" name="from" defaultValue={sp.from} aria-label="From date" />
        <input className="input filter-extra" type="date" name="to" defaultValue={sp.to} aria-label="To date" />
        <button className="btn-secondary">Filter</button>
      </form>
      </Filters>
      {rows.length === 0 ? (
        <TableWrap>
          <Empty>No stock movements match.</Empty>
        </TableWrap>
      ) : (
        <>
          <MobileList>
            {rows.slice(0, PAGE).map(({ m, name, sku, by }) => (
              <MobileCard
                key={m.id}
                href={`/products/${m.productId}`}
                title={name}
                subtitle={formatDateTime(m.createdAt, s.timezone)}
                aside={<span className={m.quantity > 0 ? "text-good" : "text-bad"}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</span>}
                asideSub={`balance ${m.balanceAfter}`}
                facts={[
                  { label: "Type", value: MOVEMENT_LABELS[m.type] },
                  { label: "SKU", value: <span className="font-mono">{sku}</span> },
                  { label: "By", value: by ?? "—" },
                ]}
                footer={
                  m.saleId || m.note ? (
                    <span className="text-xs text-ink-2">
                      {m.saleId ? saleNo(m.saleId) : ""}
                      {m.saleId && m.note ? " · " : ""}
                      {m.note}
                    </span>
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
                <th>When</th>
                <th>Product</th>
                <th>Type</th>
                <th className="num">Change</th>
                <th className="num">Balance</th>
                <th className="hidden sm:table-cell">By</th>
                <th className="hidden lg:table-cell">Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, PAGE).map(({ m, name, sku, by }) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-ink-2">{formatDateTime(m.createdAt, s.timezone)}</td>
                  <td>
                    <Link href={`/products/${m.productId}`} className="hover:underline">
                      {name}
                    </Link>
                    <div className="font-mono text-xs text-ink-3">{sku}</div>
                  </td>
                  <td className="whitespace-nowrap">
                    {MOVEMENT_LABELS[m.type]}
                    {m.saleId && (
                      <Link href={`/sales/${m.saleId}`} className="ml-1 text-xs text-accent hover:underline">
                        {saleNo(m.saleId)}
                      </Link>
                    )}
                  </td>
                  <td className={`num font-semibold ${m.quantity > 0 ? "text-good" : "text-bad"}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                  <td className="num">{m.balanceAfter}</td>
                  <td className="hidden text-ink-2 sm:table-cell">{by ?? "—"}</td>
                  <td className="hidden max-w-xs truncate text-ink-2 lg:table-cell">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableWrap>
          </div>
        </>
      )}
      <Pagination page={page} hasMore={hasMore} makeHref={qs} />
    </>
  );
}
