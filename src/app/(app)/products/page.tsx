import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { getSettings } from "@/lib/analytics";
import { getStockLevels } from "@/lib/inventory";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { Badge, Empty, MobileCard, MobileList, PageHeader, StockBadge, TableWrap } from "@/components/ui";
import { Filters } from "@/components/filters";
import { SuggestInput, type Suggestion } from "@/components/suggest-input";
import { batchLabel, batchOptions, EARLIER_LABEL, parseBatch } from "@/lib/batches";
import { BatchFilter } from "@/components/batch-filter";

export const metadata = { title: "Products" };

type SP = { q?: string; category?: string; show?: string; stock?: string; batch?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("viewInventory");
  const sp = await searchParams;
  const db = await getDb();
  const show = sp.show ?? "active";
  const batch = parseBatch(sp.batch);
  const [allLevels, cats, s, { list: batchList, options: batchOpts }] = await Promise.all([
    getStockLevels(db, { includeInactive: show !== "active" }),
    db.select().from(categories).orderBy(asc(categories.name)),
    getSettings(db),
    batchOptions(db),
  ]);
  const levels = batch === undefined ? allLevels : allLevels.filter((l) => l.batchId === batch);
  const batchName = new Map(batchList.map((b) => [b.id, batchLabel(b)]));
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const q = (sp.q ?? "").trim().toLowerCase();

  const rows = levels.filter(
    (p) =>
      (show !== "inactive" || !p.active) &&
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase().includes(q)) &&
      (!sp.category || String(p.categoryId) === sp.category) &&
      (!sp.stock || (sp.stock === "low" ? p.status !== "ok" : p.status === sp.stock)),
  );
  const canEdit = can(user.role, "manageProducts");
  const suggestions: Suggestion[] = levels.flatMap((p) => [
    { value: p.name, label: p.name, sub: p.sku },
    { value: p.sku, label: p.sku, sub: p.name },
  ]);
  const list =
    rows.length === 0 ? (
      <TableWrap>
        <Empty>{levels.length === 0 ? "No products yet. Add your first product or import a CSV." : sp.q ? `Not found: no product matches “${sp.q}”.` : "No products match these filters."}</Empty>
      </TableWrap>
    ) : (
      <>
        <MobileList>
          {rows.map((p) => (
            <MobileCard
              key={p.id}
              href={`/products/${p.id}`}
              title={p.name}
              subtitle={
                <>
                  <span className="font-mono">{p.sku}</span>
                  {p.batchId ? ` · ${batchName.get(p.batchId)}` : ""}
                  {p.categoryId ? ` · ${catName.get(p.categoryId)}` : ""}
                </>
              }
              aside={formatMoney(p.sellPriceCents, s.currency)}
              facts={[
                { label: "Reserved", value: p.committed || "—" },
                { label: "Available", value: p.available, className: p.available <= 0 ? "text-bad" : "font-semibold" },
              ]}
              footer={p.active ? <StockBadge status={p.status} /> : <Badge>Deactivated</Badge>}
            />
          ))}
        </MobileList>
        <div className="hidden sm:block">
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="hidden md:table-cell">Batch</th>
                  <th className="hidden lg:table-cell">Category</th>
                  <th className="num">Price</th>
                  <th className="num">Reserved</th>
                  <th className="num">Available</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-2">
                    <td>
                      <Link href={`/products/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <div className="font-mono text-xs text-ink-3">{p.sku}</div>
                    </td>
                    <td className="hidden md:table-cell" translate="no">
                      {p.batchId ? <Badge>{batchName.get(p.batchId)}</Badge> : <span className="text-ink-3">{EARLIER_LABEL}</span>}
                    </td>
                    <td className="hidden text-ink-2 lg:table-cell">{p.categoryId ? catName.get(p.categoryId) : "—"}</td>
                    <td className="num">{formatMoney(p.sellPriceCents, s.currency)}</td>
                    <td className="num text-ink-2">{p.committed || "—"}</td>
                    <td className="num font-semibold">{p.available}</td>
                    <td>{p.active ? <StockBadge status={p.status} /> : <Badge>Deactivated</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </>
    );

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${rows.length} of ${levels.length} products`}
        actions={
          canEdit && (
            <>
              <Link href="/import" className="btn-secondary">
                Import CSV
              </Link>
              <Link href="/products/new" className="btn-primary">
                + New product
              </Link>
            </>
          )
        }
      />
      <BatchFilter options={batchOpts} value={sp.batch} />
      <Filters active={[sp.category, sp.stock, show !== "active" ? show : ""].filter(Boolean).length}>
        <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]" role="search">
          {sp.batch && <input type="hidden" name="batch" value={sp.batch} />}
          <SuggestInput name="q" defaultValue={sp.q} placeholder="Search name, part no. or barcode" ariaLabel="Search products" suggestions={suggestions} />
          <select className="input filter-extra" name="category" defaultValue={sp.category ?? ""} aria-label="Category">
            <option value="">All categories</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="input filter-extra" name="stock" defaultValue={sp.stock ?? ""} aria-label="Stock status">
            <option value="">Any stock</option>
            <option value="low">Low or out</option>
            <option value="out">Out of stock</option>
            <option value="ok">In stock</option>
          </select>
          <select className="input filter-extra" name="show" defaultValue={show} aria-label="Active status">
            <option value="active">Active</option>
            <option value="inactive">Deactivated</option>
            <option value="all">All</option>
          </select>
          <button className="btn-secondary filter-extra" type="submit">
            Filter
          </button>
        </form>
      </Filters>

      {list}
    </>
  );
}
