"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Layers } from "lucide-react";

export type BatchOption = { value: string; label: string };

/** Scopes the whole page to one import batch (kept in the URL as ?batch=). */
export function BatchFilter({ options, value }: { options: BatchOption[]; value?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  if (options.length <= 1) return null;
  return (
    <label className="mb-4 flex items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2">
      <Layers size={16} className="shrink-0 text-accent-fg" aria-hidden />
      <span className="shrink-0 text-sm font-medium">Batch</span>
      <select
        className="input min-h-9! flex-1 border-0! py-1! sm:max-w-md"
        value={value ?? ""}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          if (e.target.value) next.set("batch", e.target.value);
          else next.delete("batch");
          next.delete("page");
          next.delete("group");
          const qs = next.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname);
        }}
      >
        <option value="">All batches</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} translate="no">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
