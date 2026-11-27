import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { batchOptions, EARLIER, EARLIER_LABEL, earlierStockSummary, listBatchDetails } from "@/lib/batches";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/analytics";
import { formatDate } from "@/lib/format";
import { BatchRow, EarlierStockRow } from "./batch-manager";
import { getStockLevels } from "@/lib/inventory";
import { listOrigins } from "@/lib/profit";
import { PageHeader } from "@/components/ui";
import { ProductImportForm, SalesImportForm } from "./import-forms";

export const metadata = { title: "Import / export" };

export default async function ImportPage() {
  const user = await requireUser("importExport");
  const db = await getDb();
  const [{ list, options }, levels, origins, details, settings, earlier] = await Promise.all([
    batchOptions(db),
    getStockLevels(db, { includeInactive: true }),
    listOrigins(db),
    listBatchDetails(db),
    getSettings(db),
    earlierStockSummary(db),
  ]);
  const suppliers = [...new Set([...levels.map((l) => l.supplier).filter((x): x is string => !!x), ...origins.map((o) => o.name)])].sort((a, b) => a.localeCompare(b));
  // Batches newest first; "Earlier stock" is always offered for products imported before batches existed.
  const saleBatches = options.some((o) => o.value === EARLIER) ? options : [...options, { value: EARLIER, label: EARLIER_LABEL }];
  return (
    <div className="max-w-4xl">
      <PageHeader title="Import / export" subtitle="Bring in records from Excel or another system, or download your data. Save Excel sheets as CSV first (File → Save As → CSV UTF-8)." />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">1. Import products</h2>
          <p className="text-sm text-ink-2">
            Just use your purchase sheet: <code>Product</code>, <code>SKU</code>, <code>Stock Qty</code>, <code>item cost</code> (or <code>TOTAL IN BIRR</code>, and the unit cost is worked out). Only
            Product and SKU are required; no selling price is needed. Title rows, blank rows and a TOTAL row are skipped. Each import can be its own <strong>batch</strong> (one
            shipment from one supplier), kept separate from earlier stock.
          </p>
          <a className="text-sm text-accent-fg underline" href="/api/export/template-products">
            Download products template
          </a>
          <ProductImportForm suppliers={suppliers} suggestedName="e.g. AMR" batches={list.map((b) => ({ value: String(b.id), label: `${b.name} (${b.products})` }))} />
        </section>
        <section className="card space-y-3 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">2. Import past sales</h2>
          <p className="text-sm text-ink-2">
            Columns: <code>product</code> and/or <code>sku</code> (matched by part number, or by name if the part number is blank), <code>quantity</code>, <code>unit_price</code>. Optional: date (2026-09-01 or 2026-09-01 14:30, blank if unknown), customer, payment_method, receipt. Rows
            sharing a receipt number on the same day become one sale. Past sales feed the demand forecast.
          </p>
          <a className="text-sm text-accent-fg underline" href="/api/export/template-sales">
            Download sales template
          </a>
          <SalesImportForm batches={saleBatches} />
        </section>
      </div>
      <p className="mt-3 text-xs text-ink-3">Imports are all-or-nothing: if any row has a problem, nothing is saved and you&apos;ll see the row numbers to fix.</p>

      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Imported batches</h2>
        <p className="mt-1 text-sm text-ink-2">Rename any import, including your earlier stock, at any time. The name is also its supplier. Deleting a batch removes everything that import brought in.</p>
        {details.length === 0 && earlier.products === 0 ? (
          <p className="mt-3 text-sm text-ink-3">No batches yet. Import products as a new batch above.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {earlier.products > 0 && <EarlierStockRow products={earlier.products} units={earlier.units} />}
            {details.map((b) => (
              <BatchRow
                key={b.id}
                canDelete={can(user.role, "manageSettings")}
                b={{ id: b.id, name: b.name, supplier: b.supplier, created: formatDate(b.createdAt, settings.timezone), products: b.products, units: b.units, sales: b.sales, mixedSales: b.mixedSales, orders: b.orders }}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="mb-3 text-lg font-semibold">Export</h2>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary" href="/api/export/products">
            Products & stock
          </a>
          <a className="btn-secondary" href="/api/export/sales">
            Sales (one row per sale)
          </a>
          <a className="btn-secondary" href="/api/export/sale-items">
            Sales line items
          </a>
          <a className="btn-secondary" href="/api/export/movements">
            Stock history
          </a>
          <a className="btn-secondary" href="/api/export/restock">
            Restock suggestions
          </a>
        </div>
      </section>
    </div>
  );
}
