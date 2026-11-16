import { BarChart3, Boxes, Check, ClipboardList, ShoppingCart, Store } from "lucide-react";
import { LangToggle } from "./lang-toggle";
import { ThemeToggle } from "./theme-toggle";
import { getLang, getTheme } from "@/lib/i18n/server";

const FEATURES = [
  {
    icon: ShoppingCart,
    title: "Fast checkout",
    text: "Ring up sales in seconds, with or without a barcode scanner.",
    points: ["Search or scan products", "Cash and mobile-money payments", "Printable receipts"],
  },
  {
    icon: Boxes,
    title: "Stock you can trust",
    text: "Every sale, delivery and adjustment updates your counts automatically.",
    points: ["Low-stock alerts", "Full movement history"],
  },
];

const EXTRAS = [
  { icon: ClipboardList, label: "Customer orders" },
  { icon: BarChart3, label: "Demand & restock forecasts" },
];

/** Two-panel layout for sign-in and first-time setup: an intro card beside the form card. */
export async function AuthShell({ storeName, title, subtitle, children }: { storeName: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-7xl items-center gap-2.5 px-4 py-4 sm:px-6">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-accent text-accent-ink">
          <Store size={16} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate font-display text-[17px] font-semibold">{storeName}</span>
        <LangToggle lang={await getLang()} />
        <ThemeToggle theme={await getTheme()} />
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 items-start gap-6 px-4 pb-12 pt-4 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-10">
        <section className="card order-2 hidden p-8 sm:block lg:order-1 lg:p-10">
          <div className="eyebrow">Your store, organised</div>
          <h2 className="mt-3 text-3xl font-semibold leading-[1.1] sm:text-[40px]">Everything your shop needs, in one place.</h2>

          {FEATURES.map((f) => (
            <div key={f.title} className="mt-8 border-t border-dashed border-line-strong pt-8">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] bg-accent-soft text-accent-fg">
                  <f.icon size={22} aria-hidden />
                </span>
                <h3 className="text-xl font-semibold">{f.title}</h3>
              </div>
              <p className="mt-4 text-[15px] text-ink-2">{f.text}</p>
              <ul className="mt-4 space-y-3">
                {f.points.map((p) => (
                  <li key={p} className="flex items-center gap-3 text-[15px]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-fg">
                      <Check size={14} strokeWidth={3} aria-hidden />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="mt-8 flex flex-wrap gap-2 border-t border-dashed border-line-strong pt-8">
            {EXTRAS.map((e) => (
              <span key={e.label} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-sm text-ink-2">
                <e.icon size={15} aria-hidden /> {e.label}
              </span>
            ))}
          </div>
        </section>

        <section className="card order-1 p-5 sm:p-8 lg:sticky lg:top-8 lg:order-2 lg:p-10">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-[15px] text-ink-2">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </section>
      </main>
    </div>
  );
}
