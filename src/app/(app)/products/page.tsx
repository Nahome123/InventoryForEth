import Link from "next/link";
import clsx from "clsx";
import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { getSettings } from "@/lib/analytics";
import { getStockLevels } from "@/lib/inventory";
import { listOrigins } from "@/lib/profit";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { Badge, Empty, MobileCard, MobileList, PageHeader, StockBadge, TableWrap } from "@/components/ui";
import { Filters } from "@/components/filters";
import { SuggestInput, type Suggestion } from "@/components/suggest-input";
import { SupplierLabeler } from "./supplier-label";
import { batchLabel, batchOptions, parseBatch } from "@/lib/batches";
import { BatchFilter } from "@/components/batch-filter";

export const metadata = { title: "Products" };

type SP = { q?: string; category?: string; show?: string; stock?: string; supplier?: string; batch?: string };
const NO_SUPPLIER = "__none";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("viewInventory");
  const sp = await searchParams;
  const db = await getDb();
  const show = sp.show ?? "active";
  const batch = parseBatch(sp.batch);
  const [allLevels, cats, s, origins, { list: batchList, options: batchOpts }] = await Promise.all([
    getStockLevels(db, { includeInactive: show !== "active" }),
    db.select().from(categories).orderBy(asc(categories.name)),
    getSettings(db),
    listOrigins(db),
    batchOptions(db),
  ]);
  const levels = batch === undefined ? allLevels : allLevels.filter((l) => l.batchId === batch);
  const batchName = new Map(batchList.map((b) => [b.id, batchLabel(b)]));
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const q = (sp.q ?? "").trim().toLowerCase();

  // Supplier buttons: every supplier used on a product, with a count.
  const supplierCounts = new Map<string, number>();
  let unlabelled = 0;
  for (const p of levels) {
    if (show === "inactive" && p.active) continue;
    if (p.supplier) supplierCounts.set(p.supplier, (supplierCounts.get(p.supplier) ?? 0) + 1);
    else unlabelled++;
  }
  const supplierNames = [...supplierCounts.keys()].sort((a, b) => a.localeCompare(b));

  const rows = levels.filter(
    (p) =>
      (show !== "inactive" || !p.active) &&
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase().includes(q) || (p.supplier ?? "").toLowerCase().includes(q)) &&
      (!sp.category || String(p.categoryId) === sp.category) &&
      (!sp.supplier || (sp.supplier === NO_SUPPLIER ? !p.supplier : p.supplier === sp.supplier)) &&
      (!sp.stock || (sp.stock === "low" ? p.status !== "ok" : p.status === sp.stock)),
  );
  const canEdit = can(user.role, "manageProducts");
  const suggestions: Suggestion[] = levels.flatMap((p) => [
    { value: p.name, label: p.name, sub: p.sku },
    { value: p.sku, label: p.sku, sub: p.name },
  ]);
  const href = (patch: Partial<SP>) => {
    const next = Object.fromEntries(Object.entries({ ...sp, ...patch }).filter(([, v]) => v)) as Record<string, string>;
    const qs = new URLSearchParams(next).toString();
    return qs ? `/products?${qs}` : "/products";
  };
  const chip = (active: boolean) =>
    clsx("whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition", active ? "border-accent bg-accent-soft text-accent-fg" : "border-line-strong text-ink-2 hover:bg-surface-2");

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
                  {p.supplier ? ` · ${p.supplier}` : ""}
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
                  <th className="hidden md:table-cell">Supplier</th>
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
                      <div className="font-mono text-xs text-ink-3">
                        {p.sku}
                        {p.batchId && <span className="ml-1.5 rounded bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-ink-2" translate="no">{batchName.get(p.batchId)}</span>}
                      </div>
                    </td>
                    <td className="hidden md:table-cell" translate="no">
                      {p.supplier ? <Badge>{p.supplier}</Badge> : <span className="text-ink-3">—</span>}
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
          {sp.supplier && <input type="hidden" name="supplier" value={sp.supplier} />}
          {sp.batch && <input type="hidden" name="batch" value={sp.batch} />}
          <SuggestInput name="q" defaultValue={sp.q} placeholder="Search name, part no., barcode or supplier" ariaLabel="Search products" suggestions={suggestions} />
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

      <nav className="-mt-2 mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filter by supplier">
        <Link href={href({ supplier: undefined })} className={chip(!sp.supplier)}>
          All suppliers
        </Link>
        {supplierNames.map((name) => (
          <Link key={name} href={href({ supplier: name })} className={chip(sp.supplier === name)} translate="no">
            {`${name} · ${supplierCounts.get(name)}`}
          </Link>
        ))}
        {unlabelled > 0 && (
          <Link href={href({ supplier: NO_SUPPLIER })} className={chip(sp.supplier === NO_SUPPLIER)}>
            {`No supplier · ${unlabelled}`}
          </Link>
        )}
      </nav>

      {canEdit ? (
        <SupplierLabeler
          items={rows.map((p) => ({ id: p.id, name: p.name, sku: p.sku, supplier: p.supplier }))}
          suppliers={[...new Set([...supplierNames, ...origins.map((o) => o.name)])]}
        >
          {list}
        </SupplierLabeler>
      ) : (
        list
      )}
    </>
  );
}
