# Family Retail ERP

A lightweight ERP for a small, family-run general merchandise shop: **inventory**, **sales history and customer orders**, and **explainable demand analytics** in one web app. It works on desktop, tablet and phone.

## Quick start

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm build && pnpm start      # or: pnpm dev
```

Open http://localhost:3000. On the first visit you create the store (name, currency, time zone) and the owner account.

To try it with demo data instead, run `pnpm db:seed` **before** starting the server. That creates 28 products, 10 weeks of sales and 2 customer orders. Sign in as `owner` / `demo-password` or `cashier` / `demo-password`.

### Database

| Setting | Behavior |
|---|---|
| `DATABASE_URL` empty (default) | Embedded Postgres ([PGlite](https://pglite.dev)) stored in `./data/pglite`. No server or Docker needed. Only **one process** can open it at a time, so stop the app before running `pnpm db:seed`. |
| `DATABASE_URL=postgres://…` | Any Postgres 14+ (Supabase, Neon, RDS, a local install). Use this when more than one device must reach the app from a server. |

Migrations in `drizzle/` run automatically at startup. After changing `src/lib/db/schema.ts`, run `pnpm db:generate` to add a migration.

**Backups (embedded mode):** stop the app and copy the `data/` folder. Don't keep `data/` inside a OneDrive or Dropbox folder that syncs while the app is running.

### Using it on phones and tablets in the shop

Run the app on one computer in the shop. Other devices on the same Wi-Fi open `http://<that-computer's-IP>:3000`. A USB or Bluetooth barcode scanner works in every product search box: it types the code and presses Enter. For access from outside the shop, deploy to a host with HTTPS and use `DATABASE_URL`.

## What's in it (PRD mapping)

| PRD area | Where |
|---|---|
| **A. Inventory**: product catalog (ID, name, SKU, barcode, category, unit, cost and selling price, reorder level and quantity, supplier, lead time) and deactivation | `/products`, `src/lib/products.ts` |
| Stock levels: on hand, reserved by customer orders, available | `/inventory`, `src/lib/inventory.ts` |
| Every stock change logged (KPI: 100% traceability). The ledger can't be edited; stock never goes below 0 | `stock_movements` table, `applyMovement()`; `/inventory/movements` |
| Receive deliveries, stock counts, damage and returns | `/inventory/receive`, product page → *Change stock* |
| **B. Sales**: point of sale with barcode scanning, discount, payment methods and change due | `/sales/new`, `src/lib/sales.ts` |
| A sale automatically deducts inventory (one transaction) | `createSaleTx()` |
| Sales history with filters (date, product, payment, staff, status, source, customer or sale #), totals, CSV export | `/sales`, `src/lib/sales-query.ts` |
| Void a sale with a reason; stock goes back to the shelf | `/sales/[id]`, `voidSale()` |
| **Future sales**: customer orders with due date, deposit, status (pending → ready → fulfilled / cancelled); stock is reserved; fulfilling records the sale at the agreed price | `/orders`, `src/lib/orders.ts` |
| **C. Demand analytics**: restock list, demand ranking (ABC), trends, slow movers, plain-language "why" for each suggestion | `/analytics`, `src/lib/forecast.ts`, `src/lib/analytics.ts` |
| Dashboard: today, 7 days, 30-day gross profit, daily sales chart, top sellers, restock alerts, upcoming orders | `/` |
| **Historical data migration**: CSV import of products and past sales, all-or-nothing with row-level errors; templates | `/import`, `src/lib/import.ts` |
| Roles: Owner, Manager, Sales staff | `src/lib/permissions.ts`, `/settings` |

### The forecast, in plain words

The forecast uses a weighted average of the last 8 weeks of sales, with recent weeks counting more.

- **Reorder point** = expected sales during the supplier lead time, plus a safety buffer of half the lead time.
- When **available** stock (on hand minus reserved) reaches the reorder point, the app suggests enough to cover the lead time plus the "cover days" setting (default 30). The suggestion is never less than the product's usual reorder quantity, or than what customers have already ordered.
- A product needs at least 14 days of history and sales on 3 or more days before it gets a forecast. Until then, its reorder level is used.

All of this is in `src/lib/forecast.ts`, and the analytics page explains it to users.

## Decisions and assumptions

The PRD text we received ends partway through section A1 (product attributes). Everything after that was filled in with standard small-retail ERP practice:

- **Money** is stored as integer cents, with one currency per store (set at setup).
- **Imported historical sales don't change current stock by default**, because the stock count was normally taken after those sales happened. A checkbox on the import page changes this.
- **Sales can't exceed stock on hand.** Selling into stock reserved for customer orders is allowed but shows a warning. Customer orders *may* exceed stock; the shortfall becomes a restock suggestion.
- **Deposits** on customer orders are recorded for information. The full order total is counted as revenue when the order is fulfilled.
- **Product edits never change stock.** Stock only moves through logged movements.
- Sales staff don't see cost prices, profit, analytics, imports or settings.
- Sale and order numbers come from database sequences. After an unclean shutdown the next number can jump (for example S-000033 to S-000065). That is normal Postgres behavior; no records are lost.

Out of scope for v1, as the PRD states: multiple branches, warehouses, accounting, and purchase-order workflows. Other not-yet-built items worth considering: supplier records, partial refunds and returns per line, customer credit balances, receipt printers, and offline mode.

## Development

```bash
pnpm test        # 24 unit and integration tests (in-memory Postgres)
pnpm typecheck
```

Project layout:

```
src/lib/        business logic (framework-free, tested): inventory, sales, orders, forecast, import
src/lib/db/     schema and connection (PGlite or node-postgres)
src/app/(app)/  pages and server actions, grouped by module
src/components/ shared UI (cart/scanner picker, chart, form helpers)
drizzle/        SQL migrations
tests/          vitest suites
```
