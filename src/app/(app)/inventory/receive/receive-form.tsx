"use client";

import { useEffect, useMemo } from "react";
import { CartLines, ProductSearch, useCart, type PickProduct } from "@/components/cart";
import { Field, FormMessage, SubmitButton, useActionForm } from "@/components/form";
import { receiveAction } from "../actions";

export function ReceiveForm({ products, currency }: { products: PickProduct[]; currency: string }) {
  const cart = useCart();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const { state, onSubmit, pending } = useActionForm(receiveAction, null);
  useEffect(() => {
    if (state?.ok) cart.clear();
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      <ProductSearch products={products} currency={currency} onPick={(p) => cart.add(p.id)} showStock={false} />
      <CartLines lines={cart.lines} products={byId} cart={cart} currency={currency} mode="receive" />
      <input type="hidden" name="lines" value={JSON.stringify(cart.lines)} />
      <Field label="Note (supplier / invoice number)">
        <input className="input" name="note" placeholder="e.g. Main Wholesaler, invoice 4471" />
      </Field>
      <SubmitButton pending={pending} disabled={!cart.lines.length}>Save delivery ({cart.lines.reduce((s, l) => s + l.quantity, 0)} units)</SubmitButton>
    </form>
  );
}
