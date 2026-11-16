import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { getSettings } from "@/lib/analytics";
import { Alert, PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";
import { createProductAction } from "../actions";

export const metadata = { title: "New product" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ created?: string; supplier?: string }> }) {
  await requireUser("manageProducts");
  const { created, supplier } = await searchParams;
  const db = await getDb();
  const [cats, s] = await Promise.all([db.select().from(categories).orderBy(asc(categories.name)), getSettings(db)]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="New product" />
      {created && (
        <div className="mb-4">
          <Alert tone="good">Product created. Add the next one below.</Alert>
        </div>
      )}
      <ProductForm action={createProductAction} initial={supplier ? { supplier } : undefined} isNew categories={cats.map((c) => c.name)} currency={s.currency} defaultLeadTime={s.defaultLeadTimeDays} />
    </div>
  );
}
