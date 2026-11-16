"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { importProductsAction, importSalesAction } from "./actions";

export function ProductImportForm() {
  const [state, action] = useActionState(importProductsAction, null);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <input className="input" type="file" name="file" accept=".csv,text/csv" required aria-label="Products CSV file" />
      <SubmitButton pendingText="Importing…">Import products</SubmitButton>
    </form>
  );
}

export function SalesImportForm() {
  const [state, action] = useActionState(importSalesAction, null);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
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
