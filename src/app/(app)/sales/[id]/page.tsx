import Link from "next/link";
import { notFound } from "next/navigation";
import { alias } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { products, saleItems, sales, users } from "@/lib/db/schema";
import { getSettings } from "@/lib/analytics";
import { can } from "@/lib/permissions";
import { formatMoney } from "@/lib/money";
import { formatDateTime, orderNo, PAYMENT_LABELS, saleNo } from "@/lib/format";
import { Alert, Badge, PageHeader } from "@/components/ui";
import { PrintButton, VoidSaleForm } from "./client";

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("recordSales");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const voider = alias(users, "voider");
  const [row] = await db
    .select({ sale: sales, by: users.fullName, voidedByName: voider.fullName })
    .from(sales)
    .leftJoin(users, eq(users.id, sales.userId))
    .leftJoin(voider, eq(voider.id, sales.voidedBy))
    .where(eq(sales.id, id));
  if (!row) notFound();
  const [items, s] = await Promise.all([
    db
      .select({ item: saleItems, name: products.name, sku: products.sku })
      .from(saleItems)
      .innerJoin(products, eq(products.id, saleItems.productId))
      .where(eq(saleItems.saleId, id))
      .orderBy(saleItems.id),
    getSettings(db),
  ]);
  const { sale } = row;
  const money = (c: number) => formatMoney(c, s.currency);
  const showCosts = can(user.role, "viewCosts");
  const cost = items.reduce((a, i) => a + i.item.unitCostCents * i.item.quantity, 0);

  return (
    <div className="max-w-2xl">
      <div className="print:hidden">
        <PageHeader
          title={`Sale ${saleNo(sale.id)}`}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              {formatDateTime(sale.soldAt, s.timezone)}
              {sale.status === "voided" ? <Badge tone="bad">Voided</Badge> : <Badge tone="good">Completed</Badge>}
              {sale.source === "import" && <Badge>Imported</Badge>}
            </span>
          }
          actions={
            <>
              <Link href="/sales" className="btn-secondary">
                ← All sales
              </Link>
              <PrintButton />
            </>
          }
        />
        {sale.status === "voided" && (
          <div className="mb-4">
            <Alert tone="warn">
              Voided {sale.voidedAt ? formatDateTime(sale.voidedAt, s.timezone) : ""} by {row.voidedByName ?? "unknown"}: “{sale.voidReason}”. Stock taken by this sale was returned.
            </Alert>
          </div>
        )}
      </div>

      <article className="card p-5 print:border-0 print:p-0">
        <header className="mb-4 text-center">
          <div className="text-lg font-bold">{s.storeName}</div>
          <div className="text-sm text-ink-2">
            Receipt {saleNo(sale.id)} · {formatDateTime(sale.soldAt, s.timezone)}
          </div>
          {sale.customerName && <div className="text-sm">Customer: {sale.customerName}</div>}
        </header>
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Price</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ item, name, sku }) => (
              <tr key={item.id}>
                <td>
                  <Link href={`/products/${item.productId}`} className="hover:underline print:no-underline">
                    {name}
                  </Link>
                  <div className="font-mono text-xs text-ink-3">{sku}</div>
                </td>
                <td className="num">{item.quantity}</td>
                <td className="num">{money(item.unitPriceCents)}</td>
                <td className="num">{money(item.lineTotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-2">Subtotal</dt>
            <dd className="tabular-nums">{money(sale.subtotalCents)}</dd>
          </div>
          {sale.discountCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-2">Discount</dt>
              <dd className="tabular-nums">−{money(sale.discountCents)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(sale.totalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">Paid by</dt>
            <dd>{PAYMENT_LABELS[sale.paymentMethod]}</dd>
          </div>
        </dl>
        {sale.note && <p className="mt-3 text-sm text-ink-2">Note: {sale.note}</p>}
        <p className="mt-4 text-center text-xs text-ink-3">Served by {row.by ?? "—"}. Thank you!</p>
      </article>

      <div className="mt-4 space-y-4 print:hidden">
        {sale.orderId && (
          <p className="text-sm">
            From customer order{" "}
            <Link href={`/orders/${sale.orderId}`} className="text-accent hover:underline">
              {orderNo(sale.orderId)}
            </Link>
          </p>
        )}
        {showCosts && sale.status === "completed" && (
          <p className="text-sm text-ink-2">
            Cost of goods {money(cost)} · gross profit {money(sale.totalCents - cost)}
          </p>
        )}
        {can(user.role, "voidSales") && sale.status === "completed" && (
          <section className="card p-4">
            <h2 className="mb-1 font-bold">Void this sale</h2>
            <p className="mb-3 text-sm text-ink-2">
              Use this if the sale was entered by mistake or fully refunded. {sale.source === "import" ? "Imported sales didn't change stock, so no stock is returned." : "All items go back into stock."}
              {sale.orderId ? " The customer order goes back to “Ready”." : ""}
            </p>
            <VoidSaleForm saleId={sale.id} />
          </section>
        )}
      </div>
    </div>
  );
}
