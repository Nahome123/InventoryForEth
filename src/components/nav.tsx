"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BarChart3, Boxes, ChevronDown, ClipboardList, LayoutDashboard, LogOut, Menu, Package, Plus, Receipt, Settings, ShoppingCart, Store, Upload } from "lucide-react";

const ICONS = { LayoutDashboard, ShoppingCart, Receipt, ClipboardList, Package, Boxes, BarChart3, Upload, Settings };
export type NavItem = { href: string; label: string; short?: string; icon: keyof typeof ICONS; mobile?: boolean };

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/sales") return pathname === "/sales" || (pathname.startsWith("/sales/") && !pathname.startsWith("/sales/new"));
  return pathname === href || pathname.startsWith(href + "/");
}

function Logo({ storeName }: { storeName: string }) {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-sm">
        <Store size={18} aria-hidden />
      </span>
      <span className="truncate font-display text-lg font-semibold tracking-tight">{storeName}</span>
    </Link>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Desktop header: logo, links, primary action and the account menu. */
export function TopNav({ items, storeName, userName, roleLabel, canSell, logout }: { items: NavItem[]; storeName: string; userName: string; roleLabel: string; canSell: boolean; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const links = items.filter((i) => !(canSell && i.href === "/sales/new"));
  return (
    <header className="sticky top-0 z-30 hidden border-b border-line bg-surface/80 backdrop-blur-md print:hidden lg:block">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-6 px-6">
        <div className="w-10 shrink-0 xl:w-auto xl:max-w-56">
          <span className="xl:hidden">
            <Link href="/" aria-label={storeName} className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-sm">
              <Store size={18} aria-hidden />
            </Link>
          </span>
          <span className="hidden xl:block">
            <Logo storeName={storeName} />
          </span>
        </div>

        <nav className="flex flex-1 items-center justify-center gap-0.5" aria-label="Main">
          {links.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? "page" : undefined}
                title={it.label}
                className={clsx(
                  "relative whitespace-nowrap rounded-lg px-3 py-2 text-[15px] transition-colors",
                  active ? "font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                {it.short ?? it.label}
                {active && <span className="absolute inset-x-3 -bottom-[17px] h-0.5 rounded-full bg-accent" aria-hidden />}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {canSell && (
            <Link href="/sales/new" className="btn-primary">
              <Plus size={16} aria-hidden /> New sale
            </Link>
          )}
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full p-1 pr-2 hover:bg-surface-2" aria-label="Account menu">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{initials(userName)}</span>
              <ChevronDown size={16} className="text-ink-3 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="card absolute right-0 z-40 mt-2 w-60 p-2">
              <div className="px-3 py-2">
                <div className="truncate text-sm font-semibold">{userName}</div>
                <div className="text-xs text-ink-3">{roleLabel}</div>
              </div>
              <div className="my-1 border-t border-line" />
              <form action={logout}>
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-ink-2 hover:bg-surface-2 hover:text-ink" type="submit">
                  <LogOut size={16} aria-hidden /> Sign out
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function MobileNav({ items, storeName, userName, roleLabel, logout }: { items: NavItem[]; storeName: string; userName: string; roleLabel: string; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const bottom = items.filter((i) => i.mobile).slice(0, 4);
  const rest = items.filter((i) => !bottom.includes(i));
  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/85 px-4 py-3 backdrop-blur-md print:hidden lg:hidden">
        <Logo storeName={storeName} />
        <details className="relative">
          <summary className="btn-secondary min-h-10 cursor-pointer list-none px-3 py-2" aria-label="More pages">
            <Menu size={18} aria-hidden />
          </summary>
          <div className="card absolute right-0 z-40 mt-2 w-64 p-2">
            <div className="px-3 py-2">
              <div className="truncate text-sm font-semibold">{userName}</div>
              <div className="text-xs text-ink-3">{roleLabel}</div>
            </div>
            <div className="my-1 border-t border-line" />
            {rest.map((it) => {
              const Icon = ICONS[it.icon];
              const active = isActive(pathname, it.href);
              return (
                <Link key={it.href} href={it.href} className={clsx("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm", active ? "bg-accent-soft font-medium text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}>
                  <Icon size={18} aria-hidden /> {it.label}
                </Link>
              );
            })}
            <div className="my-1 border-t border-line" />
            <form action={logout}>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ink-2 hover:bg-surface-2 hover:text-ink" type="submit">
                <LogOut size={18} aria-hidden /> Sign out
              </button>
            </form>
          </div>
        </details>
      </header>
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md print:hidden lg:hidden">
        {bottom.map((it) => {
          const Icon = ICONS[it.icon];
          const active = isActive(pathname, it.href);
          return (
            <Link key={it.href} href={it.href} className={clsx("flex flex-col items-center gap-1 py-2 text-[11px] font-medium", active ? "text-accent" : "text-ink-3")}>
              <span className={clsx("flex h-8 w-12 items-center justify-center rounded-full transition", active && "bg-accent-soft")}>
                <Icon size={20} aria-hidden />
              </span>
              {it.short ?? it.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
