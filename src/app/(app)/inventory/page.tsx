import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/analytics";
import { getStockLevels } from "@/lib/inventory";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { Empty, PageHeader, StatTile, StockBadge, TableWrap } from "@/components/ui";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requireUser("viewInventory");
  const sp = await searchParams;
  const db = await getDb();
  const [levels, s] = await Promise.all([getStockLevels(db), getSettings(db)]);
  const showCosts = can(user.role, "viewCosts");
  const out = levels.filter((l) => l.status === "out");
  const low = levels.filter((l) => l.status === "low");
  const value = levels.reduce((sum, l) => sum + Math.max(0, l.onHand) * l.costPriceCents, 0);
  const retail = levels.reduce((sum, l) => sum + Math.max(0, l.onHand) * l.sellPriceCents, 0);
  const reserved = levels.reduce((sum, l) => sum + l.committed, 0);
  const q = (sp.q ?? "").trim().toLowerCase();
  const status = sp.status ?? "attention";
  const rows = levels
    .filter((l) => (status === "attention" ? l.status !== "ok" : status === "all" ? true : l.status === status))
    .filter((l) => !q || l.name.toLowerCase().includes(q) || l.sku.toLowerCase().includes(q) || (l.barcode ?? "") === q)
    .sort((a, b) => a.available - a.reorderLevel - (b.available - b.reorderLevel));

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="On hand = physically in the shop. Reserved = promised to customer orders. Available = on hand − reserved."
        actions={
          <>
            <Link className="btn-secondary" href="/inventory/movements">
              Stock history
            </Link>
            {can(user.role, "adjustStock") && (
              <Link className="btn-primary" href="/inventory/receive">
                Receive delivery
              </Link>
            )}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active products" value={levels.length} hint={`${reserved} units reserved for orders`} />
        <StatTile label="Out of stock" value={out.length} href="/inventory?status=out" />
        <StatTile label="Low stock" value={low.length} hint="At or below reorder level" href="/inventory?status=low" />
        {showCosts ? <StatTile label="Stock value (cost)" value={formatMoney(value, s.currency)} hint={`${formatMoney(retail, s.currency)} at selling price`} /> : <StatTile label="Needs attention" value={out.length + low.length} />}
      </div>

      <form className="my-4 flex flex-wrap gap-2" role="search">
        <input className="input max-w-xs" name="q" type="search" defaultValue={sp.q} placeholder="Search or scan" aria-label="Search" />
        <select className="input w-auto" name="status" defaultValue={status} aria-label="Status">
          <option value="attention">Low or out of stock</option>
          <option value="out">Out of stock</option>
          <option value="low">Low stock</option>
          <option value="ok">In stock</option>
          <option value="all">All products</option>
        </select>
        <button className="btn-secondary">Filter</button>
      </form>

      <TableWrap>
        {rows.length === 0 ? (
          <Empty>{status === "attention" ? "Every product is above its reorder level. 👍" : "No products match."}</Empty>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">On hand</th>
                <th className="num">Reserved</th>
                <th className="num">Available</th>
                <th className="num hidden sm:table-cell">Reorder level</th>
                <th className="hidden md:table-cell">Supplier</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="hover:bg-surface-2">
                  <td>
                    <Link href={`/products/${l.id}`} className="font-medium hover:underline">
                      {l.name}
                    </Link>
                    <div className="font-mono text-xs text-ink-3">{l.sku}</div>
                  </td>
                  <td className="num">{l.onHand}</td>
                  <td className="num text-ink-2">{l.committed || "—"}</td>
                  <td className={`num font-semibold ${l.available < 0 ? "text-bad" : ""}`}>{l.available}</td>
                  <td className="num hidden text-ink-2 sm:table-cell">{l.reorderLevel}</td>
                  <td className="hidden text-ink-2 md:table-cell">{l.supplier ?? "—"}</td>
                  <td>
                    <StockBadge status={l.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableWrap>
    </>
  );
}
