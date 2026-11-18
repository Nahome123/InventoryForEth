"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Field, FormMessage, SubmitButton, useActionForm } from "@/components/form";
import { deleteBatchAction, nameEarlierStockAction, renameBatchAction } from "./actions";

export type ManagedBatch = { id: number; name: string; supplier: string | null; created: string; products: number; units: number; sales: number; mixedSales: number; orders: number };

/** The inventory imported before batches existed: can be given a name, which turns it into a normal batch. */
export function EarlierStockRow({ products, units }: { products: number; units: number }) {
  const [open, setOpen] = useState(false);
  const form = useActionForm(nameEarlierStockAction, null);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">Earlier stock</div>
          <div className="text-xs text-ink-3">{`${products} products · ${units} in stock · imported before batches, no name yet`}</div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Link href="/inventory?batch=earlier" className="btn-secondary min-h-9 px-3 text-sm">
            View
          </Link>
          <button type="button" className="btn-secondary min-h-9 px-3 text-sm" onClick={() => setOpen(!open)} aria-expanded={open}>
            <Pencil size={14} aria-hidden /> Rename
          </button>
        </div>
      </div>
      {open && (
        <form onSubmit={form.onSubmit} className="mt-3 space-y-2 rounded-xl border border-line bg-surface-2 p-3">
          <FormMessage state={form.state} />
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Supplier name">
              <input className="input" name="name" placeholder="e.g. China supplier 1" required maxLength={80} translate="no" />
            </Field>
            <SubmitButton pending={form.pending}>Save</SubmitButton>
          </div>
          <p className="text-xs text-ink-3">This turns the earlier stock into a named batch. Nothing is lost: its products, stock and sales stay the same.</p>
        </form>
      )}
    </li>
  );
}

/** One import batch: details, rename, and (owner only) delete with a clear summary of what goes. */
export function BatchRow({ b, canDelete }: { b: ManagedBatch; canDelete: boolean }) {
  const [mode, setMode] = useState<"view" | "rename" | "delete">("view");
  const rename = useActionForm(renameBatchAction.bind(null, b.id), null);
  const del = useActionForm(deleteBatchAction.bind(null, b.id), null);
  const blocked = b.mixedSales > 0 || b.orders > 0;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold" translate="no">
            {b.name}
          </div>
          <div className="text-xs text-ink-3">{`${b.products} products · ${b.units} in stock · ${b.sales} sales · imported ${b.created}`}</div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Link href={`/inventory?batch=${b.id}`} className="btn-secondary min-h-9 px-3 text-sm">
            View
          </Link>
          <button type="button" className="btn-secondary min-h-9 px-3 text-sm" onClick={() => setMode(mode === "rename" ? "view" : "rename")} aria-expanded={mode === "rename"}>
            <Pencil size={14} aria-hidden /> Rename
          </button>
          {canDelete && (
            <button type="button" className="btn-secondary min-h-9 px-3 text-sm text-bad hover:border-bad" onClick={() => setMode(mode === "delete" ? "view" : "delete")} aria-expanded={mode === "delete"}>
              <Trash2 size={14} aria-hidden /> Delete
            </button>
          )}
        </div>
      </div>

      {mode === "rename" && (
        <form onSubmit={rename.onSubmit} className="mt-3 space-y-2 rounded-xl border border-line bg-surface-2 p-3">
          <FormMessage state={rename.state} />
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Supplier name">
              <input className="input" name="name" defaultValue={b.name} required maxLength={80} translate="no" />
            </Field>
            <SubmitButton pending={rename.pending}>Save</SubmitButton>
          </div>
          <p className="text-xs text-ink-3">The new name is used for the batch and as the supplier on its products.</p>
        </form>
      )}

      {mode === "delete" && (
        <form onSubmit={del.onSubmit} className="mt-3 space-y-3 rounded-xl border border-bad/40 bg-bad-soft p-3 text-sm">
          <FormMessage state={del.state} />
          {blocked ? (
            <p className="text-bad">
              {b.mixedSales > 0 && `${b.mixedSales} sale${b.mixedSales === 1 ? "" : "s"} also contain items from other stock. `}
              {b.orders > 0 && `${b.orders} customer order${b.orders === 1 ? "" : "s"} include products from this batch. `}
              Void or edit those first, then delete the batch.
            </p>
          ) : (
            <>
              <p>
                This permanently removes <strong>{`${b.products} products`}</strong>, their stock (<strong>{`${b.units} units`}</strong>) and stock history, and{" "}
                <strong>{`${b.sales} sales`}</strong> made from this batch. Other batches and earlier stock are not touched. This can&apos;t be undone. Export a backup first if unsure.
              </p>
              <label className="flex items-center gap-2 font-medium">
                <input type="checkbox" name="confirm" className="size-4" required />
                {`Yes, delete “${b.name}”`}
              </label>
              <div className="flex gap-2">
                <SubmitButton pending={del.pending} className="btn-primary bg-bad hover:bg-bad" pendingText="Deleting…">
                  Delete batch
                </SubmitButton>
                <button type="button" className="btn-secondary" onClick={() => setMode("view")}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </li>
  );
}
