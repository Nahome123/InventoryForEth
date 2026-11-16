"use client";

import { useMemo } from "react";
import { CartLines, fmtMoney, ProductSearch, useCart, type PickProduct } from "@/components/cart";
import { Field, FormMessage, SubmitButton, useActionForm } from "@/components/form";
import { createOrderAction } from "../actions";

export function OrderForm({ products, currency, today }: { products: PickProduct[]; currency: string; today: string }) {
  const cart = useCart();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const { state, onSubmit, pending } = useActionForm(createOrderAction, null);
  const total = cart.lines.reduce((s, l) => s + (byId.get(l.productId)?.priceCents ?? 0) * l.quantity, 0);

  return (
    <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-3">
        <ProductSearch products={products} currency={currency} onPick={(p) => cart.add(p.id)} />
        <CartLines lines={cart.lines} products={byId} cart={cart} currency={currency} mode="order" />
        <input type="hidden" name="lines" value={JSON.stringify(cart.lines)} />
      </div>
      <div className="card h-fit space-y-4 p-5 sm:p-6">
        <FormMessage state={state} />
        <Field label="Customer name *">
          <input className="input" name="customerName" required autoComplete="off" />
        </Field>
        <Field label="Phone">
          <input className="input" name="customerPhone" type="tel" inputMode="tel" autoComplete="off" />
        </Field>
        <Field label="Pickup / due date">
          <input className="input" name="dueDate" type="date" min={today} />
        </Field>
        <Field label={`Deposit paid (${currency})`} hint="Money taken now. The rest is paid at pickup.">
          <input className="input" name="deposit" inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Note">
          <textarea className="input" name="note" rows={2} />
        </Field>
        <div className="flex justify-between border-t border-line pt-3 text-lg font-bold">
          <span>Order total</span>
          <span className="tabular-nums">{fmtMoney(total, currency)}</span>
        </div>
        <SubmitButton pending={pending} className="btn-primary w-full" disabled={!cart.lines.length}>
          Save order
        </SubmitButton>
      </div>
    </form>
  );
}
