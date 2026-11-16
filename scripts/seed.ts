/**
 * Fills an EMPTY database with a demo store: products, 10 weeks of sales, and a few customer orders.
 *   pnpm db:seed            (stop `pnpm dev` first: the embedded database allows one process at a time)
 * Sign in afterwards as  owner / demo-password
 */
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { createDb } from "../src/lib/db/client";
import { products, settings, users } from "../src/lib/db/schema";
import { createProduct } from "../src/lib/products";
import { createSale } from "../src/lib/sales";
import { createOrder, setOrderStatus } from "../src/lib/orders";
import { adjustStock } from "../src/lib/inventory";

const CATALOG: [string, string, string, number, number, number][] = [
  // name, sku, category, cost, price, avg daily demand
  ["Bic Pen Blue", "PEN-BLU", "Stationery", 0.2, 0.5, 6],
  ["Exercise Book 50pg", "BOOK-50", "Stationery", 0.6, 1.2, 4],
  ["Pencil HB (pack of 10)", "PENCIL-10", "Stationery", 1.0, 2.0, 1.2],
  ["A4 Paper Ream", "A4-REAM", "Stationery", 4.0, 6.5, 0.6],
  ["Laundry Soap Bar", "SOAP-LAUN", "Household", 0.4, 0.8, 5],
  ["Dish Liquid 750ml", "DISH-750", "Household", 1.5, 2.5, 1.5],
  ["Bleach 1L", "BLEACH-1L", "Household", 1.2, 2.0, 0.8],
  ["Matches (box of 10)", "MATCH-10", "Household", 0.3, 0.6, 2],
  ["Candles (pack of 6)", "CANDLE-6", "Household", 1.0, 1.8, 0.3],
  ["Toothpaste 100g", "TP-100", "Personal care", 1.1, 2.0, 2],
  ["Toothbrush", "TB-1", "Personal care", 0.5, 1.0, 1],
  ["Body Lotion 400ml", "LOTION-400", "Personal care", 2.5, 4.0, 0.7],
  ["Bath Soap", "SOAP-BATH", "Personal care", 0.5, 1.0, 3],
  ["Cooking Oil 1L", "OIL-1L", "Food", 2.2, 3.0, 3],
  ["Sugar 1kg", "SUGAR-1KG", "Food", 1.1, 1.5, 4],
  ["Rice 5kg", "RICE-5KG", "Food", 5.0, 7.0, 1],
  ["Pasta 500g", "PASTA-500", "Food", 0.6, 1.0, 2.5],
  ["Tea Leaves 250g", "TEA-250", "Food", 1.0, 1.7, 1.5],
  ["Biscuits", "BISC-1", "Food", 0.3, 0.6, 5],
  ["Bottled Water 1.5L", "WATER-15", "Drinks", 0.3, 0.6, 8],
  ["Soda 330ml", "SODA-330", "Drinks", 0.35, 0.7, 6],
  ["AA Batteries (4)", "BAT-AA4", "Electrical", 1.2, 2.2, 0.8],
  ["LED Bulb 9W", "BULB-9W", "Electrical", 1.0, 2.0, 0.5],
  ["Extension Cord 3m", "EXT-3M", "Electrical", 3.5, 6.0, 0.15],
  ["Phone Charger USB-C", "CHG-USBC", "Electrical", 2.0, 4.0, 0.4],
  ["Plastic Bucket 10L", "BUCKET-10", "Household", 1.5, 3.0, 0.2],
  ["Umbrella", "UMBR-1", "Seasonal", 3.0, 6.0, 0],
  ["School Bag", "BAG-SCH", "Seasonal", 6.0, 10.0, 0.25],
];

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function poisson(lambda: number, r: () => number) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L);
  return k - 1;
}

