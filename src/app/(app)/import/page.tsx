import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { batchOptions, EARLIER, EARLIER_LABEL } from "@/lib/batches";
import { getStockLevels } from "@/lib/inventory";
import { listOrigins } from "@/lib/profit";
import { PageHeader } from "@/components/ui";
import { ProductImportForm, SalesImportForm } from "./import-forms";

export const metadata = { title: "Import / export" };

export default async function ImportPage() {
  await requireUser("importExport");
  const db = await getDb();
  const [{ list, options }, levels, origins] = await Promise.all([batchOptions(db), getStockLevels(db, { includeInactive: true }), listOrigins(db)]);
  const suppliers = [...new Set([...levels.map((l) => l.supplier).filter((x): x is string => !!x), ...origins.map((o) => o.name)])].sort((a, b) => a.localeCompare(b));
  const n = list.length + 1;
  const ord = n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th";
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
          <ProductImportForm suppliers={suppliers} suggestedName={`${n}${ord} buy`} />
        </section>
        <section className="card space-y-3 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">2. Import past sales</h2>
          <p className="text-sm text-ink-2">
            Columns: <code>date</code> (2026-09-01 or 2026-09-01 14:30), <code>sku</code>, <code>quantity</code>. Optional: unit_price (defaults to the current price), payment_method, customer, receipt. Rows
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
