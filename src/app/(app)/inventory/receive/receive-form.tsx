"use client";

import { useEffect, useMemo } from "react";
import { CartLines, ProductSearch, useCart, type PickProduct } from "@/components/cart";
import { Field, FormMessage, SubmitButton, useActionForm } from "@/components/form";
import { receiveAction } from "../actions";

export function ReceiveForm({ products, currency, supplier, suppliers, focusSupplier }: { products: PickProduct[]; currency: string; supplier: string; suppliers: string[]; focusSupplier: boolean }) {
  const cart = useCart();
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const { state, onSubmit, pending } = useActionForm(receiveAction, null);
  useEffect(() => {
    if (state?.ok) cart.clear();
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormMessage state={state} />
      <section className="card space-y-3 p-4 sm:p-5">
        <Field label="Supplier" hint="Pick an existing supplier or type a new name.">
          <input className="input" name="supplier" list="receive-suppliers" defaultValue={supplier} placeholder="e.g. China supplier (Guangzhou Parts)" autoFocus={focusSupplier} translate="no" />
          <datalist id="receive-suppliers">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <label className="flex items-start gap-2 text-sm text-ink-2">
          <input type="checkbox" name="label" defaultChecked className="mt-0.5 size-4" />
          <span>Label the received products with this supplier, so they show under it on the Inventory page.</span>
        </label>
      </section>
      <ProductSearch products={products} currency={currency} onPick={(p) => cart.add(p.id)} showStock={false} />
      <CartLines lines={cart.lines} products={byId} cart={cart} currency={currency} mode="receive" />
      <input type="hidden" name="lines" value={JSON.stringify(cart.lines)} />
      <Field label="Note (invoice number, optional)">
        <input className="input" name="note" placeholder="e.g. invoice 4471" />
      </Field>
      <SubmitButton pending={pending} disabled={!cart.lines.length}>{`Save delivery (${cart.lines.reduce((s, l) => s + l.quantity, 0)} units)`}</SubmitButton>
    </form>
  );
}
