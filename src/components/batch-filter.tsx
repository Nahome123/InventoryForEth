"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { Layers } from "lucide-react";

export type BatchOption = { value: string; label: string };

/**
 * Toggle buttons that scope the whole page to one import batch (kept in the URL as ?batch=).
 * One row; scrolls sideways on phones when there are many batches.
 */
export function BatchFilter({ options, value }: { options: BatchOption[]; value?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  if (options.length <= 1) return null;

  const href = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set("batch", v);
    else next.delete("batch");
    next.delete("page");
    next.delete("group");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const all: BatchOption = { value: "", label: "All batches" };

  return (
    <nav aria-label="Batch" className="mb-4 flex items-center gap-2">
      <span className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-ink-3">
        <Layers size={14} className="text-accent-fg" aria-hidden />
        Batch
      </span>
      <div className="-my-1 flex min-w-0 gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[all, ...options].map((o) => {
          const active = (value ?? "") === o.value;
          return (
            <Link
              key={o.value || "all"}
              href={href(o.value)}
              aria-current={active ? "true" : undefined}
              translate={o.value ? "no" : undefined}
              className={clsx(
                "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition",
                active ? "border-accent bg-accent text-accent-ink shadow-sm" : "border-line-strong bg-surface text-ink-2 hover:border-accent/50 hover:text-ink",
              )}
            >
              {o.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
