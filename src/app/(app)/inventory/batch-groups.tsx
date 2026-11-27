import Link from "next/link";
import clsx from "clsx";
import { ChevronDown, PackagePlus, Plus } from "lucide-react";
import { Empty, StockBadge } from "@/components/ui";

const EARLIER = "earlier";

type Item = {
  id: number;
  name: string;
  sku: string;
  batch: string | null;
  batchKey: string;
  onHand: number;
  available: number;
  sold: number;
  costCents: number;
  status: "out" | "low" | "ok";
};

type Group = { key: string; name: string; items: Item[]; onHand: number; sold: number; value: number; bought: number };

/**
 * Inventory grouped by import batch: one card per batch. Opening a card lists its products with
 * total quantity, in stock and sold. The last card starts a new batch import.
 */
export function BatchGroups({ products, selected, canReceive, money, base = "" }: { products: Item[]; selected?: string; canReceive: boolean; money: ((c: number) => string) | null; /** Extra query (e.g. the batch filter) kept on links. */ base?: string }) {
  const home = base ? `/inventory?${base}` : "/inventory";
  const map = new Map<string, Group>();
  for (const p of products) {
    const key = p.batchKey;
    let g = map.get(key);
    if (!g) {
      g = { key, name: p.batch ?? "Earlier stock", items: [], onHand: 0, sold: 0, value: 0, bought: 0 };
      map.set(key, g);
    }
    g.items.push(p);
    g.onHand += p.onHand;
    g.sold += p.sold;
    g.value += Math.max(0, p.onHand) * p.costCents;
    // What the whole batch cost to buy: total qty (in stock + sold) × unit cost.
    g.bought += Math.max(0, p.onHand + p.sold) * p.costCents;
  }
  const groups = [...map.values()].sort((a, b) => (a.key === EARLIER ? 1 : b.key === EARLIER ? -1 : Number(b.key) - Number(a.key)));
  const open = groups.find((g) => g.key === selected);

  return (
    <section className="mt-6" aria-labelledby="by-batch">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="by-batch" className="text-lg font-semibold">
          By batch
        </h2>
        <span className="text-xs text-ink-3">Tap a batch to see its products</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => {
          const isOpen = g.key === selected;
          return (
            <Link
              key={g.key}
              href={isOpen ? home : `/inventory?${base ? `${base}&` : ""}group=${encodeURIComponent(g.key)}#batch-panel`}
              scroll={false}
              aria-expanded={isOpen}
              className={clsx("card block p-4 transition hover:-translate-y-0.5 sm:p-5", isOpen ? "ring-2 ring-accent" : "hover:ring-2 hover:ring-accent/25")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="eyebrow">{`${g.items.length} product${g.items.length === 1 ? "" : "s"}`}</div>
                  <div className={clsx("mt-1 truncate font-display text-lg font-semibold", g.key === EARLIER && "text-ink-2")} translate={g.key === EARLIER ? undefined : "no"}>
                    {g.name}
                  </div>
                </div>
                <ChevronDown size={18} className={clsx("mt-1 shrink-0 text-ink-3 transition", isOpen && "rotate-180")} aria-hidden />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-dashed border-line-strong pt-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-3">In stock</dt>
                  <dd className="font-semibold tabular-nums">{g.onHand}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-3">Sold</dt>
                  <dd className="font-semibold tabular-nums">{g.sold}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-3">{money ? "Total cost" : "Out"}</dt>
                  <dd className="truncate font-semibold tabular-nums">{money ? money(g.bought) : g.items.filter((i) => i.status === "out").length}</dd>
                </div>
              </dl>
            </Link>
          );
        })}

        {canReceive && (
          <Link href="/import" className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-line-strong p-4 text-center text-ink-2 transition hover:border-accent hover:text-accent-fg">
            <Plus size={22} aria-hidden />
            <span className="font-semibold">New batch</span>
            <span className="text-xs text-ink-3">Import a new batch of products</span>
          </Link>
        )}
      </div>

      {open && (
        <div id="batch-panel" className="card mt-4 scroll-mt-24 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg font-semibold" translate={open.key === EARLIER ? undefined : "no"}>
                {open.name}
              </h3>
              <p className="text-xs text-ink-3">{`${open.items.length} products · ${open.onHand + open.sold} total · ${open.onHand} in stock · ${open.sold} sold`}</p>
              {money && <p className="text-xs text-ink-3">{`Total cost ${money(open.bought)} · still in stock ${money(open.value)}`}</p>}
            </div>
            <div className="flex gap-2">
              {canReceive && (
                <Link href={`/products/new${open.key === EARLIER ? "" : `?batch=${open.key}`}`} className="btn-secondary">
                  <Plus size={16} aria-hidden /> Add product
                </Link>
              )}
              {canReceive && (
                <Link href="/inventory/receive" className="btn-primary">
                  <PackagePlus size={16} aria-hidden /> Add stock
                </Link>
              )}
              <Link href={home} scroll={false} className="btn-secondary">
                Close
              </Link>
            </div>
          </div>
          {open.items.length === 0 ? (
            <Empty>No products.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="hidden sm:table-cell">Part no.</th>
                    <th className="num">Total qty</th>
                    <th className="num">In stock</th>
                    <th className="num">Sold</th>
                    <th className="num hidden sm:table-cell">Available</th>
                    {money && <th className="num hidden md:table-cell">Unit cost</th>}
                    {money && <th className="num">Total cost</th>}
                    <th className="hidden sm:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {open.items.map((i) => (
                    <tr key={i.id} className="hover:bg-surface-2">
                      <td className="max-w-[14rem] sm:max-w-sm">
                        <Link href={`/products/${i.id}`} className="block truncate font-medium hover:underline" translate="no">
                          {i.name}
                        </Link>
                        <div className="font-mono text-xs text-ink-3 sm:hidden">{i.sku}</div>
                      </td>
                      <td className="hidden font-mono text-xs text-ink-2 sm:table-cell" translate="no">
                        {i.sku}
                      </td>
                      <td className="num text-ink-2">{i.onHand + i.sold}</td>
                      <td className="num font-semibold">{i.onHand}</td>
                      <td className="num">{i.sold || "—"}</td>
                      <td className={clsx("num hidden sm:table-cell", i.available < 0 && "text-bad")}>{i.available}</td>
                      {money && <td className="num hidden text-ink-2 md:table-cell">{money(i.costCents)}</td>}
                      {money && <td className="num">{money(Math.max(0, i.onHand + i.sold) * i.costCents)}</td>}
                      <td className="hidden sm:table-cell">
                        <StockBadge status={i.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td>Total</td>
                    <td className="hidden sm:table-cell" />
                    <td className="num">{open.onHand + open.sold}</td>
                    <td className="num">{open.onHand}</td>
                    <td className="num">{open.sold}</td>
                    <td className="hidden sm:table-cell" />
                    {money && <td className="hidden md:table-cell" />}
                    {money && <td className="num">{money(open.bought)}</td>}
                    <td className="hidden sm:table-cell" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
