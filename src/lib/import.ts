import Papa from "papaparse";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Executor } from "./db/client";
import { batches, paymentMethod as paymentEnum, products, type PaymentMethod } from "./db/schema";
import { UserError } from "./errors";
import { parseMoneyToCents } from "./money";
import { createProductTx, findOrCreateCategory, parseProductInput } from "./products";
import { createSaleTx } from "./sales";

export const PRODUCT_TEMPLATE =
  "name,sku,barcode,category,unit,cost_price,sell_price,opening_stock,reorder_level,reorder_qty,lead_time_days,supplier\n" +
  "Bic Pen Blue,PEN-BLUE,0070330717534,Stationery,pcs,0.20,0.50,120,30,100,7,Main Wholesaler\n";

export const SALES_TEMPLATE =
  "date,receipt,sku,quantity,unit_price,payment_method,customer\n" +
  "2026-09-01 10:15,R1001,PEN-BLUE,3,0.50,cash,\n" +
  "2026-09-01 10:15,R1001,NOTEBOOK-A5,1,2.00,cash,\n" +
  "2026-09-02,,PEN-BLUE,10,,mobile_money,School office\n";

export type ImportResult = { created: number; updated: number; sales?: number; lines?: number; batchId?: number; errors: string[] };

/** `batch` set: every row becomes a new product in a new, separate batch. Otherwise rows update/create "earlier stock" products. */
export type ProductImportOptions = { batch?: { name: string; supplier: string | null } };

const norm = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, "_");

export function parseCsv(text: string): Record<string, string>[] {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: norm });
  if (res.errors.length) {
    const e = res.errors[0];
    throw new UserError(`Couldn't read the CSV${e.row !== undefined ? ` (row ${e.row + 2})` : ""}: ${e.message}`);
  }
  return res.data.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" ? v.trim() : ""])));
}

const pick = (r: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) if (r[k] !== undefined && r[k] !== "") return r[k];
  return "";
};

/** Creates new products and updates existing ones (matched by SKU). All-or-nothing. */
export async function importProducts(db: Executor, csv: string, userId: number, opts: ProductImportOptions = {}): Promise<ImportResult> {
  const rows = parseCsv(csv);
  if (!rows.length) throw new UserError("The file has no data rows.");
  if (rows.length > 5000) throw new UserError("Please import at most 5,000 rows at a time.");
  const errors: string[] = [];
  const seen = new Set<string>();
  const parsed = rows.map((r, i) => {
    const raw = {
      name: pick(r, "name", "product_name", "product"),
      sku: pick(r, "sku", "code", "product_code"),
      barcode: pick(r, "barcode", "upc", "ean"),
      category: pick(r, "category"),
      unit: pick(r, "unit"),
      costPrice: pick(r, "cost_price", "cost"),
      sellPrice: pick(r, "sell_price", "selling_price", "price"),
      reorderLevel: pick(r, "reorder_level", "min_stock"),
      reorderQty: pick(r, "reorder_qty", "reorder_quantity"),
      leadTimeDays: pick(r, "lead_time_days", "lead_time"),
      supplier: opts.batch?.supplier || pick(r, "supplier"),
      description: pick(r, "description"),
      openingStock: pick(r, "opening_stock", "stock", "quantity", "qty"),
    };
    try {
      parseProductInput(raw);
      const os = raw.openingStock === "" ? 0 : Number(raw.openingStock);
      if (!Number.isInteger(os) || os < 0) throw new UserError("Opening stock must be a whole number of 0 or more.");
      const key = raw.sku.toLowerCase();
      if (seen.has(key)) throw new UserError(`SKU "${raw.sku}" appears more than once in the file.`);
      seen.add(key);
    } catch (e) {
      errors.push(`Row ${i + 2}: ${e instanceof Error ? e.message : String(e)}`);
    }
    return raw;
  });
  if (errors.length) return { created: 0, updated: 0, errors };

  let created = 0;
  let updated = 0;
  let batchId: number | undefined;
  try {
    await db.transaction(async (tx) => {
      if (opts.batch) {
        const [b] = await tx.insert(batches).values({ name: opts.batch.name, supplier: opts.batch.supplier, createdBy: userId }).returning({ id: batches.id });
        batchId = b.id;
      }
      // A new batch never touches existing products; otherwise match "earlier stock" products by SKU.
      const existing = batchId
        ? []
        : await tx
            .select({ id: products.id, sku: products.sku })
            .from(products)
            .where(and(inArray(sql`lower(${products.sku})`, [...seen]), isNull(products.batchId)));
      const bySku = new Map(existing.map((e) => [e.sku.toLowerCase(), e.id]));
      for (const [i, raw] of parsed.entries()) {
        try {
          const id = bySku.get(raw.sku.toLowerCase());
          if (id) {
            const d = parseProductInput(raw);
            const categoryId = await findOrCreateCategory(tx, d.category);
            await tx
              .update(products)
              .set({
                name: d.name,
                barcode: d.barcode,
                categoryId,
                unit: d.unit,
                costPriceCents: d.costPrice,
                sellPriceCents: d.sellPrice,
                reorderLevel: d.reorderLevel ?? 0,
                reorderQty: d.reorderQty ?? 0,
                leadTimeDays: d.leadTimeDays,
                supplier: d.supplier,
                description: d.description,
                updatedAt: new Date(),
              })
              .where(eq(products.id, id));
            updated++;
          } else {
            await createProductTx(tx, raw, userId, batchId ?? null);
            created++;
          }
        } catch (e) {
          throw new UserError(`Row ${i + 2}: ${e instanceof UserError ? e.message : (e as { code?: string })?.code === "23505" ? "barcode already used by another product" : String(e)}`);
        }
      }
    });
  } catch (e) {
    if (e instanceof UserError) return { created: 0, updated: 0, errors: [e.message] };
    throw e;
  }
  return { created, updated, batchId, errors: [] };
}

