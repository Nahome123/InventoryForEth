"use client";

import { useEffect, useState } from "react";
import { Tag, X } from "lucide-react";
import { FormMessage, SubmitButton, useActionForm } from "@/components/form";
import { setSupplierAction } from "./actions";

type Item = { id: number; name: string; sku: string; supplier: string | null };

/**
 * "Label by supplier": tick products and give them a supplier in one go.
 * While labelling, the normal product list is swapped for a checklist (works the same on phones).
 */
export function SupplierLabeler({ items, suppliers, children }: { items: Item[]; suppliers: string[]; children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const { state, onSubmit, pending } = useActionForm(setSupplierAction, null);

  useEffect(() => {
    if (state?.ok) setPicked(new Set());
  }, [state]);

  const toggle = (id: number) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allOn = items.length > 0 && items.every((i) => picked.has(i.id));

  if (!on)
    return (
      <>
        <div className="mb-3 flex justify-end">
          <button type="button" className="btn-secondary" onClick={() => setOn(true)}>
            <Tag size={16} aria-hidden /> Label by supplier
          </button>
        </div>
        {children}
      </>
    );

  return (
    <form onSubmit={onSubmit} className="card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Label by supplier</h2>
        <button type="button" className="btn-secondary" onClick={() => setOn(false)}>
          <X size={16} aria-hidden /> Done
        </button>
      </div>
      <FormMessage state={state} />
      <div className="sticky top-16 z-10 -mx-4 mb-3 grid gap-2 border-b border-line bg-surface px-4 py-3 sm:-mx-5 sm:grid-cols-[1fr_auto] sm:px-5">
        <input className="input" name="supplier" list="supplier-names" placeholder="Supplier name (leave blank to remove)" aria-label="Supplier name" />
        <datalist id="supplier-names">
          {suppliers.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <SubmitButton pending={pending} disabled={picked.size === 0} pendingText="Saving…">
          {`Apply to ${picked.size} selected`}
        </SubmitButton>
      </div>
      <label className="mb-1 flex items-center gap-3 px-1 py-2 text-sm font-medium">
        <input type="checkbox" className="size-4" checked={allOn} onChange={() => setPicked(allOn ? new Set() : new Set(items.map((i) => i.id)))} />
        {`Select all ${items.length}`}
      </label>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {items.map((i) => (
          <li key={i.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
              <input type="checkbox" className="size-4 shrink-0" name="ids" value={i.id} checked={picked.has(i.id)} onChange={() => toggle(i.id)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium" translate="no">
                  {i.name}
                </span>
                <span className="font-mono text-xs text-ink-3">{i.sku}</span>
              </span>
              <span className="shrink-0 text-xs text-ink-2" translate="no">
                {i.supplier ?? "—"}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </form>
  );
}
