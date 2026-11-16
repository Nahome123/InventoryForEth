import type { Executor } from "./db/client";
import { getStockLevels } from "./inventory";
import type { PickProduct } from "@/components/cart";

/** Active products in the compact shape the client-side pickers need (<1,000 products fits easily). */
export async function getPickProducts(db: Executor): Promise<PickProduct[]> {
  const levels = await getStockLevels(db);
  return levels.map((l) => ({
    id: l.id,
    name: l.name,
    sku: l.sku,
    barcode: l.barcode,
    priceCents: l.sellPriceCents,
    onHand: l.onHand,
    available: l.available,
    unit: l.unit,
  }));
}
