import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/analytics";
import { getPickProducts } from "@/lib/pick-products";
import { PageHeader } from "@/components/ui";
import { ReceiveForm } from "./receive-form";

export const metadata = { title: "Receive delivery" };

export default async function ReceivePage() {
  await requireUser("adjustStock");
  const db = await getDb();
  const [products, s] = await Promise.all([getPickProducts(db), getSettings(db)]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Receive delivery" subtitle="Add everything that arrived from a supplier. Stock goes up as soon as you save." />
      <ReceiveForm products={products} currency={s.currency} />
    </div>
  );
}
