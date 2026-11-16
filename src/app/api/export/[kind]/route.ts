import { NextResponse, type NextRequest } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { categories, products, saleItems, sales, stockMovements, users } from "@/lib/db/schema";
import { getRestockReport, getSettings } from "@/lib/analytics";
import { getStockLevels } from "@/lib/inventory";
import { PRODUCT_TEMPLATE, SALES_TEMPLATE, toCsv } from "@/lib/import";
import { salesWhere, type SalesFilter } from "@/lib/sales-query";
import { can } from "@/lib/permissions";
import { saleNo } from "@/lib/format";

const money = (c: number) => (c / 100).toFixed(2);

function localStamp(d: Date, tz: string) {
  // "YYYY-MM-DD HH:mm" in the store's time zone, which re-imports cleanly.
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value;
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}`;
}

function csv(name: string, body: string) {
  return new NextResponse("﻿" + body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { kind } = await params;
  if (kind === "template-products") return csv("products-template.csv", PRODUCT_TEMPLATE);
  if (kind === "template-sales") return csv("sales-template.csv", SALES_TEMPLATE);

  const needs = kind === "restock" ? "viewAnalytics" : "importExport";
  if (!can(user.role, needs)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await getDb();
  const s = await getSettings(db);
  const date = new Date().toISOString().slice(0, 10);

  switch (kind) {
    case "products": {
      const [levels, cats] = await Promise.all([getStockLevels(db, { includeInactive: true }), db.select().from(categories)]);
      const cat = new Map(cats.map((c) => [c.id, c.name]));
      return csv(
        `products-${date}.csv`,
        toCsv(
          levels.map((l) => ({
            product_id: l.id,
            name: l.name,
            sku: l.sku,
            barcode: l.barcode ?? "",
            category: l.categoryId ? cat.get(l.categoryId) : "",
            unit: l.unit,
            cost_price: money(l.costPriceCents),
            sell_price: money(l.sellPriceCents),
            on_hand: l.onHand,
            reserved: l.committed,
            available: l.available,
            reorder_level: l.reorderLevel,
            reorder_qty: l.reorderQty,
            lead_time_days: l.leadTimeDays ?? "",
            supplier: l.supplier ?? "",
            active: l.active ? "yes" : "no",
          })),
        ),
      );
    }
    case "sales": {
      const f = Object.fromEntries(req.nextUrl.searchParams) as SalesFilter;
      const rows = await db
        .select({ sale: sales, by: users.fullName })
        .from(sales)
        .leftJoin(users, eq(users.id, sales.userId))
        .where(salesWhere(f, s.timezone))
        .orderBy(desc(sales.soldAt));
      return csv(
        `sales-${date}.csv`,
        toCsv(
          rows.map(({ sale, by }) => ({
            sale: saleNo(sale.id),
            date: localStamp(sale.soldAt, s.timezone),
            status: sale.status,
            source: sale.source,
            customer: sale.customerName ?? "",
            payment_method: sale.paymentMethod,
            subtotal: money(sale.subtotalCents),
            discount: money(sale.discountCents),
            total: money(sale.totalCents),
            recorded_by: by ?? "",
            note: sale.note ?? "",
            void_reason: sale.voidReason ?? "",
          })),
        ),
      );
    }
    case "sale-items": {
      const rows = await db
        .select({ item: saleItems, sale: sales, sku: products.sku, name: products.name })
        .from(saleItems)
        .innerJoin(sales, eq(sales.id, saleItems.saleId))
        .innerJoin(products, eq(products.id, saleItems.productId))
        .where(and(eq(sales.status, "completed")))
        .orderBy(asc(sales.soldAt), asc(saleItems.id));
      // Same columns as the sales import template, so it can be re-imported elsewhere.
      return csv(
        `sale-items-${date}.csv`,
        toCsv(
          rows.map((r) => ({
            date: localStamp(r.sale.soldAt, s.timezone),
            receipt: saleNo(r.sale.id),
            sku: r.sku,
            product: r.name,
            quantity: r.item.quantity,
            unit_price: money(r.item.unitPriceCents),
            line_total: money(r.item.lineTotalCents),
            unit_cost: money(r.item.unitCostCents),
            payment_method: r.sale.paymentMethod,
            customer: r.sale.customerName ?? "",
          })),
        ),
      );
    }
    case "movements": {
      const rows = await db
        .select({ m: stockMovements, sku: products.sku, name: products.name, by: users.fullName })
        .from(stockMovements)
        .innerJoin(products, eq(products.id, stockMovements.productId))
        .leftJoin(users, eq(users.id, stockMovements.userId))
        .orderBy(asc(stockMovements.id));
      return csv(
        `stock-history-${date}.csv`,
        toCsv(
          rows.map((r) => ({
            date: localStamp(r.m.createdAt, s.timezone),
            sku: r.sku,
            product: r.name,
            type: r.m.type,
            change: r.m.quantity,
            balance_after: r.m.balanceAfter,
            sale: r.m.saleId ? saleNo(r.m.saleId) : "",
            by: r.by ?? "",
            note: r.m.note ?? "",
          })),
        ),
      );
    }
    case "restock": {
      const { rows } = await getRestockReport(db);
      return csv(
        `restock-${date}.csv`,
        toCsv(
          rows
            .filter((r) => r.forecast.suggestedOrderQty > 0)
            .map((r) => ({
              sku: r.sku,
              product: r.name,
              supplier: r.supplier ?? "",
              urgency: r.forecast.urgency,
              on_hand: r.onHand,
              reserved: r.committed,
              available: r.available,
              weekly_demand: r.forecast.enoughHistory ? (r.forecast.avgDailyDemand * 7).toFixed(1) : "",
              reorder_point: r.forecast.reorderPoint,
              suggested_qty: r.forecast.suggestedOrderQty,
              est_cost: money(r.forecast.suggestedOrderQty * r.costPriceCents),
              reason: r.forecast.explanation,
            })),
        ),
      );
    }
  }
  return NextResponse.json({ error: "Unknown export" }, { status: 404 });
}
