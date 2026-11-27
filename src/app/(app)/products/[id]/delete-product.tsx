"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { FormMessage, SubmitButton, useActionForm } from "@/components/form";
import { deleteProductAction } from "../actions";

/** Permanently delete a product (only possible when it was never sold or ordered). */
export function DeleteProduct({ id, name }: { id: number; name: string }) {
  const [open, setOpen] = useState(false);
  const del = useActionForm(deleteProductAction.bind(null, id), null);
  return (
    <section className="card mt-6 border-bad/30 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Delete product</h2>
          <p className="text-sm text-ink-2">Removes it and its stock from inventory. Only possible if it was never sold or ordered.</p>
        </div>
        <button type="button" className="btn-secondary text-bad hover:border-bad" onClick={() => setOpen(!open)} aria-expanded={open}>
          <Trash2 size={16} aria-hidden /> Delete
        </button>
      </div>
      {open && (
        <form onSubmit={del.onSubmit} className="mt-3 space-y-3 rounded-xl border border-bad/40 bg-bad-soft p-3 text-sm">
          <FormMessage state={del.state} />
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" name="confirm" className="size-4" required />
            {`Yes, permanently delete “${name}”`}
          </label>
          <div className="flex gap-2">
            <SubmitButton pending={del.pending} className="btn-primary bg-bad hover:bg-bad" pendingText="Deleting…">
              Delete product
            </SubmitButton>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
