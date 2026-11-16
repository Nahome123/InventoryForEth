import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb, type DB } from "@/lib/db/client";
import { customerOrders, products, sales, stockMovements, users } from "@/lib/db/schema";
import { adjustStock, getStockLevels } from "@/lib/inventory";
import { createProduct, updateProduct } from "@/lib/products";
import { createSale, voidSale } from "@/lib/sales";
import { createOrder, fulfillOrder, setOrderStatus } from "@/lib/orders";
import { importProducts, importSales, parseLocalDateTime } from "@/lib/import";
import { getRestockReport } from "@/lib/analytics";

let db: DB;
let userId: number;

beforeEach(async () => {
  db = await createDb({ inMemory: true });
  const [u] = await db.insert(users).values({ username: "owner", fullName: "Owner", passwordHash: "x", role: "owner" }).returning();
  userId = u.id;
});

const pen = { name: "Pen", sku: "PEN-1", sellPrice: "0.50", costPrice: "0.20", reorderLevel: "5", openingStock: 20 };

describe("products", () => {
  it("creates a product with opening stock logged as a movement", async () => {
    const p = await createProduct(db, pen, userId);
    expect(p.stockOnHand).toBe(0); // returned before the movement
    const [row] = await db.select().from(products).where(eq(products.id, p.id));
    expect(row.stockOnHand).toBe(20);
    const moves = await db.select().from(stockMovements);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ type: "opening", quantity: 20, balanceAfter: 20 });
  });

  it("rejects duplicate SKUs case-insensitively and duplicate barcodes", async () => {
    await createProduct(db, { ...pen, barcode: "123" }, userId);
    await expect(createProduct(db, { ...pen, sku: "pen-1" }, userId)).rejects.toThrow(/already used/);
    await expect(createProduct(db, { ...pen, sku: "PEN-2", barcode: "123" }, userId)).rejects.toThrow(/Barcode/);
  });

  it("validates required fields", async () => {
    await expect(createProduct(db, { name: "", sku: "X", sellPrice: "" }, userId)).rejects.toThrow(/name is required.*Selling price is required/);
  });

  it("does not change stock on edit", async () => {
    const p = await createProduct(db, pen, userId);
    await updateProduct(db, p.id, { ...pen, name: "Blue pen", sellPrice: "0.60" });
    const [row] = await db.select().from(products).where(eq(products.id, p.id));
    expect(row).toMatchObject({ name: "Blue pen", sellPriceCents: 60, stockOnHand: 20 });
  });
});

describe("sales update inventory", () => {
  it("records a sale, deducts stock and logs it; void restores it", async () => {
    const p = await createProduct(db, pen, userId);
    const sale = await createSale(db, { items: [{ productId: p.id, quantity: 3 }, { productId: p.id, quantity: 2 }], discountCents: 10, userId });
    expect(sale).toMatchObject({ subtotalCents: 250, discountCents: 10, totalCents: 240 });
    let [row] = await db.select().from(products).where(eq(products.id, p.id));
    expect(row.stockOnHand).toBe(15);

    await voidSale(db, sale.id, userId, "Customer changed mind");
    [row] = await db.select().from(products).where(eq(products.id, p.id));
    expect(row.stockOnHand).toBe(20);
    const [s] = await db.select().from(sales).where(eq(sales.id, sale.id));
    expect(s.status).toBe("voided");
    await expect(voidSale(db, sale.id, userId, "again")).rejects.toThrow(/already voided/);
  });

  it("refuses to sell more than on hand and leaves nothing behind", async () => {
    const p = await createProduct(db, pen, userId);
    await expect(createSale(db, { items: [{ productId: p.id, quantity: 21 }], userId })).rejects.toThrow(/Not enough stock/);
    expect(await db.select().from(sales)).toHaveLength(0);
  });

  it("rejects a discount larger than the subtotal", async () => {
    const p = await createProduct(db, pen, userId);
    await expect(createSale(db, { items: [{ productId: p.id, quantity: 1 }], discountCents: 100, userId })).rejects.toThrow(/Discount/);
  });
});

describe("stock adjustments", () => {
  it("handles receipts, damage and physical counts", async () => {
    const p = await createProduct(db, pen, userId);
    expect(await adjustStock(db, { productId: p.id, kind: "receipt", quantity: 10, userId })).toBe(30);
    expect(await adjustStock(db, { productId: p.id, kind: "damage", quantity: 2, userId })).toBe(28);
    expect(await adjustStock(db, { productId: p.id, kind: "count", quantity: 25, userId })).toBe(25);
    await expect(adjustStock(db, { productId: p.id, kind: "damage", quantity: 26, userId })).rejects.toThrow(/Not enough/);
    const moves = await db.select().from(stockMovements).where(eq(stockMovements.productId, p.id));
    expect(moves.map((m) => m.quantity)).toEqual([20, 10, -2, -3]);
  });
});

