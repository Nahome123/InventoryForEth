import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { customerOrders, orderItems, products, users } from "@/lib/db/schema";
import { getSettings } from "@/lib/analytics";
import { getStockLevels } from "@/lib/inventory";
import { formatMoney } from "@/lib/money";
import { formatDateTime, formatPlainDate, orderNo, saleNo } from "@/lib/format";
import { Alert, OrderStatusBadge, PageHeader, StockBadge } from "@/components/ui";
import { FulfillForm, StatusButton } from "./client";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  await requireUser("manageOrders");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { created } = await searchParams;
  const db = await getDb();
  const [row] = await db.select({ o: customerOrders, by: users.fullName }).from(customerOrders).leftJoin(users, eq(users.id, customerOrders.createdBy)).where(eq(customerOrders.id, id));
  if (!row) notFound();
  const { o } = row;
  const [items, levels, s] = await Promise.all([
    db
      .select({ item: orderItems, name: products.name, sku: products.sku })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, id))
      .orderBy(orderItems.id),
    getStockLevels(db, { includeInactive: true }),
    getSettings(db),
  ]);
  const lvl = new Map(levels.map((l) => [l.id, l]));
  const money = (c: number) => formatMoney(c, s.currency);
  const total = items.reduce((a, i) => a + i.item.quantity * i.item.unitPriceCents, 0);
  const open = o.status === "pending" || o.status === "ready";
  const missing = items.filter((i) => (lvl.get(i.item.productId)?.onHand ?? 0) < i.item.quantity);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Order ${orderNo(o.id)}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={o.status} />
            Created {formatDateTime(o.createdAt, s.timezone)} by {row.by ?? "—"}
          </span>
        }
        actions={
          <Link href="/orders" className="btn-secondary">
            ← All orders
          </Link>
        }
      />
      {created && (
        <div className="mb-4">
          <Alert tone="good">Order saved. The stock is now reserved for {o.customerName}.</Alert>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card p-5 sm:p-6 text-sm">
          <h2 className="mb-2 text-lg font-semibold">Customer</h2>
          <div className="text-base font-semibold">{o.customerName}</div>
          {o.customerPhone && (
            <a className="text-accent-fg hover:underline" href={`tel:${o.customerPhone}`}>
              {o.customerPhone}
            </a>
          )}
          {o.note && <p className="mt-2 text-ink-2">{o.note}</p>}
        </section>
        <section className="card p-5 sm:p-6 text-sm">
          <h2 className="mb-2 text-lg font-semibold">Summary</h2>
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt className="text-ink-2">Due</dt>
              <dd>{formatPlainDate(o.dueDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Total</dt>
              <dd className="font-semibold tabular-nums">{money(total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-2">Deposit paid</dt>
              <dd className="tabular-nums">{money(o.depositCents)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-1 font-bold">
              <dt>Balance due</dt>
              <dd className="tabular-nums">{money(total - o.depositCents)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="card mt-4 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">Qty</th>
              <th className="num">Price</th>
              <th className="num">Total</th>
              {open && <th className="num">On hand</th>}
              {open && <th>Stock</th>}
            </tr>
          </thead>
          <tbody>
            {items.map(({ item, name, sku }) => {
              const l = lvl.get(item.productId);
              return (
                <tr key={item.id}>
                  <td>
                    <Link href={`/products/${item.productId}`} className="hover:underline">
                      {name}
                    </Link>
                    <div className="font-mono text-xs text-ink-3">{sku}</div>
                  </td>
                  <td className="num">{item.quantity}</td>
                  <td className="num">{money(item.unitPriceCents)}</td>
                  <td className="num">{money(item.quantity * item.unitPriceCents)}</td>
                  {open && <td className="num">{l?.onHand ?? 0}</td>}
                  {open && <td>{(l?.onHand ?? 0) >= item.quantity ? <StockBadge status="ok" /> : <StockBadge status="out" />}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {o.fulfilledSaleId && (
        <p className="mt-4 text-sm">
          Fulfilled as sale{" "}
          <Link className="text-accent-fg hover:underline" href={`/sales/${o.fulfilledSaleId}`}>
            {saleNo(o.fulfilledSaleId)}
          </Link>
          .
        </p>
      )}

      {open && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <section className="card p-5 sm:p-6">
            <h2 className="mb-1 text-lg font-semibold">Customer is picking it up</h2>
            <p className="mb-3 text-sm text-ink-2">Records the sale at the prices agreed on the order and takes the items out of stock.</p>
            {missing.length > 0 ? (
              <Alert tone="warn">
                Not enough stock yet for: {missing.map((m) => m.name).join(", ")}.{" "}
                <Link href="/inventory/receive" className="underline">
                  Receive a delivery
                </Link>{" "}
                first.
              </Alert>
            ) : (
              <FulfillForm orderId={o.id} balance={money(total - o.depositCents)} />
            )}
          </section>
          <section className="card space-y-2 p-5 sm:p-6">
            <h2 className="mb-1 text-lg font-semibold">Status</h2>
            {o.status === "pending" && <StatusButton orderId={o.id} status="ready" label="Mark ready for pickup" />}
            {o.status === "ready" && <StatusButton orderId={o.id} status="pending" label="Move back to pending" />}
            <StatusButton orderId={o.id} status="cancelled" label="Cancel order" danger confirmText="Cancel this order? Reserved stock will be released." />
          </section>
        </div>
      )}
      {o.status === "cancelled" && (
        <div className="mt-4">
          <StatusButton orderId={o.id} status="pending" label="Re-open order" />
        </div>
      )}
    </div>
  );
}
