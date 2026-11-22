import Link from "next/link";
import type { listSales } from "@/lib/sales-query";
import { formatDateTime, saleNo, toLocalInput } from "@/lib/format";
import { EditSaleButton } from "./edit-sale";
import { Badge, Empty, MobileCard, MobileList, TableWrap } from "@/components/ui";

type Rows = Awaited<ReturnType<typeof listSales>>["rows"];

/** Sales as cards on phones and a table from `sm` up. Used by Sales history and Voided sales. */
export function SalesList({
  rows,
  money,
  timezone,
  empty,
  voided = false,
  edit,
  showCosts = false,
}: {
  rows: Rows;
  money: (c: number) => string;
  timezone: string;
  empty: string;
  voided?: boolean;
  /** Present when the viewer may edit sales. */
  edit?: { origins: { id: number; name: string }[]; currency: string };
  /** Owner/manager only: show each line's buying price. Sales staff never see it. */
  showCosts?: boolean;
}) {
  const editButton = (sale: Rows[number]["sale"], ls: NonNullable<Rows[number]["lines"]>) =>
    edit && !voided ? (
      <EditSaleButton
        currency={edit.currency}
        origins={edit.origins}
        imported={sale.source === "import"}
        sale={{
          id: sale.id,
          label: saleNo(sale.id),
          customerName: sale.customerName,
          soldAtLocal: toLocalInput(sale.soldAt, timezone),
          paymentMethod: sale.paymentMethod,
          discountCents: sale.discountCents,
          lines: ls.map((l) => ({ id: l.id, name: l.name, sku: l.sku, qty: l.qty, soldCents: l.soldCents, originId: l.originId })),
        }}
      />
    ) : null;
  if (rows.length === 0)
    return (
      <TableWrap>
        <Empty>{empty}</Empty>
      </TableWrap>
    );
  return (
    <>
      <MobileList>
        {rows.map(({ sale, by, lines }) => {
          const ls = lines ?? [];
          const one = ls.length === 1 ? ls[0] : null;
          return (
            <MobileCard
              key={sale.id}
              href={`/sales/${sale.id}`}
              muted={voided}
              action={editButton(sale, ls)}
              title={ls.map((l) => l.name).join(", ") || "—"}
              subtitle={
                <>
                  <span className="font-mono">{one ? one.sku : saleNo(sale.id)}</span>
                  {sale.soldAt ? ` · ${formatDateTime(sale.soldAt, timezone)}` : ""}
                  {sale.customerName ? ` · ${sale.customerName}` : ""}
                </>
              }
              aside={<span className={voided ? "line-through" : ""}>{money(sale.totalCents)}</span>}
              asideSub={voided ? sale.voidReason ?? undefined : undefined}
              facts={
                one
                  ? [
                      { label: "Sold unit price", value: money(one.soldCents), className: "font-semibold" },
                      { label: "Qty", value: one.qty },
                      { label: "From", value: <span translate="no">{one.origin ?? "Store stock"}</span> },
                      ...(showCosts ? [{ label: "Cost", value: money(one.costCents), className: "text-xs font-normal text-ink-3" }] : []),
                    ]
                  : [
                      { label: "Products", value: ls.length },
                      { label: "Qty", value: ls.reduce((a, l) => a + l.qty, 0) },
                      { label: "By", value: by ?? "—" },
                    ]
              }
              footer={
                <>
                  {!one &&
                    ls.map((l, i) => (
                      <div key={i} className="flex w-full justify-between gap-3 text-xs text-ink-2">
                        <span className="truncate" translate="no">
                          {l.name}
                          <span className="font-mono text-ink-3">{` · ${l.sku}`}</span>
                          {l.origin && <span className="text-ink-3">{` · ${l.origin}`}</span>}
                          {l.batch && <span className="text-ink-3">{` · ${l.batch}`}</span>}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {money(l.soldCents)} × {l.qty}
                          {showCosts && <span className="ml-1 text-ink-3">{`(cost ${money(l.costCents)})`}</span>}
                        </span>
                      </div>
                    ))}
                  {sale.source === "order" && <Badge tone="accent">Order</Badge>}
                  {sale.source === "import" && <Badge>Imported</Badge>}
                </>
              }
            />
          );
        })}
      </MobileList>
      <div className="hidden sm:block">
        <TableWrap>
          <table className="data-table">
            <thead>
              <tr>
                <th>Products</th>
                <th>Part no.</th>
                <th className="num">Sold unit price</th>
                <th className="num">Qty</th>
                <th className="num">Total</th>
                <th className="hidden md:table-cell">When</th>
                <th className="hidden lg:table-cell">Customer</th>
                <th className="hidden xl:table-cell">{voided ? "Reason" : "By"}</th>
                {edit && !voided && (
                  <th className="w-10">
                    <span className="sr-only">Edit</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ sale, by, lines }) => {
                const ls = lines ?? [];
                return (
                  <tr key={sale.id} className={`align-top hover:bg-surface-2 ${voided ? "text-ink-3" : ""}`}>
                    <td className="max-w-xs">
                      <Link href={`/sales/${sale.id}`} className="block font-medium hover:underline" translate="no">
                        {ls.length
                          ? ls.map((l, i) => (
                              <div key={i} className="truncate leading-6">
                                {l.name}
                                {l.origin && <span className="ml-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-normal text-accent-fg">{l.origin}</span>}
                                {l.batch && <span className="ml-1.5 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-normal text-ink-2">{l.batch}</span>}
                              </div>
                            ))
                          : "—"}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                        <span className="font-mono">{saleNo(sale.id)}</span>
                        {sale.source === "order" && <Badge tone="accent">Order</Badge>}
                        {sale.source === "import" && <Badge>Imported</Badge>}
                      </div>
                    </td>
                    <td className="font-mono text-xs text-ink-2" translate="no">
                      {ls.map((l, i) => (
                        <div key={i} className="whitespace-nowrap leading-6">
                          {l.sku}
                        </div>
                      ))}
                    </td>
                    <td className="num font-medium">
                      {ls.map((l, i) => (
                        <div key={i} className="whitespace-nowrap leading-6">
                          {money(l.soldCents)}
                          {showCosts && <span className="ml-1.5 text-[11px] font-normal text-ink-3">{`cost ${money(l.costCents)}`}</span>}
                        </div>
                      ))}
                    </td>
                    <td className="num">
                      {ls.map((l, i) => (
                        <div key={i} className="leading-6">
                          {l.qty}
                        </div>
                      ))}
                    </td>
                    <td className={`num font-semibold leading-6 ${voided ? "line-through" : ""}`}>{money(sale.totalCents)}</td>
                    <td className="hidden whitespace-nowrap leading-6 text-ink-2 md:table-cell">{formatDateTime(sale.soldAt, timezone)}</td>
                    <td className="hidden leading-6 lg:table-cell">{sale.customerName ?? "—"}</td>
                    <td className="hidden leading-6 text-ink-2 xl:table-cell">{voided ? (sale.voidReason ?? "—") : (by ?? "—")}</td>
                    {edit && !voided && <td className="py-1.5">{editButton(sale, ls)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </>
  );
}
