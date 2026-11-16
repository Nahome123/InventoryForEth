import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { getSettings } from "@/lib/analytics";
import { getStockLevels } from "@/lib/inventory";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { Badge, Empty, PageHeader, StockBadge, TableWrap } from "@/components/ui";

export const metadata = { title: "Products" };

type SP = { q?: string; category?: string; show?: string; stock?: string };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("viewInventory");
  const sp = await searchParams;
  const db = await getDb();
  const show = sp.show ?? "active";
  const [levels, cats, s] = await Promise.all([getStockLevels(db, { includeInactive: show !== "active" }), db.select().from(categories).orderBy(asc(categories.name)), getSettings(db)]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const q = (sp.q ?? "").trim().toLowerCase();
  const rows = levels.filter(
    (p) =>
      (show !== "inactive" || !p.active) &&
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? "").includes(q) || (p.supplier ?? "").toLowerCase().includes(q)) &&
      (!sp.category || String(p.categoryId) === sp.category) &&
      (!sp.stock || (sp.stock === "low" ? p.status !== "ok" : p.status === sp.stock)),
  );
  const showCosts = can(user.role, "viewCosts");

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${rows.length} of ${levels.length} products`}
        actions={
          can(user.role, "manageProducts") && (
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
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]" role="search">
        <input className="input" name="q" defaultValue={sp.q} placeholder="Search name, SKU, barcode or supplier" aria-label="Search products" type="search" />
        <select className="input" name="category" defaultValue={sp.category ?? ""} aria-label="Category">
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input" name="stock" defaultValue={sp.stock ?? ""} aria-label="Stock status">
          <option value="">Any stock</option>
          <option value="low">Low or out</option>
          <option value="out">Out of stock</option>
          <option value="ok">In stock</option>
        </select>
        <select className="input" name="show" defaultValue={show} aria-label="Active status">
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
          <option value="all">All</option>
        </select>
        <button className="btn-secondary" type="submit">
          Filter
        </button>
      </form>

      <TableWrap>
        {rows.length === 0 ? (
          <Empty>{levels.length === 0 ? "No products yet. Add your first product or import a CSV." : "No products match these filters."}</Empty>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="hidden md:table-cell">Category</th>
                <th className="num">Price</th>
                {showCosts && <th className="num hidden sm:table-cell">Cost</th>}
                <th className="num">On hand</th>
                <th className="num hidden sm:table-cell">Reserved</th>
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
                  <td className="hidden text-ink-2 md:table-cell">{p.categoryId ? catName.get(p.categoryId) : "—"}</td>
                  <td className="num">{formatMoney(p.sellPriceCents, s.currency)}</td>
                  {showCosts && <td className="num hidden text-ink-2 sm:table-cell">{formatMoney(p.costPriceCents, s.currency)}</td>}
                  <td className="num">{p.onHand}</td>
                  <td className="num hidden text-ink-2 sm:table-cell">{p.committed || "—"}</td>
                  <td className="num font-semibold">{p.available}</td>
                  <td>{p.active ? <StockBadge status={p.status} /> : <Badge>Deactivated</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableWrap>
    </>
  );
}
