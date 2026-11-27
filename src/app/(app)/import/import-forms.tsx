"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { importProductsAction, importSalesAction } from "./actions";

export function ProductImportForm({ suppliers, suggestedName, batches }: { suppliers: string[]; suggestedName: string; batches: { value: string; label: string }[] }) {
  const [state, action] = useActionState(importProductsAction, null);
  const [mode, setMode] = useState<"new" | "add" | "update">("new");
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <fieldset className="grid gap-2">
        <legend className="label">How to import</legend>
        {(
          [
            ["new", "New batch (recommended)", "Kept separate: its own products, stock, sales and profit. Same part numbers as earlier stock are allowed."],
            ...(batches.length ? ([["add", "Add to an existing batch", "Same part number in that batch: the quantity is added to its stock. New part numbers become new products in the batch."]] as const) : []),
            ["update", "Update earlier stock", "Rows with an existing part number update that product. New part numbers are added."],
          ] as const
        ).map(([v, l, d]) => (
          <label key={v} className={`flex cursor-pointer items-start gap-2 rounded-[6px] border p-3 text-sm ${mode === v ? "border-accent bg-accent-soft" : "border-line"}`}>
            <input type="radio" name="mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="mt-0.5" />
            <span>
              <span className="font-medium">{l}</span>
              <span className="block text-xs text-ink-2">{d}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {mode === "add" && (
        <Field label="Batch to add to">
          <select className="input" name="addTo" required defaultValue={batches[0]?.value}>
            {batches.map((b) => (
              <option key={b.value} value={b.value} translate="no">
                {b.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      {mode === "new" && (
        <div className="grid gap-3 sm:max-w-sm">
          <Field label="Supplier name" hint="Also the name of this batch.">
            <input className="input" name="batchName" list="import-suppliers" placeholder={suggestedName} required maxLength={80} translate="no" />
            <datalist id="import-suppliers">
              {suppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
        </div>
      )}
      <input className="input" type="file" name="file" accept=".csv,text/csv" required aria-label="Products CSV file" />
      <SubmitButton pendingText="Importing…">Import products</SubmitButton>
    </form>
  );
}

export function SalesImportForm({ batches }: { batches: { value: string; label: string }[] }) {
  const [state, action] = useActionState(importSalesAction, null);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <Field label="Batch these sales belong to" hint="Part numbers are matched only inside this batch, so sales never mix with other imports.">
        <select className="input" name="batch" required defaultValue={batches[0]?.value ?? ""}>
          {batches.map((b) => (
            <option key={b.value} value={b.value} translate="no">
              {b.label}
            </option>
          ))}
        </select>
      </Field>
      <input className="input" type="file" name="file" accept=".csv,text/csv" required aria-label="Sales CSV file" />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="affectStock" className="mt-1" />
        <span>
          Also deduct these sales from current stock
          <span className="block text-xs text-ink-3">Leave unticked if your stock counts were taken after these sales happened (usual for old notebook records).</span>
        </span>
      </label>
      <SubmitButton pendingText="Importing…">Import sales history</SubmitButton>
    </form>
  );
}
