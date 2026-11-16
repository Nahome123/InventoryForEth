import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { saleItems, sales } from "@/lib/db/schema";
import { SupplierGroups } from "./supplier-groups";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/analytics";
import { getStockLevels } from "@/lib/inventory";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { SuggestInput } from "@/components/suggest-input";
import { Empty, MobileCard, MobileList, PageHeader, StatTile, StockBadge, TableWrap } from "@/components/ui";

export const metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; group?: string }> }) {
  const user = await requireUser("viewInventory");
  const sp = await searchParams;
  const db = await getDb();
  const [levels, s, soldRows] = await Promise.all([
    getStockLevels(db),
    getSettings(db),
    db
      .select({ productId: saleItems.productId, qty: sql<number>`sum(${saleItems.quantity})::int` })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(eq(sales.status, "completed"))
      .groupBy(saleItems.productId),
  ]);
  const sold = new Map(soldRows.map((r) => [r.productId, Number(r.qty)]));
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
      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        <StatTile label="Active products" value={levels.length} hint={`${reserved} units reserved for orders`} />
        <StatTile label="Out of stock" value={out.length} href="/inventory?status=out" />
        <StatTile label="Low stock" value={low.length} hint="At or below reorder level" href="/inventory?status=low" />
        {showCosts ? <StatTile label="Stock value (cost)" value={formatMoney(value, s.currency)} hint={`${formatMoney(retail, s.currency)} at selling price`} /> : <StatTile label="Needs attention" value={out.length + low.length} />}
      </div>

      <SupplierGroups
        selected={sp.group}
        canReceive={can(user.role, "adjustStock")}
        money={showCosts ? (c: number) => formatMoney(c, s.currency) : null}
        products={levels.map((l) => ({
          id: l.id,
          name: l.name,
          sku: l.sku,
          supplier: l.supplier,
          onHand: l.onHand,
          available: l.available,
          sold: sold.get(l.id) ?? 0,
          costCents: l.costPriceCents,
          status: l.status,
        }))}
      />

      <h2 className="mt-8 text-lg font-semibold">Stock status</h2>
      <form className="mb-5 mt-3 grid grid-cols-[1fr_auto] gap-2 sm:flex sm:flex-wrap" role="search">
        <SuggestInput className="col-span-2 sm:max-w-xs" name="q" defaultValue={sp.q} placeholder="Search or scan" ariaLabel="Search" suggestions={levels.flatMap((l) => [{ value: l.name, label: l.name, sub: l.sku }, { value: l.sku, label: l.sku, sub: l.name }])} />
        <select className="input sm:w-auto" name="status" defaultValue={status} aria-label="Status">
          <option value="attention">Low or out of stock</option>
          <option value="out">Out of stock</option>
          <option value="low">Low stock</option>
          <option value="ok">In stock</option>
          <option value="all">All products</option>
        </select>
        <button className="btn-secondary">Filter</button>
      </form>

      {rows.length === 0 ? (
        <TableWrap>
          <Empty>{status === "attention" ? "Every product is above its reorder level. 👍" : sp.q ? `Not found: no product matches “${sp.q}”.` : "No products match."}</Empty>
        </TableWrap>
      ) : (
        <>
          <MobileList>
            {rows.map((l) => (
              <MobileCard
                key={l.id}
                href={`/products/${l.id}`}
                title={l.name}
                subtitle={
                  <>
                    <span className="font-mono">{l.sku}</span>
                    {l.supplier ? ` · ${l.supplier}` : ""}
                  </>
                }
                aside={<span className={l.available < 0 ? "text-bad" : ""}>{l.available}</span>}
                asideSub="available"
                facts={[
                  { label: "On hand", value: l.onHand },
                  { label: "Reserved", value: l.committed || "—" },
                  { label: "Reorder at", value: l.reorderLevel },
                ]}
                footer={<StockBadge status={l.status} />}
              />
            ))}
          </MobileList>
          <div className="hidden sm:block">
          <TableWrap>
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
          </TableWrap>
          </div>
        </>
      )}
    </>
  );
}
