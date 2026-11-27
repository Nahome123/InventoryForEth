import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { Executor, Tx } from "./db/client";
import { batches, categories, customerOrders, orderItems, products, saleItems, stockMovements } from "./db/schema";
import { UserError } from "./errors";
import { applyMovement } from "./inventory";
import { parseMoneyToCents } from "./money";

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

const money = (label: string, required: boolean) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((v, ctx) => {
      if (v === undefined || v === null || String(v).trim() === "") {
        if (required) ctx.addIssue({ code: "custom", message: `${label} is required.` });
        return 0;
      }
      const c = parseMoneyToCents(v);
      if (c === null || c < 0) {
        ctx.addIssue({ code: "custom", message: `${label} must be a valid amount.` });
        return 0;
      }
      return c;
    });

const wholeNumber = (label: string) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .transform((v, ctx) => {
      if (v === undefined || v === null || String(v).trim() === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number of 0 or more.` });
        return null;
      }
      return n;
    });

export const productInput = z.object({
  name: z.string().trim().min(1, "Product name is required.").max(200),
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required.")
    .max(64)
    .regex(/^[A-Za-z0-9._\-/]+$/, "SKU may only contain letters, numbers, and . _ - /"),
  barcode: optionalText,
  category: optionalText,
  description: optionalText,
  unit: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || "pcs"),
  costPrice: money("Cost price", false),
  sellPrice: money("Selling price", true),
  reorderLevel: wholeNumber("Reorder level"),
  reorderQty: wholeNumber("Reorder quantity"),
  leadTimeDays: wholeNumber("Lead time"),
  supplier: optionalText,
});

export type ProductInput = z.input<typeof productInput>;

export function parseProductInput(raw: ProductInput) {
  const r = productInput.safeParse(raw);
  if (!r.success) throw new UserError(r.error.issues.map((i) => i.message).join(" "));
  return r.data;
}

export async function findOrCreateCategory(tx: Executor, name: string | null): Promise<number | null> {
  if (!name) return null;
  const [existing] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(sql`lower(${categories.name}) = lower(${name})`);
  if (existing) return existing.id;
  const [created] = await tx.insert(categories).values({ name }).onConflictDoNothing().returning({ id: categories.id });
  if (created) return created.id;
  const [again] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.name, name));
  return again?.id ?? null;
}

/** SKU and barcode must be unique within a batch (the same part can exist in different import batches). */
async function assertUnique(tx: Executor, sku: string, barcode: string | null, exceptId?: number, batchId: number | null = null) {
  const sameBatch = sql`coalesce(${products.batchId}, 0) = ${batchId ?? 0}`;
  const skuClash = await tx
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(and(sql`lower(${products.sku}) = lower(${sku})`, sameBatch, exceptId ? ne(products.id, exceptId) : undefined));
  if (skuClash.length) throw new UserError(`SKU "${sku}" is already used by "${skuClash[0].name}".`);
  if (barcode) {
    const bcClash = await tx
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.barcode, barcode), sameBatch, exceptId ? ne(products.id, exceptId) : undefined));
    if (bcClash.length) throw new UserError(`Barcode "${barcode}" is already used by "${bcClash[0].name}".`);
  }
}

export async function createProductTx(tx: Tx, raw: ProductInput & { openingStock?: number | string | null }, userId: number | null, batchId: number | null = null) {
  const data = parseProductInput(raw);
  const opening = raw.openingStock === undefined || raw.openingStock === null || String(raw.openingStock).trim() === "" ? 0 : Number(raw.openingStock);
  if (!Number.isInteger(opening) || opening < 0) throw new UserError("Opening stock must be a whole number of 0 or more.");
  await assertUnique(tx, data.sku, data.barcode, undefined, batchId);
  const categoryId = await findOrCreateCategory(tx, data.category);
  const [p] = await tx
    .insert(products)
    .values({
      name: data.name,
      sku: data.sku,
      barcode: data.barcode,
      categoryId,
      description: data.description,
      unit: data.unit,
      costPriceCents: data.costPrice,
      sellPriceCents: data.sellPrice,
      reorderLevel: data.reorderLevel ?? 0,
      reorderQty: data.reorderQty ?? 0,
      leadTimeDays: data.leadTimeDays,
      supplier: data.supplier,
      batchId,
    })
    .returning();
  if (opening > 0) await applyMovement(tx, { productId: p.id, type: "opening", quantity: opening, userId, note: "Opening stock" });
  return p;
}

export async function createProduct(db: Executor, raw: ProductInput & { openingStock?: number | string | null }, userId: number | null, batchId: number | null = null) {
  return db.transaction(async (tx) => {
    if (batchId !== null) {
      const [b] = await tx.select({ supplier: batches.supplier }).from(batches).where(eq(batches.id, batchId));
      if (!b) throw new UserError("That batch no longer exists.");
      // A batch's products carry its supplier name.
      if (!raw.supplier?.trim()) raw = { ...raw, supplier: b.supplier ?? "" };
    }
    return createProductTx(tx, raw, userId, batchId);
  });
}

/** Updates catalog details. Stock is NOT editable here; it only changes through movements. */
export async function updateProduct(db: Executor, id: number, raw: ProductInput) {
  const data = parseProductInput(raw);
  return db.transaction(async (tx) => {
    const [cur] = await tx.select({ batchId: products.batchId }).from(products).where(eq(products.id, id));
    if (!cur) throw new UserError("Product not found.");
    await assertUnique(tx, data.sku, data.barcode, id, cur.batchId);
    const categoryId = await findOrCreateCategory(tx, data.category);
    const [p] = await tx
      .update(products)
      .set({
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        categoryId,
        description: data.description,
        unit: data.unit,
        costPriceCents: data.costPrice,
        sellPriceCents: data.sellPrice,
        reorderLevel: data.reorderLevel ?? 0,
        reorderQty: data.reorderQty ?? 0,
        leadTimeDays: data.leadTimeDays,
        supplier: data.supplier,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();
    if (!p) throw new UserError("Product not found.");
    return p;
  });
}

/**
 * Permanently deletes a product and its stock history. Refused when it appears on any sale or
 * customer order (deactivate it instead), so recorded sales are never changed.
 */
export async function deleteProduct(db: Executor, id: number) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select({ name: products.name }).from(products).where(eq(products.id, id)).for("update");
    if (!p) throw new UserError("Product not found.");
    const [s] = await tx.select({ n: sql<number>`count(*)::int` }).from(saleItems).where(eq(saleItems.productId, id));
    const [o] = await tx.select({ n: sql<number>`count(*)::int` }).from(orderItems).innerJoin(customerOrders, eq(customerOrders.id, orderItems.orderId)).where(eq(orderItems.productId, id));
    if (Number(s.n) > 0 || Number(o.n) > 0)
      throw new UserError(
        `“${p.name}” is on ${Number(s.n)} sale${Number(s.n) === 1 ? "" : "s"} and ${Number(o.n)} customer order${Number(o.n) === 1 ? "" : "s"}, so it can't be deleted. Deactivate it instead, or reduce its stock with Adjust stock.`,
      );
    await tx.delete(stockMovements).where(eq(stockMovements.productId, id));
    await tx.delete(products).where(eq(products.id, id));
    return p.name;
  });
}

export async function setProductActive(db: Executor, id: number, active: boolean) {
  await db.update(products).set({ active, updatedAt: new Date() }).where(eq(products.id, id));
}
