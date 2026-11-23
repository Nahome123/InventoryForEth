"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { CartLines, fmtMoney, parsePrice, ProductSearch, useCart, type OriginOption, type PickProduct } from "@/components/cart";
import { Field, FormMessage, SubmitButton, useActionForm } from "@/components/form";
import { createSaleAction } from "../actions";

const METHODS: [string, string][] = [
  ["cash", "Cash"],
  ["mobile_money", "Mobile money"],
  ["card", "Card"],
  ["bank_transfer", "Bank transfer"],
  ["credit", "Credit (pay later)"],
  ["other", "Other"],
];

function toCents(s: string): number | null {
  const t = s.trim();
  if (!t) return 0;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

export function PointOfSale({ products, currency, origins }: { products: PickProduct[]; currency: string; origins: OriginOption[] }) {
  const cart = useCart();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const { state, onSubmit, pending } = useActionForm(createSaleAction, null);
  const [method, setMethod] = useState("cash");
  const [discount, setDiscount] = useState("");
  const [tendered, setTendered] = useState("");
  const [formKey, setFormKey] = useState(0);
  // The sale that was just recorded. Shown big (change due!) until the cashier starts the next sale.
  const [done, setDone] = useState<{ saleId: number; totalCents: number; changeCents: number | null } | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state?.saleId) {
      cart.clear();
      setDiscount("");
      setTendered("");
      setMethod("cash");
      setFormKey((k) => k + 1);
      setDone({ saleId: state.saleId, totalCents: state.totalCents ?? 0, changeCents: state.changeCents ?? null });
    }
  }, [state]);

  // On phones the cashier is scrolled down at the checkout form when the sale completes: bring the result to them.
  useEffect(() => {
    if (!done) return;
    doneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    doneRef.current?.focus({ preventScroll: true });
  }, [done]);

  const nextSale = () => {
    setDone(null);
    document.getElementById("product-search")?.focus();
  };
  const showDone = done !== null && cart.lines.length === 0;

  // There is no fixed selling price: the seller types the agreed price for each item.
  const subtotal = cart.lines.reduce((s, l) => s + (parsePrice(l.price) ?? 0) * l.quantity, 0);
  const missingPrice = cart.lines.some((l) => parsePrice(l.price) === null);
  const discountCents = toCents(discount);
  const total = subtotal - (discountCents ?? 0);
  const tenderedCents = toCents(tendered);
  const overStock = cart.lines.some((l) => l.quantity > (byId.get(l.productId)?.onHand ?? 0));
  const invalid = discountCents === null || (discountCents ?? 0) > subtotal;
  const shortCash = method === "cash" && tendered.trim() !== "" && (tenderedCents === null || tenderedCents < total);
  const units = cart.lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className={`grid gap-5 lg:grid-cols-[1fr_340px] ${cart.lines.length ? "pb-20 lg:pb-0" : ""}`}>
      <div className="min-w-0 space-y-3">
        {showDone && (
          <div
            ref={doneRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            className="scroll-mt-24 rounded-2xl border border-good/30 bg-good-soft p-5 text-center focus:outline-none sm:p-6"
          >
            <div className="flex items-center justify-center gap-2 font-semibold text-good">
              <CheckCircle2 size={22} aria-hidden /> Sale recorded · {fmtMoney(done.totalCents, currency)}
            </div>
            {done.changeCents != null && done.changeCents > 0 ? (
              <div className="mt-3">
                <div className="text-sm font-semibold uppercase tracking-[0.08em] text-ink-2">Change due</div>
                <div className="font-display text-5xl font-bold leading-tight tabular-nums text-ink sm:text-6xl">{fmtMoney(done.changeCents, currency)}</div>
              </div>
            ) : (
              <div className="mt-1 text-sm text-ink-2">No change due.</div>
            )}
            <div className="mt-5 flex flex-col-reverse items-center justify-center gap-2 sm:flex-row sm:gap-3">
              <Link href={`/sales/${done.saleId}`} className="btn-secondary w-full sm:w-auto">
                View receipt
              </Link>
              <button type="button" className="btn-primary w-full px-8 text-base sm:w-auto" onClick={nextSale}>
                Next sale
              </button>
            </div>
          </div>
        )}
        <ProductSearch products={products} currency={currency} onPick={(p) => {
            setDone(null);
            cart.add(p.id);
          }} costOnly />
        <CartLines lines={cart.lines} products={byId} cart={cart} currency={currency} mode="sale" origins={origins} />
      </div>

      <form id="checkout" onSubmit={onSubmit} key={formKey} className="card h-fit scroll-mt-20 space-y-4 p-5 sm:p-6 lg:sticky lg:top-24">
        <FormMessage state={state?.error ? state : null} />
        <input type="hidden" name="lines" value={JSON.stringify(cart.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, originId: l.originId ?? null, unitPriceCents: parsePrice(l.price) ?? undefined })))} />
        <fieldset>
          <legend className="label">Payment method</legend>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map(([v, l]) => (
              <label key={v} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border px-3 py-2 text-center text-sm font-medium transition ${method === v ? "border-accent bg-accent-soft text-accent-fg" : "border-line-strong"}`}>
                <input type="radio" name="paymentMethod" value={v} checked={method === v} onChange={() => setMethod(v)} className="sr-only" />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Discount">
            <input className="input" name="discount" inputMode="decimal" placeholder="0.00" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
          {method === "cash" && (
            <Field label="Cash received">
              <input className="input" name="tendered" inputMode="decimal" placeholder="0.00" value={tendered} onChange={(e) => setTendered(e.target.value)} />
            </Field>
          )}
        </div>
        <Field label={method === "credit" ? "Customer name (required for credit)" : "Customer name (optional)"}>
          <input className="input" name="customerName" required={method === "credit"} />
        </Field>
        <Field label="Note (optional)">
          <input className="input" name="note" />
        </Field>

        <dl className="space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-2">{`Subtotal (${units} item${units === 1 ? "" : "s"})`}</dt>
            <dd className="tabular-nums">{fmtMoney(subtotal, currency)}</dd>
          </div>
          {!!discountCents && (
            <div className="flex justify-between">
              <dt className="text-ink-2">Discount</dt>
              <dd className="tabular-nums">−{fmtMoney(discountCents, currency)}</dd>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{fmtMoney(Math.max(0, total), currency)}</dd>
          </div>
          {method === "cash" && tenderedCents !== null && tenderedCents >= total && tendered.trim() !== "" && (
            <div className="flex justify-between font-semibold text-good">
              <dt>Change</dt>
              <dd className="tabular-nums">{fmtMoney(tenderedCents - total, currency)}</dd>
            </div>
          )}
        </dl>
        {invalid && <p className="text-sm text-bad">Discount can&apos;t be more than the subtotal.</p>}
        {shortCash && <p className="text-sm text-bad">Cash received is less than the total.</p>}
        {missingPrice && cart.lines.length > 0 && <p className="text-sm text-warn">Enter the agreed selling price for every item.</p>}
        {overStock && <p className="text-sm text-bad">Some quantities are more than what&apos;s in stock.</p>}
        <SubmitButton pending={pending} className="btn-primary w-full py-3 text-base" disabled={!cart.lines.length || missingPrice || invalid || shortCash || overStock} pendingText="Recording…">
          Complete sale
        </SubmitButton>
        {cart.lines.length > 0 && (
          <button type="button" className="w-full text-sm text-ink-3 hover:text-bad" onClick={() => cart.clear()}>
            Clear cart
          </button>
        )}
      </form>

      {cart.lines.length > 0 && (
        // Phones: keep the running total in view while scrolling the cart.
        <div className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 print:hidden lg:hidden">
          <button
            type="button"
            onClick={() => document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-left text-bg shadow-xl active:scale-[0.99]"
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] opacity-70">
                {`${units} item${units === 1 ? "" : "s"}`}
              </span>
              <span className="block truncate font-display text-lg font-semibold tabular-nums">{fmtMoney(Math.max(0, total), currency)}</span>
            </span>
            <span className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Checkout</span>
          </button>
        </div>
      )}
    </div>
  );
}
