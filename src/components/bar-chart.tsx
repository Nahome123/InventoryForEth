"use client";

import { useState } from "react";

type Point = { label: string; value: number; display: string; sub?: string };
export type BarDetail = { title: string; rows: { name: string; sub?: string; qty: number; amount: string }[] };

/** Single-series column chart with hover/focus tooltip and a table fallback. */
export function BarChart({ data, ariaLabel, axisDivisor = 1, details }: { data: Point[]; ariaLabel: string; axisDivisor?: number; /** Same order as `data`: shown under the chart when a bar is clicked. */ details?: BarDetail[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const pad = { l: 56, r: 8, t: 12, b: 26 };
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const slot = innerW / data.length;
  const barW = Math.max(2, Math.min(28, slot - 2)); // 2px surface gap between bars
  const ticks = [0, 0.5, 1].map((f) => f * nice);
  const y = (v: number) => pad.t + innerH - (v / nice) * innerH;
  const labelEvery = Math.ceil(data.length / 8);
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-3)">
              {new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(t / axisDivisor)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.l + i * slot + (slot - barW) / 2;
          const top = y(d.value);
          const bh = Math.max(0, pad.t + innerH - top);
          const r = Math.min(4, barW / 2, bh);
          return (
            <g key={d.label}>
              {bh > 0 && (
                <path
                  d={`M${x},${pad.t + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.t + innerH} Z`}
                  fill="var(--series-1)"
                  opacity={(picked ?? hover) === null || (picked ?? hover) === i || hover === i ? 1 : 0.45}
                  stroke={picked === i ? "var(--text-1, currentColor)" : undefined}
                  strokeWidth={picked === i ? 1.5 : 0}
                />
              )}
              {/* Hit target taller and wider than the mark. */}
              <rect
                x={pad.l + i * slot}
                y={pad.t}
                width={slot}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                role={details ? "button" : undefined}
                style={details ? { cursor: "pointer" } : undefined}
                aria-pressed={details ? picked === i : undefined}
                onClick={() => details && setPicked(picked === i ? null : i)}
                onKeyDown={(e) => {
                  if (details && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    setPicked(picked === i ? null : i);
                  }
                }}
                aria-label={`${d.label}: ${d.display}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
              {i % labelEvery === 0 && (
                <text x={pad.l + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--text-3)">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + innerH} y2={pad.t + innerH} stroke="var(--text-3)" strokeWidth={1} />
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${((pad.l + hover * slot + slot / 2) / W) * 100}%` }}
        >
          <div className="font-semibold text-ink">{h.label}</div>
          <div className="tabular-nums text-ink-2">{h.display}</div>
          {h.sub && <div className="text-ink-3">{h.sub}</div>}
        </div>
      )}
      {details && picked === null && <p className="mt-1 text-xs text-ink-3">Click a bar to see that day&apos;s sales.</p>}
      {details && picked !== null && details[picked] && (
        <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3 sm:p-4" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-semibold">{details[picked].title}</h3>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold tabular-nums">{data[picked].display}</span>
              {data[picked].sub && <span className="text-ink-3">{data[picked].sub}</span>}
              <button type="button" className="text-xs text-ink-3 underline" onClick={() => setPicked(null)}>
                Close
              </button>
            </div>
          </div>
          {details[picked].rows.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">No sales that day.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="num">Qty</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {details[picked].rows.map((r, k) => (
                    <tr key={k}>
                      <td>
                        <span className="font-medium" translate="no">{r.name}</span>
                        {r.sub && <span className="ml-1.5 font-mono text-xs text-ink-3" translate="no">{r.sub}</span>}
                      </td>
                      <td className="num">{r.qty}</td>
                      <td className="num">{r.amount}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td>Total</td>
                    <td className="num">{details[picked].rows.reduce((a, r) => a + r.qty, 0)}</td>
                    <td className="num">{data[picked].display}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
      <details className="mt-2 text-xs text-ink-2">
        <summary className="cursor-pointer select-none">Show as table</summary>
        <table className="data-table mt-2">
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td className="num">{d.display}</td>
                <td className="text-ink-3">{d.sub}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
