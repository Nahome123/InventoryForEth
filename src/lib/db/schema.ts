import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  date,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userRole = pgEnum("user_role", ["owner", "manager", "cashier"]);
export const movementType = pgEnum("movement_type", [
  "opening", // initial stock when a product is created / imported
  "receipt", // stock received from a supplier
  "sale", // sold (negative)
  "sale_void", // a voided sale returns stock (positive)
  "return", // customer return (positive)
  "adjustment", // stock count correction (+/-)
  "damage", // damaged / lost / expired (negative)
]);
export const paymentMethod = pgEnum("payment_method", ["cash", "card", "mobile_money", "bank_transfer", "credit", "other"]);
export const saleStatus = pgEnum("sale_status", ["completed", "voided"]);
export const saleSource = pgEnum("sale_source", ["pos", "order", "import"]);
export const orderStatus = pgEnum("order_status", ["pending", "ready", "fulfilled", "cancelled"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  storeName: text("store_name").notNull().default("My Store"),
  currency: text("currency").notNull().default("USD"),
  timezone: text("timezone").notNull().default("UTC"),
  /** Days between placing a supplier order and receiving it, used when a product has no lead time. */
  defaultLeadTimeDays: integer("default_lead_time_days").notNull().default(7),
  /** Days of stock a restock should cover beyond the lead time. */
  coverDays: integer("cover_days").notNull().default(30),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  fullName: text("full_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull().default("cashier"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    description: text("description"),
    unit: text("unit").notNull().default("pcs"),
    costPriceCents: integer("cost_price_cents").notNull().default(0),
    sellPriceCents: integer("sell_price_cents").notNull(),
    reorderLevel: integer("reorder_level").notNull().default(0),
    reorderQty: integer("reorder_qty").notNull().default(0),
    leadTimeDays: integer("lead_time_days"),
    supplier: text("supplier"),
    /** Cached balance. Only ever changed together with a stock_movements row (see lib/inventory.ts). */
    stockOnHand: integer("stock_on_hand").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_sku_lower_idx").on(sql`lower(${t.sku})`),
    uniqueIndex("products_barcode_idx").on(t.barcode),
    index("products_name_idx").on(t.name),
    check("products_stock_non_negative", sql`${t.stockOnHand} >= 0`),
    check("products_prices_non_negative", sql`${t.sellPriceCents} >= 0 and ${t.costPriceCents} >= 0`),
  ],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    type: movementType("type").notNull(),
    /** Signed change in units. */
    quantity: integer("quantity").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    saleId: integer("sale_id").references(() => sales.id, { onDelete: "restrict" }),
    note: text("note"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("stock_movements_product_idx").on(t.productId, t.createdAt), check("stock_movements_nonzero", sql`${t.quantity} <> 0`)],
);

export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    soldAt: timestamp("sold_at", { withTimezone: true }).notNull().defaultNow(),
    customerName: text("customer_name"),
    paymentMethod: paymentMethod("payment_method").notNull().default("cash"),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    status: saleStatus("status").notNull().default("completed"),
    source: saleSource("source").notNull().default("pos"),
    orderId: integer("order_id"),
    note: text("note"),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: integer("voided_by").references(() => users.id, { onDelete: "set null" }),
    voidReason: text("void_reason"),
    createdAt: createdAt(),
  },
  (t) => [index("sales_sold_at_idx").on(t.soldAt), check("sales_discount_valid", sql`${t.discountCents} >= 0 and ${t.discountCents} <= ${t.subtotalCents}`)],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    unitCostCents: integer("unit_cost_cents").notNull().default(0),
    lineTotalCents: integer("line_total_cents").notNull(),
  },
  (t) => [index("sale_items_sale_idx").on(t.saleId), index("sale_items_product_idx").on(t.productId), check("sale_items_qty_positive", sql`${t.quantity} > 0`)],
);

export const customerOrders = pgTable(
  "customer_orders",
  {
    id: serial("id").primaryKey(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    dueDate: date("due_date"),
    status: orderStatus("status").notNull().default("pending"),
    depositCents: integer("deposit_cents").notNull().default(0),
    note: text("note"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    fulfilledSaleId: integer("fulfilled_sale_id").references(() => sales.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customer_orders_status_idx").on(t.status, t.dueDate)],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => customerOrders.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_product_idx").on(t.productId), check("order_items_qty_positive", sql`${t.quantity} > 0`)],
);

export type Role = (typeof userRole.enumValues)[number];
export type MovementType = (typeof movementType.enumValues)[number];
export type PaymentMethod = (typeof paymentMethod.enumValues)[number];
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type Product = typeof products.$inferSelect;
export type User = typeof users.$inferSelect;
