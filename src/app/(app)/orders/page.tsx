import Link from "next/link";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { customerOrders, orderItems, type OrderStatus } from "@/lib/db/schema";
import { addDays, getSettings } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import { formatPlainDate, orderNo, todayInZone } from "@/lib/format";
import { Badge, Empty, OrderStatusBadge, PageHeader, TableWrap } from "@/components/ui";
import clsx from "clsx";

export const metadata = { title: "Customer orders" };

const TABS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: "open", label: "Open", statuses: ["pending", "ready"] },
  { key: "fulfilled", label: "Fulfilled", statuses: ["fulfilled"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  await requireUser("manageOrders");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const db = await getDb();
  const s = await getSettings(db);
  const today = todayInZone(s.timezone);
  const q = (sp.q ?? "").trim();
  const rows = await db
    .select({
      o: customerOrders,
      total: sql<number>`(select coalesce(sum(${orderItems.quantity} * ${orderItems.unitPriceCents}),0)::bigint from ${orderItems} where ${orderItems.orderId} = ${customerOrders.id})`,
      units: sql<number>`(select coalesce(sum(${orderItems.quantity}),0)::int from ${orderItems} where ${orderItems.orderId} = ${customerOrders.id})`,
    })
    .from(customerOrders)
    .where(
      and(
        inArray(customerOrders.status, tab.statuses),
        q ? or(ilike(customerOrders.customerName, `%${q}%`), ilike(customerOrders.customerPhone, `%${q}%`), /^\d+$/.test(q) ? eq(customerOrders.id, Number(q)) : undefined) : undefined,
      ),
    )
    .orderBy(tab.key === "open" ? sql`${customerOrders.dueDate} asc nulls last` : desc(customerOrders.updatedAt), asc(customerOrders.id))
    .limit(200);

  return (
    <>
      <PageHeader
        title="Customer orders"
        subtitle="Orders customers placed for later pickup. Open orders reserve stock so it isn't sold to someone else."
        actions={
          <Link href="/orders/new" className="btn-primary">
            + New order
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <nav className="flex gap-1 rounded-lg bg-surface-2 p-1" aria-label="Order status">
          {TABS.map((t) => (
            <Link key={t.key} href={`/orders?tab=${t.key}`} aria-current={t === tab ? "page" : undefined} className={clsx("rounded-md px-3 py-1.5 text-sm font-medium", t === tab ? "bg-surface shadow-sm" : "text-ink-2")}>
              {t.label}
            </Link>
          ))}
        </nav>
        <form className="flex gap-2">
          <input type="hidden" name="tab" value={tab.key} />
          <input className="input" type="search" name="q" defaultValue={sp.q} placeholder="Customer, phone or order #" aria-label="Search orders" />
        </form>
      </div>
      <TableWrap>
        {rows.length === 0 ? (
          <Empty>No {tab.label.toLowerCase()} orders.</Empty>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Due</th>
                <th className="num hidden sm:table-cell">Units</th>
                <th className="num">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ o, total, units }) => {
                const overdue = tab.key === "open" && o.dueDate && o.dueDate < today;
                const soon = tab.key === "open" && o.dueDate && !overdue && o.dueDate <= addDays(today, 3);
                return (
                  <tr key={o.id} className="hover:bg-surface-2">
                    <td>
                      <Link href={`/orders/${o.id}`} className="font-mono font-medium hover:underline">
                        {orderNo(o.id)}
                      </Link>
                    </td>
                    <td>
                      {o.customerName}
                      {o.customerPhone && <div className="text-xs text-ink-3">{o.customerPhone}</div>}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatPlainDate(o.dueDate)}
                      {overdue && (
                        <Badge tone="bad" className="ml-2">
                          Overdue
                        </Badge>
                      )}
                      {soon && (
                        <Badge tone="warn" className="ml-2">
                          Soon
                        </Badge>
                      )}
                    </td>
                    <td className="num hidden sm:table-cell">{units}</td>
                    <td className="num">{formatMoney(Number(total), s.currency)}</td>
                    <td>
                      <OrderStatusBadge status={o.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </TableWrap>
    </>
  );
}
