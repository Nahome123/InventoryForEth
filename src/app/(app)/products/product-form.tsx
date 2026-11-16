"use client";

import { Field, FormMessage, SubmitButton, type ActionState, useActionForm } from "@/components/form";

export type ProductFormValues = {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  description: string;
  unit: string;
  costPrice: string;
  sellPrice: string;
  reorderLevel: string;
  reorderQty: string;
  leadTimeDays: string;
  supplier: string;
};

export function ProductForm({
  action,
  initial,
  categories,
  isNew,
  currency,
  defaultLeadTime,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  initial?: Partial<ProductFormValues>;
  categories: string[];
  isNew: boolean;
  currency: string;
  defaultLeadTime: number;
}) {
  const { state, onSubmit, pending } = useActionForm(action, null);
  const v = initial ?? {};
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormMessage state={state} />
      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Details</h2>
        <Field label="Product name *">
          <input className="input" name="name" required defaultValue={v.name} maxLength={200} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU *" hint="Your internal product code. Must be unique.">
            <input className="input font-mono" name="sku" required defaultValue={v.sku} maxLength={64} autoCapitalize="characters" />
          </Field>
          <Field label="Barcode" hint="Scan it with a barcode scanner into this box.">
            <input className="input font-mono" name="barcode" defaultValue={v.barcode} inputMode="numeric" />
          </Field>
          <Field label="Category">
            <input className="input" name="category" list="categories" defaultValue={v.category} placeholder="e.g. Household" />
            <datalist id="categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Unit" hint="How it's counted: pcs, box, kg, litre…">
            <input className="input" name="unit" defaultValue={v.unit ?? "pcs"} />
          </Field>
        </div>
        <Field label="Description">
          <textarea className="input" name="description" rows={2} defaultValue={v.description} />
        </Field>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Pricing ({currency})</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Selling price *">
            <input className="input" name="sellPrice" required inputMode="decimal" defaultValue={v.sellPrice} placeholder="0.00" pattern="\d+(\.\d{1,2})?" />
          </Field>
          <Field label="Cost price" hint="What you pay the supplier. Used for profit.">
            <input className="input" name="costPrice" inputMode="decimal" defaultValue={v.costPrice} placeholder="0.00" pattern="\d+(\.\d{1,2})?" />
          </Field>
        </div>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Stock & restocking</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {isNew && (
            <Field label="Opening stock" hint="Units on the shelf right now.">
              <input className="input" name="openingStock" type="number" min={0} step={1} defaultValue={0} />
            </Field>
          )}
          <Field label="Reorder level" hint="Warn me when available stock falls to this.">
            <input className="input" name="reorderLevel" type="number" min={0} step={1} defaultValue={v.reorderLevel ?? "0"} />
          </Field>
          <Field label="Usual reorder quantity" hint="Minimum amount you buy at once.">
            <input className="input" name="reorderQty" type="number" min={0} step={1} defaultValue={v.reorderQty ?? "0"} />
          </Field>
          <Field label="Supplier lead time (days)" hint={`Blank = store default (${defaultLeadTime} days).`}>
            <input className="input" name="leadTimeDays" type="number" min={0} step={1} defaultValue={v.leadTimeDays} />
          </Field>
          <Field label="Supplier">
            <input className="input" name="supplier" defaultValue={v.supplier} />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <SubmitButton pending={pending}>{isNew ? "Create product" : "Save changes"}</SubmitButton>
        {isNew && (
          <SubmitButton pending={pending} className="btn-secondary" name="another" value="1">
            Create & add another
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
