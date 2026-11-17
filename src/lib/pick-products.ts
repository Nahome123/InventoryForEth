import type { Executor } from "./db/client";
import { getStockLevels } from "./inventory";
import { batchLabel, listBatches } from "./batches";
import type { PickProduct } from "@/components/cart";

/** Active products in the compact shape the client-side pickers need (<1,000 products fits easily). */
export async function getPickProducts(db: Executor, opts: { withCost?: boolean } = {}): Promise<PickProduct[]> {
  const [levels, batchList] = await Promise.all([getStockLevels(db), listBatches(db)]);
  const batchName = new Map(batchList.map((b) => [b.id, batchLabel(b)]));
  return levels.map((l) => ({
    id: l.id,
    name: l.name,
    sku: l.sku,
    barcode: l.barcode,
    priceCents: l.sellPriceCents,
    onHand: l.onHand,
    available: l.available,
    unit: l.unit,
    ...(l.batchId ? { batch: batchName.get(l.batchId) } : {}),
    ...(opts.withCost ? { costCents: l.costPriceCents } : {}),
  }));
}
