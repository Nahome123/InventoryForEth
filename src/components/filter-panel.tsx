import { ChevronDown, Search } from "lucide-react";

/** Collapsible search/filter card. Starts open only when a filter is already in use. */
export function FilterPanel({ active, title = "Search & filters", children }: { active: number; title?: string; children: React.ReactNode }) {
  return (
    <details className="group card mb-4" open={active > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <Search size={16} className="shrink-0 text-ink-3" aria-hidden />
          <span className="truncate">{title}</span>
          {active > 0 && <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-fg">{`${active} on`}</span>}
        </span>
        <ChevronDown size={18} className="shrink-0 text-ink-3 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-line p-3">{children}</div>
    </details>
  );
}
