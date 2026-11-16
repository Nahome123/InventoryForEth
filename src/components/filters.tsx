"use client";

import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

/**
 * On phones, fields marked `filter-extra` stay folded away behind a "More filters" button so results
 * show without scrolling. From the `sm` breakpoint up everything is always visible.
 */
export function Filters({ children, active = 0 }: { children: React.ReactNode; active?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-5" data-filters data-open={open ? "" : undefined}>
      {children}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium text-ink-2 hover:bg-surface-2 sm:hidden">
        <SlidersHorizontal size={15} aria-hidden />
        {open ? "Fewer filters" : active ? `More filters · ${active} on` : "More filters"}
        <ChevronDown size={15} className={open ? "rotate-180 transition" : "transition"} aria-hidden />
      </button>
    </div>
  );
}
