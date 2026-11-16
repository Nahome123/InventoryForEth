"use client";

import { useState } from "react";
import clsx from "clsx";
import { Moon, Sun } from "lucide-react";
import { THEME_COOKIE, type Theme } from "@/lib/i18n/lang";

/** Light / dark switch. Applies instantly and is remembered on this device for a year. */
export function ThemeToggle({ theme, className }: { theme: Theme; className?: string }) {
  const [current, setCurrent] = useState<Theme>(theme);
  const flip = () => {
    const next: Theme = current === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setCurrent(next);
  };
  const dark = current === "dark";
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-line bg-surface text-ink-2 transition hover:text-ink", className)}
    >
      {dark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
    </button>
  );
}
