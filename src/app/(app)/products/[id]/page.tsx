import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { categories, products, stockMovements, users } from "@/lib/db/schema";
import { getRestockReport, getSettings } from "@/lib/analytics";
import { can } from "@/lib/permissions";
import { centsToInput, formatMoney } from "@/lib/money";
import { formatDateTime, MOVEMENT_LABELS, saleNo } from "@/lib/format";
import { Alert, Badge, Empty, PageHeader, StatTile, StockBadge, TableWrap } from "@/components/ui";
import { ProductForm } from "../product-form";
import { setActiveAction, updateProductAction } from "../actions";
import { AdjustStockForm } from "./adjust-form";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const user = await requireUser("viewInventory");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const { created } = await searchParams;
  const db = await getDb();
  const [p] = await db.select().from(products).where(eq(products.id, id));
  if (!p) notFound();
  const [s, cats, moves, report] = await Promise.all([
    getSettings(db),
    db.select().from(categories).orderBy(asc(categories.name)),
    db
      .select({ m: stockMovements, user: users.fullName })
      .from(stockMovements)
      .leftJoin(users, eq(users.id, stockMovements.userId))
      .where(eq(stockMovements.productId, id))
      .orderBy(desc(stockMovements.id))
      .limit(50),
    getRestockReport(db),
  ]);
  const row = report.rows.find((r) => r.id === id);
  const committed = row?.committed ?? 0;
  const available = p.stockOnHand - committed;
  const f = row?.forecast;
  const money = (c: number) => formatMoney(c, s.currency);
  const canEdit = can(user.role, "manageProducts");
  const category = cats.find((c) => c.id === p.categoryId)?.name ?? "";

  return (
    <>
      <PageHeader
        title={p.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{p.sku}</span>
            {p.barcode && <span className="font-mono text-ink-3">· {p.barcode}</span>}
            {p.active ? <StockBadge status={row?.status ?? "ok"} /> : <Badge>Deactivated</Badge>}
          </span>
        }
        actions={
          canEdit && (
            <form action={setActiveAction.bind(null, id, !p.active)}>
              <button className={p.active ? "btn-secondary" : "btn-primary"} type="submit">
                {p.active ? "Deactivate" : "Reactivate"}
              </button>
            </form>
          )
        }
      />
      {created && (
        <div className="mb-4">
          <Alert tone="good">Product created.</Alert>
        </div>
      )}
      {!p.active && (
        <div className="mb-4">
          <Alert tone="warn">This product is deactivated: it can&apos;t be sold or ordered and is hidden from lists. Its history is kept.</Alert>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="On hand" value={`${p.stockOnHand} ${p.unit}`} />
        <StatTile label="Reserved for orders" value={committed} />
        <StatTile label="Available to sell" value={available} hint={`Reorder level ${p.reorderLevel}`} />
        <StatTile
          label="Demand"
          value={f?.enoughHistory ? `${(f.avgDailyDemand * 7).toFixed(1)}/wk` : "—"}
          hint={f?.enoughHistory ? `~${f.forecastNext30} in next 30 days · ${f.trend}` : "Not enough history yet"}
        />
      </div>
      {f && f.suggestedOrderQty > 0 && (
        <div className="mt-3">
          <Alert tone={f.urgency === "order_now" ? "bad" : "warn"}>
            <strong>{f.urgency === "order_now" ? "Order now: " : "Restock soon: "}</strong>
            {f.explanation}
          </Alert>
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {canEdit ? (
            <ProductForm
              action={updateProductAction.bind(null, id)}
              isNew={false}
              categories={cats.map((c) => c.name)}
              currency={s.currency}
              defaultLeadTime={s.defaultLeadTimeDays}
              initial={{
                name: p.name,
                sku: p.sku,
                barcode: p.barcode ?? "",
                category,
                description: p.description ?? "",
                unit: p.unit,
                costPrice: centsToInput(p.costPriceCents),
                sellPrice: centsToInput(p.sellPriceCents),
                reorderLevel: String(p.reorderLevel),
                reorderQty: String(p.reorderQty),
                leadTimeDays: p.leadTimeDays === null ? "" : String(p.leadTimeDays),
                supplier: p.supplier ?? "",
              }}
            />
          ) : (
            <section className="card p-5 sm:p-6">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <dt className="text-ink-3">Price</dt>
                <dd>{money(p.sellPriceCents)}</dd>
                <dt className="text-ink-3">Category</dt>
                <dd>{category || "—"}</dd>
                <dt className="text-ink-3">Unit</dt>
                <dd>{p.unit}</dd>
                <dt className="text-ink-3">Supplier</dt>
                <dd>{p.supplier || "—"}</dd>
              </dl>
              {p.description && <p className="mt-3 text-sm text-ink-2">{p.description}</p>}
            </section>
          )}
        </div>

        <aside className="space-y-5">
          {can(user.role, "adjustStock") && p.active && (
            <section className="card p-5 sm:p-6">
              <h2 className="mb-3 text-lg font-semibold">Change stock</h2>
              <AdjustStockForm productId={id} onHand={p.stockOnHand} unit={p.unit} />
            </section>
          )}
        </aside>
      </div>

      <h2 className="mb-2 mt-6 text-lg font-semibold">Stock history</h2>
      <TableWrap>
        {moves.length === 0 ? (
          <Empty>No stock movements yet.</Empty>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th className="num">Change</th>
                <th className="num">Balance</th>
                <th className="hidden sm:table-cell">By</th>
                <th className="hidden md:table-cell">Note</th>
              </tr>
            </thead>
            <tbody>
              {moves.map(({ m, user: by }) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-ink-2">{formatDateTime(m.createdAt, s.timezone)}</td>
                  <td>
                    {MOVEMENT_LABELS[m.type]}
                    {m.saleId && (
                      <Link href={`/sales/${m.saleId}`} className="ml-1 text-xs text-accent hover:underline">
                        {saleNo(m.saleId)}
                      </Link>
                    )}
                  </td>
                  <td className={`num font-semibold ${m.quantity > 0 ? "text-good" : "text-bad"}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                  <td className="num">{m.balanceAfter}</td>
                  <td className="hidden text-ink-2 sm:table-cell">{by ?? "—"}</td>
                  <td className="hidden max-w-xs truncate text-ink-2 md:table-cell">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableWrap>
      <p className="mt-2 text-xs text-ink-3">
        <Link href={`/inventory/movements?product=${id}`} className="hover:underline">
          See full history →
        </Link>
      </p>
    </>
  );
}
