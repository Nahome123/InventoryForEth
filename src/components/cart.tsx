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
};

export type CartLine = { productId: number; quantity: number };

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
    remove(productId: number) {
      setLines((ls) => ls.filter((l) => l.productId !== productId));
    },
    clear() {
      setLines([]);
    },
  };
}

/** Search box that also works with USB/Bluetooth barcode scanners (they type the code and press Enter). */
export function ProductSearch({ products, onPick, currency, showStock = true }: { products: PickProduct[]; onPick: (p: PickProduct) => void; currency: string; showStock?: boolean }) {
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
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="block tabular-nums">{fmtMoney(p.priceCents, currency)}</span>
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
}: {
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
        return (
          <li key={l.productId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
            <div className="w-full min-w-0 sm:w-auto sm:flex-1">
              <div className="truncate font-medium" translate="no">{p.name}</div>
              <div className="text-xs text-ink-3">
                {`${mode !== "receive" ? `${fmtMoney(p.priceCents, currency)} · ` : ""}${p.onHand} on hand${p.onHand !== p.available ? `, ${p.available} available` : ""}`}
              </div>
              {over && <div className="text-xs font-semibold text-bad">{`Only ${p.onHand} in stock`}</div>}
              {intoReserved && <div className="text-xs text-warn">Uses stock reserved for customer orders</div>}
              {short && <div className="text-xs text-warn">{`${l.quantity - Math.max(0, p.available)} short. You'll need to restock.`}</div>}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className="btn-secondary min-h-9 px-2" aria-label="Decrease" onClick={() => (l.quantity <= 1 ? cart.remove(l.productId) : cart.setQty(l.productId, l.quantity - 1))}>
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
              <button type="button" className="btn-secondary min-h-9 px-2" aria-label="Increase" onClick={() => cart.setQty(l.productId, l.quantity + 1)}>
                <Plus size={16} />
              </button>
            </div>
            {mode !== "receive" && <div className="ml-auto whitespace-nowrap text-right font-semibold tabular-nums">{fmtMoney(p.priceCents * l.quantity, currency)}</div>}
            <button type="button" className={clsx("p-1 text-ink-3 hover:text-bad", mode === "receive" && "ml-auto")} aria-label={`Remove ${p.name}`} onClick={() => cart.remove(l.productId)}>
              <Trash2 size={18} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
