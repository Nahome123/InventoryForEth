"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { fulfillOrderAction, setOrderStatusAction } from "../actions";
import { PAYMENT_LABELS } from "@/lib/format";

export function StatusButton({ orderId, status, label, danger, confirmText }: { orderId: number; status: "pending" | "ready" | "cancelled"; label: string; danger?: boolean; confirmText?: string }) {
  const [state, action] = useActionState(setOrderStatusAction.bind(null, orderId, status), null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
      className="space-y-2"
    >
      <FormMessage state={state?.error ? state : null} />
      <SubmitButton className={`${danger ? "btn-danger" : "btn-secondary"} w-full`} pendingText="Updating…">
        {label}
      </SubmitButton>
    </form>
  );
}

export function FulfillForm({ orderId, balance }: { orderId: number; balance: string }) {
  const [state, action] = useActionState(fulfillOrderAction.bind(null, orderId), null);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <label className="block">
        <span className="label">Balance of {balance} paid by</span>
        <select className="input" name="paymentMethod" defaultValue="cash">
          {Object.entries(PAYMENT_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton className="btn-primary w-full" pendingText="Recording sale…">
        Hand over & record sale
      </SubmitButton>
    </form>
  );
}
