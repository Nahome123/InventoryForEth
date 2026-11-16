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
    <div className="card h-full p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</div>
      <div className="mt-2 font-display text-[26px] font-semibold leading-tight tracking-tight tabular-nums sm:text-3xl">{value}</div>
      {hint && <div className="mt-1.5 text-[13px] text-ink-2">{hint}</div>}
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
