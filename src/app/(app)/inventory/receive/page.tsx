import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/analytics";
import { getPickProducts } from "@/lib/pick-products";
import { getStockLevels } from "@/lib/inventory";
import { listOrigins } from "@/lib/profit";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { ReceiveForm } from "./receive-form";

export const metadata = { title: "Receive delivery" };

export default async function ReceivePage({ searchParams }: { searchParams: Promise<{ supplier?: string; new?: string }> }) {
  const user = await requireUser("adjustStock");
  const sp = await searchParams;
  const db = await getDb();
  const [products, s, levels, origins] = await Promise.all([getPickProducts(db), getSettings(db), getStockLevels(db), listOrigins(db)]);
  const suppliers = [...new Set([...levels.map((l) => l.supplier).filter((x): x is string => !!x), ...origins.map((o) => o.name)])].sort((a, b) => a.localeCompare(b));
  const supplier = (sp.supplier ?? "").trim();
  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow={sp.new ? "New supplier" : undefined}
        title={supplier ? `Add stock · ${supplier}` : "Receive delivery"}
        subtitle="Add everything that arrived from a supplier. Stock goes up as soon as you save."
        actions={
          <>
            {can(user.role, "manageProducts") && (
              <Link href={`/products/new${supplier ? `?supplier=${encodeURIComponent(supplier)}` : ""}`} className="btn-secondary">
                + New product
              </Link>
            )}
            <Link href="/inventory" className="btn-secondary">
              ← Inventory
            </Link>
          </>
        }
      />
      <ReceiveForm products={products} currency={s.currency} supplier={supplier} suppliers={suppliers} focusSupplier={!!sp.new} />
    </div>
  );
}
