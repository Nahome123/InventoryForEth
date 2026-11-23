"use client";

import { useMemo, useRef, useState } from "react";
import { Minus, Plus, ScanBarcode, Trash2 } from "lucide-react";
import clsx from "clsx";

export type PickProduct = {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  priceCents: number;
  onHand: number;
  available: number;
  unit: string;
  /** Buying price; only sent to the sale screen as a hint for the seller. */
  costCents?: number;
  /** Import batch name, when the product belongs to one (the same part can exist in several batches). */
  batch?: string;
};

/** originId: where the item came from; null/undefined = store stock (sales only). */
export type CartLine = { productId: number; quantity: number; originId?: number | null; /** Selling price as typed by the seller (sales only). */ price?: string };
export type OriginOption = { id: number; name: string };

/** "1,250.50" -> 125050; "" or invalid -> null. */
export function parsePrice(s: string | undefined): number | null {
  const t = (s ?? "").replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

export function fmtMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(cents / 100);
  } catch {
    return (cents / 100).toFixed(2);
  }
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  return {
    lines,
    add(productId: number, qty = 1) {
      setLines((ls) => {
        const i = ls.findIndex((l) => l.productId === productId);
        if (i === -1) return [...ls, { productId, quantity: qty }];
        const copy = [...ls];
        copy[i] = { ...copy[i], quantity: copy[i].quantity + qty };
        return copy;
      });
    },
    setQty(productId: number, qty: number) {
      setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, quantity: Math.max(1, Math.floor(qty) || 1) } : l)));
    },
    setPrice(productId: number, price: string) {
      setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, price } : l)));
    },
    setOrigin(productId: number, originId: number | null) {
      setLines((ls) => ls.map((l) => (l.productId === productId ? { ...l, originId } : l)));
    },
    remove(productId: number) {
      setLines((ls) => ls.filter((l) => l.productId !== productId));
    },
    clear() {
      setLines([]);
    },
  };
}

