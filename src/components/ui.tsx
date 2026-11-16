import Link from "next/link";
import clsx from "clsx";
import { ORDER_STATUS_LABELS } from "@/lib/format";

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type Tone = "neutral" | "good" | "warn" | "bad" | "accent";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  accent: "bg-accent-soft text-accent",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}

export function StockBadge({ status }: { status: "out" | "low" | "ok" }) {
  if (status === "out") return <Badge tone="bad">● Out</Badge>;
  if (status === "low") return <Badge tone="warn">▲ Low</Badge>;
  return <Badge tone="good">✓ OK</Badge>;
}

export function StatTile({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string }) {
  const body = (
    // Phones: a full-width row (label left, value right) so long amounts never get squeezed.
    <div className="card flex h-full items-center justify-between gap-4 px-4 py-3.5 sm:block sm:p-5">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</div>
        {hint && <div className="mt-1 truncate text-[13px] text-ink-2 sm:hidden">{hint}</div>}
      </div>
      <div className="shrink-0 text-right font-display text-xl font-semibold leading-tight tracking-tight tabular-nums sm:mt-2 sm:text-left sm:text-3xl">{value}</div>
      {hint && <div className="mt-1.5 hidden text-[13px] text-ink-2 sm:block">{hint}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl transition hover:-translate-y-0.5 hover:ring-2 hover:ring-accent/25">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-12 text-center text-sm text-ink-3">{children}</div>;
}

export function Alert({ tone = "bad", children }: { tone?: "bad" | "good" | "warn"; children: React.ReactNode }) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={clsx("rounded-xl px-4 py-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}

/** A table that scrolls horizontally inside its card on small screens. */
export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Pagination({ page, hasMore, makeHref }: { page: number; hasMore: boolean; makeHref: (p: number) => string }) {
  if (page <= 1 && !hasMore) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      {page > 1 && (
        <Link className="btn-secondary" href={makeHref(page - 1)}>
          ← Previous
        </Link>
      )}
      <span className="text-ink-3">Page {page}</span>
      {hasMore && (
        <Link className="btn-secondary" href={makeHref(page + 1)}>
          Next →
        </Link>
      )}
    </div>
  );
}

export function OrderStatusBadge({ status }: { status: "pending" | "ready" | "fulfilled" | "cancelled" }) {
  const tone = status === "ready" ? "good" : status === "pending" ? "warn" : status === "cancelled" ? "neutral" : "accent";
  return <Badge tone={tone}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

type Fact = { label: string; value: React.ReactNode; className?: string };

/** Card list shown instead of a table on phones (pair with `<div className="hidden sm:block">` around the table). */
export function MobileList({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-2.5 sm:hidden">{children}</ul>;
}

export function MobileCard({
  href,
  title,
  subtitle,
  aside,
  asideSub,
  facts,
  footer,
  muted,
}: {
  href?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  aside?: React.ReactNode;
  asideSub?: React.ReactNode;
  facts?: Fact[];
  footer?: React.ReactNode;
  muted?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold leading-snug">{title}</div>
          {subtitle && <div className="mt-0.5 truncate text-xs text-ink-3">{subtitle}</div>}
        </div>
        {(aside || asideSub) && (
          <div className="shrink-0 text-right">
            {aside && <div className="font-display text-base font-semibold tabular-nums">{aside}</div>}
            {asideSub && <div className="mt-0.5 text-xs text-ink-3">{asideSub}</div>}
          </div>
        )}
      </div>
      {facts && facts.length > 0 && (
        <dl className={clsx("mt-3 grid gap-x-3 gap-y-2.5 border-t border-dashed border-line-strong pt-3", facts.length === 2 || facts.length === 4 ? "grid-cols-2" : "grid-cols-3")}>
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3">{f.label}</dt>
              <dd className={clsx("mt-0.5 truncate text-sm font-medium tabular-nums", f.className)}>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {footer && <div className="mt-3 flex flex-wrap items-center gap-1.5">{footer}</div>}
    </>
  );
  const cls = clsx("card block p-4", muted && "opacity-70", href && "transition active:scale-[0.99]");
  return <li>{href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>}</li>;
}
