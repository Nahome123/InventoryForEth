"use client";

import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import { fmtMoney, parsePrice } from "@/components/cart";
import { Field, FormMessage, SubmitButton, useActionForm } from "@/components/form";
import { editSaleAction } from "./actions";

const METHODS: [string, string][] = [
  ["cash", "Cash"],
  ["mobile_money", "Mobile money"],
  ["card", "Card"],
  ["bank_transfer", "Bank transfer"],
  ["credit", "Credit (pay later)"],
  ["other", "Other"],
];

export type EditableSale = {
  id: number;
  label: string;
  customerName: string | null;
  soldAtLocal: string;
  paymentMethod: string;
  discountCents: number;
  lines: { id: number; name: string; sku: string; qty: number; soldCents: number; originId: number | null }[];
};

type Line = { id: number; name: string; sku: string; qty: string; price: string; originId: number | null };

/** Pencil button on a sales row; opens a small editor for that sale. */
export function EditSaleButton({ sale, origins, currency, imported }: { sale: EditableSale; origins: { id: number; name: string }[]; currency: string; imported: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex size-9 items-center justify-center rounded-[4px] text-ink-3 hover:bg-surface-2 hover:text-accent-fg" aria-label={`Edit sale ${sale.label}`} title="Edit sale">
        <Pencil size={16} aria-hidden />
      </button>
      {open && <EditSaleDialog sale={sale} origins={origins} currency={currency} imported={imported} onClose={() => setOpen(false)} />}
    </>
  );
}

function EditSaleDialog({ sale, origins, currency, imported, onClose }: { sale: EditableSale; origins: { id: number; name: string }[]; currency: string; imported: boolean; onClose: () => void }) {
  const { state, onSubmit, pending } = useActionForm(editSaleAction.bind(null, sale.id), null);
  const [lines, setLines] = useState<Line[]>(() => sale.lines.map((l) => ({ id: l.id, name: l.name, sku: l.sku, qty: String(l.qty), price: (l.soldCents / 100).toFixed(2), originId: l.originId })));

  useEffect(() => {
    if (state?.ok) onClose();
  }, [state, onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const parsed = lines.map((l) => ({ id: l.id, quantity: Number(l.qty), unitPriceCents: parsePrice(l.price), originId: l.originId }));
  const invalid = parsed.some((l) => l.unitPriceCents === null || !Number.isInteger(l.quantity) || l.quantity < 1);
  const subtotal = parsed.reduce((a, l) => a + (l.unitPriceCents ?? 0) * (Number.isInteger(l.quantity) ? l.quantity : 0), 0);
  const total = subtotal - Math.min(sale.discountCents, subtotal);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit sale ${sale.label}`}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 text-left shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">{`Edit sale ${sale.label}`}</h2>
          <button type="button" onClick={onClose} className="p-1 text-ink-3 hover:text-ink" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <FormMessage state={state?.error ? state : null} />
        <input type="hidden" name="lines" value={JSON.stringify(parsed.map((l) => ({ ...l, unitPriceCents: l.unitPriceCents ?? -1 })))} />

        <ul className="mb-4 mt-3 divide-y divide-line rounded-xl border border-line">
          {lines.map((l, i) => (
            <li key={l.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_7rem_5rem]">
              <div className="min-w-0 sm:col-span-3">
                <div className="truncate font-medium" translate="no">
                  {l.name}
                </div>
                <div className="font-mono text-xs text-ink-3">{l.sku}</div>
              </div>
              <Field label="Sold unit price">
                <input className="input text-right tabular-nums" inputMode="decimal" value={l.price} onChange={(e) => set(i, { price: e.target.value })} required />
              </Field>
              <Field label="Qty">
                <input className="input text-center tabular-nums" type="number" min={1} inputMode="numeric" value={l.qty} onChange={(e) => set(i, { qty: e.target.value })} required />
              </Field>
              {origins.length > 0 && (
                <Field label="From" className="sm:col-span-1">
                  <select className="input" value={l.originId ?? ""} onChange={(e) => set(i, { originId: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">Store stock</option>
                    {origins.map((o) => (
                      <option key={o.id} value={o.id} translate="no">
                        {o.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </li>
          ))}
        </ul>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Customer">
            <input className="input" name="customerName" defaultValue={sale.customerName ?? ""} />
          </Field>
          <Field label="Date & time" hint="Leave blank if unknown.">
            <input className="input" type="datetime-local" name="soldAt" defaultValue={sale.soldAtLocal} />
          </Field>
          <Field label="Payment">
            <select className="input" name="paymentMethod" defaultValue={sale.paymentMethod}>
              {METHODS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="text-sm">
            <span className="text-ink-2">New total </span>
            <span className="font-display text-lg font-semibold tabular-nums">{fmtMoney(total, currency)}</span>
            {sale.discountCents > 0 && <span className="block text-xs text-ink-3">{`After ${fmtMoney(Math.min(sale.discountCents, subtotal), currency)} discount`}</span>}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <SubmitButton pending={pending} disabled={invalid}>
              Save changes
            </SubmitButton>
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-3">{imported ? "Imported sale: changing quantities won't change stock." : "Changing a quantity also moves stock by the difference."}</p>
      </form>
    </div>
  );
}