/** Search box that also works with USB/Bluetooth barcode scanners (they type the code and press Enter). */
export function ProductSearch({ products, onPick, currency, showStock = true, costOnly = false }: { products: PickProduct[]; onPick: (p: PickProduct) => void; currency: string; showStock?: boolean; /** Sale screen: no fixed selling price, so show the buying price small instead. */ costOnly?: boolean }) {
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return products.filter((p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || (p.barcode ?? "").includes(s)).slice(0, 8);
  }, [q, products]);

  const pick = (p: PickProduct) => {
    onPick(p);
    setQ("");
    setMsg(null);
    ref.current?.focus();
  };

  return (
    <div className="relative">
      <label className="relative block">
        <span className="sr-only">Search or scan a product</span>
        <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" size={20} aria-hidden />
        <input
          ref={ref}
          id="product-search"
          className="input py-3 pl-10 text-base"
          placeholder="Scan barcode or type name / SKU"
          value={q}
          autoFocus
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            setMsg(null);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const s = q.trim().toLowerCase();
            if (!s) return;
            const exact = products.find((p) => (p.barcode ?? "").toLowerCase() === s || p.sku.toLowerCase() === s);
            if (exact) pick(exact);
            else if (results.length === 1) pick(results[0]);
            else if (results.length === 0) setMsg(`No product found for "${q.trim()}".`);
          }}
        />
      </label>
      {msg && <p className="mt-1 text-sm text-bad">{msg}</p>}
      {results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg" role="listbox">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => pick(p)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium" translate="no">{p.name}</span>
                  <span className="font-mono text-xs text-ink-3">{p.sku}</span>
                  {p.batch && <span className="ml-1.5 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2" translate="no">{p.batch}</span>}
                </span>
                <span className="shrink-0 text-right text-sm">
                  {costOnly ? (
                    p.costCents !== undefined && <span className="block text-xs tabular-nums text-ink-3">{`Cost ${fmtMoney(p.costCents, currency)}`}</span>
                  ) : (
                    <span className="block tabular-nums">{fmtMoney(p.priceCents, currency)}</span>
                  )}
                  {showStock && <span className={clsx("text-xs", p.available > 0 ? "text-ink-3" : "text-bad")}>{`${p.available} available`}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CartLines({
  lines,
  products,
  cart,
  currency,
  mode,
  origins,
}: {
  origins?: OriginOption[];
  lines: CartLine[];
  products: Map<number, PickProduct>;
  cart: ReturnType<typeof useCart>;
  currency: string;
  mode: "sale" | "order" | "receive";
}) {
  if (!lines.length)
    return <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-ink-3">{mode === "receive" ? "Scan or search for the products in the delivery." : "Scan or search to add products."}</div>;
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
      {lines.map((l) => {
        const p = products.get(l.productId)!;
        const over = mode === "sale" ? l.quantity > p.onHand : false;
        const intoReserved = mode === "sale" && !over && l.quantity > p.available;
        const short = mode === "order" && l.quantity > p.available;
        const price = mode === "sale" ? parsePrice(l.price) : p.priceCents;
        const belowCost = mode === "sale" && price !== null && p.costCents !== undefined && price < p.costCents;
        return (
          <li key={l.productId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
            <div className="w-full min-w-0 sm:w-auto sm:flex-1">
              <div className="truncate font-medium" translate="no">
                {p.name}
                {p.batch && <span className="ml-1.5 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-normal text-ink-2">{p.batch}</span>}
              </div>
              <div className="text-xs text-ink-3">
                {`${mode === "order" ? `${fmtMoney(p.priceCents, currency)} · ` : mode === "sale" && p.costCents !== undefined ? `Cost ${fmtMoney(p.costCents, currency)} · ` : ""}${p.onHand} on hand${p.onHand !== p.available ? `, ${p.available} available` : ""}`}
              </div>
              {belowCost && <div className="text-xs text-warn">Below cost</div>}
              {over && <div className="text-xs font-semibold text-bad">{`Only ${p.onHand} in stock`}</div>}
              {intoReserved && <div className="text-xs text-warn">Uses stock reserved for customer orders</div>}
              {short && <div className="text-xs text-warn">{`${l.quantity - Math.max(0, p.available)} short. You'll need to restock.`}</div>}
              {origins && origins.length > 0 && (
                <label className="mt-1.5 flex items-center gap-2 text-xs text-ink-2">
                  <span className="shrink-0">From</span>
                  <select
                    className="input w-auto! py-1.5! pr-8 text-sm!"
                    aria-label={`Where ${p.name} came from`}
                    value={l.originId ?? ""}
                    onChange={(e) => cart.setOrigin(l.productId, e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Store stock</option>
                    {origins.map((o) => (
                      <option key={o.id} value={o.id} translate="no">
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {mode === "sale" && (
              <label className="flex items-center gap-1.5">
                <span className="text-xs text-ink-3">Price</span>
                <input
                  className={clsx("input w-28! text-right tabular-nums", l.price && price === null && "border-bad")}
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={`Selling price of ${p.name}`}
                  value={l.price ?? ""}
                  onChange={(e) => cart.setPrice(l.productId, e.target.value)}
                />
              </label>
            )}
            <div className="flex items-center gap-1.5">
              <button type="button" className="btn-secondary min-w-11 px-0" aria-label={l.quantity <= 1 ? `Remove ${p.name}` : `Decrease quantity of ${p.name}`} onClick={() => (l.quantity <= 1 ? cart.remove(l.productId) : cart.setQty(l.productId, l.quantity - 1))}>
                <Minus size={16} />
              </button>
              <input
                className="input w-16 px-1 text-center tabular-nums"
                type="number"
                min={1}
                inputMode="numeric"
                aria-label={`Quantity of ${p.name}`}
                value={l.quantity}
                onChange={(e) => cart.setQty(l.productId, Number(e.target.value))}
              />
              <button type="button" className="btn-secondary min-w-11 px-0" aria-label={`Increase quantity of ${p.name}`} onClick={() => cart.setQty(l.productId, l.quantity + 1)}>
                <Plus size={16} />
              </button>
            </div>
            {mode !== "receive" && <div className="ml-auto whitespace-nowrap text-right font-semibold tabular-nums">{price === null ? "—" : fmtMoney(price * l.quantity, currency)}</div>}
            <button type="button" className={clsx("-mr-1 flex min-h-11 min-w-11 items-center justify-center rounded-[4px] text-ink-3 hover:bg-bad-soft hover:text-bad", mode === "receive" ? "ml-auto" : "ml-1")} aria-label={`Remove ${p.name}`} onClick={() => cart.remove(l.productId)}>
              <Trash2 size={18} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