async function main() {
  const db = await createDb({ databaseUrl: process.env.DATABASE_URL, pgliteDir: process.env.PGLITE_DIR || "./data/pglite" });
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(products);
  if (Number(n) > 0) {
    console.log("Database already has products; not seeding.");
    process.exit(0);
  }
  await db.update(settings).set({ storeName: "Demo Family Store", currency: "USD", timezone: "UTC" }).where(eq(settings.id, 1));
  let [owner] = await db.select().from(users).where(eq(users.role, "owner")).limit(1);
  if (!owner) {
    [owner] = await db.insert(users).values({ username: "owner", fullName: "Demo Owner", passwordHash: await bcrypt.hash("demo-password", 10), role: "owner" }).returning();
    await db.insert(users).values({ username: "cashier", fullName: "Demo Cashier", passwordHash: await bcrypt.hash("demo-password", 10), role: "cashier" });
  }

  const r = rand(42);
  const DAYS = 70;
  const created: { id: number; rate: number; price: number }[] = [];
  for (const [name, sku, category, cost, price, rate] of CATALOG) {
    const p = await createProduct(
      db,
      {
        name,
        sku,
        category,
        costPrice: cost.toFixed(2),
        sellPrice: price.toFixed(2),
        reorderLevel: String(Math.ceil(rate * 5)),
        reorderQty: String(Math.max(6, Math.ceil(rate * 14))),
        supplier: category === "Food" || category === "Drinks" ? "City Wholesale" : "Main Distributor",
        openingStock: Math.ceil(rate * DAYS * 1.8) + 10,
      },
      owner.id,
    );
    created.push({ id: p.id, rate, price });
  }
  await db.update(products).set({ createdAt: new Date(Date.now() - (DAYS + 1) * 86_400_000) });

  console.log(`Created ${created.length} products. Generating ${DAYS} days of sales…`);
  const methods = ["cash", "cash", "cash", "mobile_money", "mobile_money", "card"] as const;
  for (let d = DAYS; d >= 1; d--) {
    const day = new Date(Date.now() - d * 86_400_000);
    const weekend = day.getUTCDay() === 6 ? 1.4 : day.getUTCDay() === 0 ? 0.6 : 1;
    // Demand rises for drinks recently, and falls for stationery.
    const per = created.map((c, i) => {
      const cat = CATALOG[i][2];
      const trend = cat === "Drinks" ? (d < 28 ? 1.5 : 1) : cat === "Stationery" ? (d < 28 ? 0.7 : 1) : 1;
      return { ...c, qty: poisson(c.rate * weekend * trend, r) };
    });
    // Split the day's demand into a handful of baskets.
    const baskets = Math.max(1, Math.round(6 * weekend));
    for (let b = 0; b < baskets; b++) {
      const items = per
        .map((p) => ({ productId: p.id, quantity: Math.floor(p.qty / baskets) + (b < p.qty % baskets ? 1 : 0) }))
        .filter((i) => i.quantity > 0);
      if (!items.length) continue;
      const when = new Date(day);
      when.setUTCHours(8 + Math.floor(r() * 11), Math.floor(r() * 60));
      await createSale(db, { items, userId: owner.id, paymentMethod: methods[Math.floor(r() * methods.length)], soldAt: when });
    }
  }
  // A couple of low-stock situations and open orders.
  // Physical count: a few items are running low, so the restock list has something to show.
  const counts: [number, number][] = [
    [19, 12], // Bottled water
    [14, 20], // Sugar
    [4, 9], // Laundry soap
    [20, 30], // Soda
    [9, 6], // Toothpaste
    [22, 0], // LED bulb, sold out
  ];
  for (const [i, qty] of counts) await adjustStock(db, { productId: created[i].id, kind: "count", quantity: qty, userId: owner.id, note: "Stock count" });
  const o1 = await createOrder(db, {
    customerName: "St. Mary School",
    customerPhone: "+251 911 000 000",
    dueDate: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
    depositCents: 2000,
    items: [
      { productId: created[1].id, quantity: 60 },
      { productId: created[0].id, quantity: 100 },
    ],
    userId: owner.id,
  });
  await setOrderStatus(db, o1.id, "ready");
  await createOrder(db, { customerName: "Hanna", items: [{ productId: created[15].id, quantity: 4 }], userId: owner.id, dueDate: new Date(Date.now() + 6 * 86_400_000).toISOString().slice(0, 10) });
  console.log("Done. Sign in as  owner / demo-password  (or cashier / demo-password).");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
