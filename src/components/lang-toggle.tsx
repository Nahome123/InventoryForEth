"use client";

import clsx from "clsx";
import { LANG_COOKIE, type Lang } from "@/lib/i18n/lang";

/** EN / አማ switch. Saves the choice for a year and reloads so every page renders in that language. */
export function LangToggle({ lang, className }: { lang: Lang; className?: string }) {
  const set = (next: Lang) => {
    if (next === lang) return;
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };
  return (
    <div role="group" aria-label="Language / ቋንቋ" translate="no" className={clsx("inline-flex shrink-0 rounded-[4px] border border-line bg-surface p-0.5 font-mono text-xs", className)}>
      {(
        [
          ["en", "EN"],
          ["am", "አማ"],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => set(v)}
          aria-pressed={lang === v}
          lang={v}
          className={clsx("min-h-8 min-w-9 rounded-[3px] px-2 transition", lang === v ? "bg-ink text-bg" : "text-ink-2 hover:text-ink")}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