function tzOffsetMs(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - at.getTime();
}

/** Parses "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" as wall-clock time in the store's time zone. */
export function parseLocalDateTime(input: string, timeZone: string): Date | null {
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(input.trim());
  if (!m) return null;
  const [y, mo, d, h = "12", mi = "0", s = "0"] = m.slice(1);
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  const check = new Date(guess);
  if (check.getUTCMonth() !== +mo - 1 || check.getUTCDate() !== +d || +h > 23) return null;
  const off1 = tzOffsetMs(new Date(guess), timeZone);
  let t = guess - off1;
  const off2 = tzOffsetMs(new Date(t), timeZone);
  if (off2 !== off1) t = guess - off2;
  return new Date(t);
}

/**
 * Imports historical sales. Rows sharing a receipt number (and date) become one sale.
 * By default historical sales do NOT change current stock (it was counted after they happened).
 */
export async function importSales(db: Executor, csv: string, opts: { userId: number; timeZone: string; affectStock: boolean; /** Match SKUs in this batch; null/omitted = earlier stock. */ batchId?: number | null }): Promise<ImportResult> {
  const rows = parseCsv(csv);
  if (!rows.length) throw new UserError("The file has no data rows.");
  if (rows.length > 20000) throw new UserError("Please import at most 20,000 rows at a time.");
  const errors: string[] = [];
  const skus = [...new Set(rows.map((r) => pick(r, "sku", "code", "product_code").toLowerCase()).filter(Boolean))];
  const prods = skus.length
    ? await db
        .select()
        .from(products)
        .where(and(inArray(sql`lower(${products.sku})`, skus), opts.batchId == null ? isNull(products.batchId) : eq(products.batchId, opts.batchId)))
    : [];
  const bySku = new Map(prods.map((p) => [p.sku.toLowerCase(), p]));
  const now = Date.now();

  type Group = { soldAt: Date | null; method: PaymentMethod; customer: string; items: { productId: number; quantity: number; unitPriceCents: number }[] };
  const groups = new Map<string, Group>();
  rows.forEach((r, i) => {
    const rowNo = i + 2;
    const dateStr = pick(r, "date", "sold_at", "sale_date");
    const sku = pick(r, "sku", "code", "product_code");
    const qty = Number(pick(r, "quantity", "qty"));
    const priceStr = pick(r, "unit_price", "price");
    const method = (pick(r, "payment_method", "payment") || "cash").toLowerCase().replace(/\s+/g, "_") as PaymentMethod;
    const soldAt = dateStr ? parseLocalDateTime(dateStr, opts.timeZone) : null;
    const p = bySku.get(sku.toLowerCase());
    const problems: string[] = [];
    if (dateStr && !soldAt) problems.push(`date "${dateStr}" must look like 2026-09-01 or 2026-09-01 14:30 (or leave it blank if unknown)`);
    else if (soldAt && soldAt.getTime() > now + 60_000) problems.push("date is in the future");
    if (!sku) problems.push("SKU is missing");
    else if (!p) problems.push(`no product with SKU "${sku}" in the chosen batch (import its products first, or pick another batch)`);
    if (!Number.isInteger(qty) || qty <= 0) problems.push("quantity must be a whole number of at least 1");
    const price = priceStr === "" ? (p?.sellPriceCents ?? 0) : parseMoneyToCents(priceStr);
    if (price === null || price < 0) problems.push(`unit price "${priceStr}" is not a valid amount`);
    if (!paymentEnum.enumValues.includes(method)) problems.push(`payment method must be one of ${paymentEnum.enumValues.join(", ")}`);
    if (problems.length) {
      errors.push(`Row ${rowNo}: ${problems.join("; ")}.`);
      return;
    }
    const receipt = pick(r, "receipt", "receipt_no", "invoice");
    const key = receipt ? `${receipt}|${dateStr.slice(0, 10)}` : `row-${rowNo}`;
    const g = groups.get(key) ?? { soldAt, method, customer: pick(r, "customer", "customer_name"), items: [] };
    g.items.push({ productId: p!.id, quantity: qty, unitPriceCents: price! });
    groups.set(key, g);
  });
  if (errors.length) return { created: 0, updated: 0, errors: errors.slice(0, 50).concat(errors.length > 50 ? [`…and ${errors.length - 50} more`] : []) };

  try {
    await db.transaction(async (tx) => {
      for (const g of groups.values()) {
        await createSaleTx(tx, {
          items: g.items,
          paymentMethod: g.method,
          customerName: g.customer || null,
          soldAt: g.soldAt,
          userId: opts.userId,
          source: "import",
          affectStock: opts.affectStock,
          allowInactive: true,
          note: "Imported",
        });
      }
    });
  } catch (e) {
    if (e instanceof UserError) return { created: 0, updated: 0, errors: [e.message] };
    throw e;
  }
  return { created: groups.size, updated: 0, sales: groups.size, lines: rows.length, errors: [] };
}

/** Prevents spreadsheet formula injection from text typed into the app (e.g. a customer named "=HYPERLINK(...)"). */
function safeCell(v: unknown) {
  return typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  return Papa.unparse(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCell(v)]))));
}
