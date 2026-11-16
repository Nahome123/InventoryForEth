import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/analytics";
import { getPickProducts } from "@/lib/pick-products";
import { todayInZone } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { OrderForm } from "./order-form";

export const metadata = { title: "New customer order" };

export default async function NewOrderPage() {
  await requireUser("manageOrders");
  const db = await getDb();
  const [products, s] = await Promise.all([getPickProducts(db), getSettings(db)]);
  return (
    <>
      <PageHeader title="New customer order" subtitle="Stock is reserved now and deducted when the customer picks it up. You can order more than is in stock; the shortfall shows up in restock suggestions." />
      <OrderForm products={products} currency={s.currency} today={todayInZone(s.timezone)} />
    </>
  );
}
