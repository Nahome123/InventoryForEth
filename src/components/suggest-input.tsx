"use client";

import { useId, useMemo, useRef, useState } from "react";
import clsx from "clsx";

export type Suggestion = { value: string; label: string; sub?: string };

/**
 * A search box that suggests matches as you type (products, part numbers, customers…).
 * Picking a suggestion fills the box and submits the surrounding form.
 * When nothing matches, it says so right away instead of waiting for a search.
 */
export function SuggestInput({
  name,
  defaultValue,
  placeholder,
  ariaLabel,
  suggestions,
  className,
  submitOnPick = true,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  ariaLabel: string;
  suggestions: Suggestion[];
  className?: string;
  submitOnPick?: boolean;
}) {
  const [q, setQ] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLInputElement>(null);
  const listId = useId();

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const seen = new Set<string>();
    const out: Suggestion[] = [];
    for (const x of suggestions) {
      if (seen.has(x.value)) continue;
      if (x.label.toLowerCase().includes(s) || x.value.toLowerCase().includes(s) || (x.sub ?? "").toLowerCase().includes(s)) {
        seen.add(x.value);
        out.push(x);
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [q, suggestions]);

  const pick = (x: Suggestion) => {
    setQ(x.value);
    setOpen(false);
    setActive(-1);
    if (submitOnPick) {
      // Let React write the new value into the input before submitting.
      requestAnimationFrame(() => ref.current?.form?.requestSubmit());
    }
  };

  const showList = open && q.trim().length > 0;

  return (
    <div className={clsx("relative min-w-0", className)}>
      <input
        ref={ref}
        className="input"
        type="search"
        name={name}
        value={q}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!showList || !matches.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? matches.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(matches[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-ink-3">Not found</li>
          ) : (
            matches.map((x, i) => (
              <li key={x.value} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(x)}
                  className={clsx("flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2", i === active && "bg-surface-2")}
                >
                  <span className="min-w-0 truncate font-medium" translate="no">
                    {x.label}
                  </span>
                  {x.sub && (
                    <span className="shrink-0 font-mono text-xs text-ink-3" translate="no">
                      {x.sub}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
