"use client";

import { useActionState } from "react";
import { Printer } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/form";
import { voidSaleAction } from "../actions";

export function PrintButton() {
  return (
    <button type="button" className="btn-secondary" onClick={() => window.print()}>
      <Printer size={16} aria-hidden /> Print receipt
    </button>
  );
}

export function VoidSaleForm({ saleId }: { saleId: number }) {
  const [state, action] = useActionState(voidSaleAction.bind(null, saleId), null);
  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(e) => {
        if (!confirm("Void this sale? This can't be undone.")) e.preventDefault();
      }}
    >
      <FormMessage state={state} />
      <input className="input" name="reason" required placeholder="Reason, e.g. entered twice by mistake" aria-label="Reason for voiding" />
      <SubmitButton className="btn-danger" pendingText="Voiding…">
        Void sale
      </SubmitButton>
    </form>
  );
}