describe("customer orders", () => {
  it("commits stock, then fulfilling records a sale at order prices", async () => {
    const p = await createProduct(db, pen, userId);
    const order = await createOrder(db, { customerName: "Abebe", items: [{ productId: p.id, quantity: 25 }], depositCents: 100, userId });
    let [lvl] = await getStockLevels(db);
    expect(lvl).toMatchObject({ onHand: 20, committed: 25, available: -5, status: "out" });

    await expect(fulfillOrder(db, order.id, { userId })).rejects.toThrow(/Not enough stock/);
    await adjustStock(db, { productId: p.id, kind: "receipt", quantity: 10, userId });
    await updateProduct(db, p.id, { ...pen, sellPrice: "9.99" }); // price change after ordering
    const sale = await fulfillOrder(db, order.id, { userId });
    expect(sale.totalCents).toBe(25 * 50);
    [lvl] = await getStockLevels(db);
    expect(lvl).toMatchObject({ onHand: 5, committed: 0, available: 5 });
    const [o] = await db.select().from(customerOrders).where(eq(customerOrders.id, order.id));
    expect(o).toMatchObject({ status: "fulfilled", fulfilledSaleId: sale.id });

    await voidSale(db, sale.id, userId, "returned");
    const [o2] = await db.select().from(customerOrders).where(eq(customerOrders.id, order.id));
    expect(o2.status).toBe("ready");
  });

  it("enforces status transitions", async () => {
    const p = await createProduct(db, pen, userId);
    const order = await createOrder(db, { customerName: "A", items: [{ productId: p.id, quantity: 1 }], userId });
    await setOrderStatus(db, order.id, "cancelled");
    await expect(fulfillOrder(db, order.id, { userId })).rejects.toThrow(/cancelled/);
    await setOrderStatus(db, order.id, "pending");
    await setOrderStatus(db, order.id, "ready");
  });
});

describe("imports", () => {
  it("imports products, then historical sales without touching stock", async () => {
    const r = await importProducts(
      db,
      "Name,SKU,Category,Sell Price,Opening Stock\nPen,PEN-1,Stationery,0.50,40\nBook,BK-1,Stationery,2.00,5\n",
      userId,
    );
    expect(r).toEqual({ created: 2, updated: 0, errors: [] });
    const again = await importProducts(db, "name,sku,sell_price\nPen v2,pen-1,0.55\n", userId);
    expect(again.updated).toBe(1);

    const s = await importSales(db, "date,receipt,sku,quantity,unit_price\n2026-01-05 10:00,R1,PEN-1,2,0.50\n2026-01-05,R1,BK-1,1,\n2026-01-06,,PEN-1,1,\n", {
      userId,
      timeZone: "Africa/Addis_Ababa",
      affectStock: false,
    });
    expect(s).toMatchObject({ sales: 2, errors: [] });
    const all = await db.select().from(sales);
    expect(all.map((x) => x.totalCents).sort((a, b) => a - b)).toEqual([55, 300]);
    const [pen1] = await db.select().from(products).where(eq(products.sku, "PEN-1"));
    expect(pen1.stockOnHand).toBe(40);
  });

  it("reports row errors and imports nothing", async () => {
    const r = await importProducts(db, "name,sku,sell_price\nPen,PEN-1,0.5\n,X,1\nDup,pen-1,1\n", userId);
    expect(r.created).toBe(0);
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toMatch(/^Row 3:/);
    expect(await db.select().from(products)).toHaveLength(0);
    const s = await importSales(db, "date,sku,quantity\n01/05/2026,NOPE,0\n", { userId, timeZone: "UTC", affectStock: false });
    expect(s.errors[0]).toMatch(/Row 2: date .*; no product.*; quantity/);
  });

  it("parses local times in the store time zone", () => {
    expect(parseLocalDateTime("2026-01-05 10:00", "Africa/Addis_Ababa")!.toISOString()).toBe("2026-01-05T07:00:00.000Z");
    expect(parseLocalDateTime("2026-07-01 10:00", "America/Chicago")!.toISOString()).toBe("2026-07-01T15:00:00.000Z");
    expect(parseLocalDateTime("2026-02-30", "UTC")).toBeNull();
  });
});

describe("restock report", () => {
  it("forecasts from recent sales and suggests a reorder", async () => {
    const p = await createProduct(db, { ...pen, openingStock: 500, leadTimeDays: "7" }, userId);
    // Backdate the product and sell 5/day for 8 weeks.
    await db.update(products).set({ createdAt: new Date(Date.now() - 70 * 86_400_000) }).where(eq(products.id, p.id));
    for (let d = 1; d <= 56; d++) {
      await createSale(db, { items: [{ productId: p.id, quantity: 5 }], userId, soldAt: new Date(Date.now() - d * 86_400_000) });
    }
    await adjustStock(db, { productId: p.id, kind: "count", quantity: 40, userId });
    const { rows } = await getRestockReport(db);
    const r = rows[0];
    expect(r.forecast.enoughHistory).toBe(true);
    expect(r.forecast.avgDailyDemand).toBeGreaterThan(4);
    expect(r.forecast.avgDailyDemand).toBeLessThan(5.1);
    expect(r.forecast.urgency).not.toBe("ok");
    expect(r.forecast.suggestedOrderQty).toBeGreaterThan(100);
    expect(r.abc).toBe("A");
  });
});
