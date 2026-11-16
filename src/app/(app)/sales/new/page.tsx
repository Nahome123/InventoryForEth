import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/analytics";
import { getPickProducts } from "@/lib/pick-products";
import { Empty, PageHeader } from "@/components/ui";
import { PointOfSale } from "./pos";

export const metadata = { title: "New sale" };

export default async function NewSalePage() {
  await requireUser("recordSales");
  const db = await getDb();
  const [products, s] = await Promise.all([getPickProducts(db), getSettings(db)]);
  return (
    <>
      <PageHeader title="New sale" />
      {products.length === 0 ? (
        <div className="card">
          <Empty>
            There are no products yet.{" "}
            <Link href="/products/new" className="text-accent-fg underline">
              Add products
            </Link>{" "}
            first.
          </Empty>
        </div>
      ) : (
        <PointOfSale products={products} currency={s.currency} />
      )}
    </>
  );
}
