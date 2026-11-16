import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProductImportForm, SalesImportForm } from "./import-forms";

export const metadata = { title: "Import / export" };

export default async function ImportPage() {
  await requireUser("importExport");
  return (
    <div className="max-w-4xl">
      <PageHeader title="Import / export" subtitle="Bring in records from Excel or another system, or download your data. Save Excel sheets as CSV first (File → Save As → CSV UTF-8)." />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">1. Import products</h2>
          <p className="text-sm text-ink-2">
            Required columns: <code>name</code>, <code>sku</code>, <code>sell_price</code>. Optional: barcode, category, unit, cost_price, opening_stock, reorder_level, reorder_qty, lead_time_days, supplier.
            Rows with an SKU that already exists update that product (stock isn&apos;t changed).
          </p>
          <a className="text-sm text-accent-fg underline" href="/api/export/template-products">
            Download products template
          </a>
          <ProductImportForm />
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
          <SalesImportForm />
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
