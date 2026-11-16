"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Field, FormMessage, SubmitButton, useActionForm } from "@/components/form";
import { addExpenseAction, deleteExpenseAction } from "./actions";

export function AddExpenseForm({ today, categories }: { today: string; categories: string[] }) {
  const { state, onSubmit, pending } = useActionForm(addExpenseAction, null);
  // Clear the form after each successful add.
  const [n, setN] = useState(0);
  useEffect(() => {
    if (state?.ok) setN((x) => x + 1);
  }, [state]);
  return (
    <form onSubmit={onSubmit} className="space-y-3" key={n}>
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date">
          <input className="input" type="date" name="spentOn" defaultValue={today} max={today} required />
        </Field>
        <Field label="Amount">
          <input className="input" name="amount" inputMode="decimal" placeholder="0.00" required />
        </Field>
      </div>
      <Field label="Category">
        <input className="input" name="category" list="expense-categories" placeholder="Rent, salaries, freight…" required />
        <datalist id="expense-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field label="Note (optional)">
        <input className="input" name="note" />
      </Field>
      <SubmitButton pending={pending} className="btn-primary w-full">
        Add expense
      </SubmitButton>
    </form>
  );
}

export function DeleteExpenseButton({ id, label }: { id: number; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Delete ${label}`}
      className="p-1 text-ink-3 hover:text-bad disabled:opacity-40"
      onClick={() => {
        if (confirm(`Delete this expense (${label})?`)) start(() => deleteExpenseAction(id));
      }}
    >
      <Trash2 size={16} />
    </button>
  );
}
