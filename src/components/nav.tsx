"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BarChart3, Boxes, ClipboardList, LayoutDashboard, LogOut, Package, Receipt, Settings, ShoppingCart, Upload } from "lucide-react";

const ICONS = { LayoutDashboard, ShoppingCart, Receipt, ClipboardList, Package, Boxes, BarChart3, Upload, Settings };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; mobile?: boolean };

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/sales") return pathname === "/sales" || (pathname.startsWith("/sales/") && !pathname.startsWith("/sales/new"));
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ items, storeName, userName, roleLabel, logout }: { items: NavItem[]; storeName: string; userName: string; roleLabel: string; logout: () => Promise<void> }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh print:hidden w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent font-bold text-accent-ink">{storeName.slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 truncate font-bold">{storeName}</div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2" aria-label="Main">
        {items.map((it) => {
          const Icon = ICONS[it.icon];
          const active = isActive(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={clsx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium", active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}
            >
              <Icon size={18} aria-hidden />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-line p-3">
        <div className="truncate text-sm font-semibold">{userName}</div>
        <div className="mb-2 text-xs text-ink-3">{roleLabel}</div>
        <form action={logout}>
          <button className="btn-secondary w-full" type="submit">
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

export function MobileNav({ items, storeName, logout }: { items: NavItem[]; storeName: string; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const bottom = items.filter((i) => i.mobile).slice(0, 4);
  const rest = items.filter((i) => !bottom.includes(i));
  return (
    <>
      <header className="sticky top-0 z-30 print:hidden flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="truncate font-bold">{storeName}</div>
        <details className="relative">
          <summary className="btn-secondary min-h-9 cursor-pointer list-none px-3 py-1.5">More</summary>
          <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line bg-surface p-1 shadow-lg">
            {rest.map((it) => {
              const Icon = ICONS[it.icon];
              return (
                <Link key={it.href} href={it.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-surface-2">
                  <Icon size={18} aria-hidden /> {it.label}
                </Link>
              );
            })}
            <form action={logout}>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface-2" type="submit">
                <LogOut size={18} aria-hidden /> Sign out
              </button>
            </form>
          </div>
        </details>
      </header>
      <nav aria-label="Quick" className="print:hidden fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {bottom.map((it) => {
          const Icon = ICONS[it.icon];
          const active = isActive(pathname, it.href);
          return (
            <Link key={it.href} href={it.href} className={clsx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-accent" : "text-ink-3")}>
              <Icon size={22} aria-hidden />
              {it.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
