import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/analytics";
import { getPickProducts } from "@/lib/pick-products";
import { listOrigins } from "@/lib/profit";
import { Empty, PageHeader } from "@/components/ui";
import { PointOfSale } from "./pos";

export const metadata = { title: "New sale" };

export default async function NewSalePage() {
  const user = await requireUser("recordSales");
  // Sales staff never get the buying price (or the list price, which defaults to it); they type the agreed price.
  const showCosts = can(user.role, "viewCosts");
  const db = await getDb();
  const [products, s, origins] = await Promise.all([getPickProducts(db, { withCost: showCosts, hidePrice: !showCosts }), getSettings(db), listOrigins(db, true)]);
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
        <PointOfSale products={products} currency={s.currency} origins={origins.map(({ id, name }) => ({ id, name }))} />
      )}
    </>
  );
}
