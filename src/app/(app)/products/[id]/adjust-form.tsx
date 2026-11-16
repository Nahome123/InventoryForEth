"use client";

import { useState } from "react";
import { Field, FormMessage, SubmitButton, useActionForm } from "@/components/form";
import { adjustStockAction } from "../actions";

const KINDS = [
  { value: "receipt", label: "Received from supplier", qty: "Units received" },
  { value: "count", label: "Stock count (set exact amount)", qty: "Units counted on shelf" },
  { value: "damage", label: "Damaged / lost / expired", qty: "Units removed" },
  { value: "return", label: "Customer return (back to shelf)", qty: "Units returned" },
] as const;

export function AdjustStockForm({ productId, onHand, unit }: { productId: number; onHand: number; unit: string }) {
  const { state, onSubmit, pending } = useActionForm(adjustStockAction, null);
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("receipt");
  const k = KINDS.find((x) => x.value === kind)!;
  return (
    <form onSubmit={onSubmit} className="space-y-3" key={state?.ok}>
      <input type="hidden" name="productId" value={productId} />
      <FormMessage state={state} />
      <Field label="What happened?">
        <select className="input" name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          {KINDS.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`${k.qty} (${unit})`} hint={kind === "count" ? `Currently ${onHand} in the system.` : undefined}>
        <input className="input" name="quantity" type="number" min={kind === "count" ? 0 : 1} step={1} required inputMode="numeric" />
      </Field>
      <Field label="Note (optional)">
        <input className="input" name="note" placeholder={kind === "receipt" ? "e.g. Invoice #123" : ""} />
      </Field>
      <SubmitButton pending={pending}>Save stock change</SubmitButton>
    </form>
  );
}
