import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { getSettings } from "@/lib/analytics";
import { listBatches } from "@/lib/batches";
import { Alert, PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";
import { createProductAction } from "../actions";

export const metadata = { title: "New product" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ created?: string; supplier?: string; batch?: string }> }) {
  await requireUser("manageProducts");
  const { created, supplier, batch } = await searchParams;
  const db = await getDb();
  const [cats, s, batchList] = await Promise.all([db.select().from(categories).orderBy(asc(categories.name)), getSettings(db), listBatches(db)]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="New product" />
      {created && (
        <div className="mb-4">
          <Alert tone="good">Product created. Add the next one below.</Alert>
        </div>
      )}
      <ProductForm action={createProductAction} initial={supplier ? { supplier } : undefined} isNew categories={cats.map((c) => c.name)} currency={s.currency} defaultLeadTime={s.defaultLeadTimeDays} batches={batchList.map((b) => ({ value: String(b.id), label: b.name }))} defaultBatch={batch && batchList.some((b) => String(b.id) === batch) ? batch : (batchList[0] ? String(batchList[0].id) : "")} />
    </div>
  );
}
