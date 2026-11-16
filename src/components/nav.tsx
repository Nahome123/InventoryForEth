"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { BarChart3, Boxes, ChevronDown, ClipboardList, LayoutDashboard, LogOut, Menu, Package, Plus, Receipt, Settings, ShoppingCart, Store, Upload, X } from "lucide-react";

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

/** Phone header + bottom tab bar with a raised Sell button and a slide-up menu sheet. */
export function MobileNav({ items, storeName, userName, roleLabel, canSell, logout }: { items: NavItem[]; storeName: string; userName: string; roleLabel: string; canSell: boolean; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const byHref = new Map(items.map((i) => [i.href, i]));
  const tabs = ["/", "/products", "/orders", "/sales"].map((h) => byHref.get(h)).filter((i): i is NavItem => !!i).slice(0, 3);
  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);
  const sellActive = pathname.startsWith("/sales/new");

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface/85 px-4 py-3 backdrop-blur-md print:hidden lg:hidden">
        <Logo storeName={storeName} />
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Account and menu" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
          {initials(userName)}
        </button>
      </header>

      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md print:hidden lg:hidden">
        <div className={clsx("mx-auto grid max-w-md", canSell ? "grid-cols-5" : "grid-cols-4")}>
          {left.map((it) => (
            <Tab key={it.href} it={it} pathname={pathname} />
          ))}
          {canSell && (
            <div className="flex justify-center">
              <Link
                href="/sales/new"
                aria-label="New sale"
                aria-current={sellActive ? "page" : undefined}
                className={clsx("-mt-5 flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-lg ring-4 ring-bg transition active:scale-95", sellActive && "bg-accent-strong")}
              >
                <ShoppingCart size={22} aria-hidden />
                <span className="text-[10px] font-semibold">Sell</span>
              </Link>
            </div>
          )}
          {right.map((it) => (
            <Tab key={it.href} it={it} pathname={pathname} />
          ))}
          <button type="button" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} className={clsx("flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium", menuOpen ? "text-accent" : "text-ink-3")}>
            <Menu size={22} strokeWidth={1.75} aria-hidden />
            Menu
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="fixed inset-0 z-50 print:hidden lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-line bg-surface px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong" aria-hidden />
            <div className="flex items-center gap-3 px-1">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">{initials(userName)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{userName}</div>
                <div className="truncate text-xs text-ink-3">
                  {roleLabel} · {storeName}
                </div>
              </div>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="flex h-9 w-9 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2">
                <X size={20} aria-hidden />
              </button>
            </div>

            <div className="eyebrow mb-3 mt-6 px-1">Go to</div>
            <div className="grid grid-cols-3 gap-2.5">
              {items.map((it) => {
                const Icon = ICONS[it.icon];
                const active = isActive(pathname, it.href);
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setMenuOpen(false)}
                    className={clsx("flex flex-col items-center gap-2 rounded-2xl border px-2 py-3.5 text-center text-xs font-medium transition active:scale-[0.97]", active ? "border-accent/40 bg-accent-soft text-accent" : "border-line text-ink-2")}
                  >
                    <span className={clsx("flex h-10 w-10 items-center justify-center rounded-xl", active ? "bg-surface" : "bg-accent-soft text-accent")}>
                      <Icon size={20} aria-hidden />
                    </span>
                    {it.label}
                  </Link>
                );
              })}
            </div>

            <form action={logout} className="mt-5">
              <button className="btn-secondary w-full" type="submit">
                <LogOut size={16} aria-hidden /> Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Tab({ it, pathname }: { it: NavItem; pathname: string }) {
  const Icon = ICONS[it.icon];
  const active = isActive(pathname, it.href);
  return (
    <Link href={it.href} aria-current={active ? "page" : undefined} className={clsx("flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium", active ? "text-accent" : "text-ink-3")}>
      <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
      {it.short ?? it.label}
    </Link>
  );
}
