"use server";

import { revalidatePath } from "next/cache";
import { requireActionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorMessage, UserError } from "@/lib/errors";
import { importProducts, importSales } from "@/lib/import";
import { getSettings } from "@/lib/analytics";
import { deleteBatch, EARLIER, renameBatch } from "@/lib/batches";
import { toId } from "@/lib/ids";
import type { ActionState } from "@/components/form";

async function readCsv(fd: FormData) {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) throw new UserError("Choose a CSV file first.");
  if (file.size > 8 * 1024 * 1024) throw new UserError("File is too large (max 8 MB).");
  if (!/\.(csv|txt)$/i.test(file.name)) throw new UserError("Please upload a .csv file. In Excel use File → Save As → CSV.");
  return file.text();
}

export async function importProductsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireActionUser("importExport");
    const separate = fd.get("mode") !== "update";
    const supplier = String(fd.get("supplier") ?? "").trim().replace(/\s+/g, " ") || null;
    const name = String(fd.get("batchName") ?? "").trim().replace(/\s+/g, " ");
    if (separate && !name) throw new UserError("Give this batch a name, e.g. “3rd buy”.");
    if (name.length > 80 || (supplier?.length ?? 0) > 120) throw new UserError("Batch or supplier name is too long.");
    const r = await importProducts(await getDb(), await readCsv(fd), user.id, separate ? { batch: { name, supplier } } : {});
    if (r.errors.length) return { error: "Nothing was imported. Fix these rows and try again:", errors: r.errors };
    revalidatePath("/products");
    revalidatePath("/inventory");
    return {
      ok: separate
        ? `New batch “${name}” created with ${r.created} product${r.created === 1 ? "" : "s"}. Pick it in the Batch filter to see its own numbers.`
        : `Imported: ${r.created} new product${r.created === 1 ? "" : "s"}, ${r.updated} updated.`,
    };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function importSalesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireActionUser("importExport");
    const db = await getDb();
    const s = await getSettings(db);
    const b = String(fd.get("batch") ?? "");
    const batchId = b === EARLIER ? null : toId(b);
    if (b !== EARLIER && !batchId) throw new UserError("Choose which batch these sales belong to.");
    const r = await importSales(db, await readCsv(fd), { userId: user.id, timeZone: s.timezone, affectStock: fd.get("affectStock") === "on", batchId });
    if (r.errors.length) return { error: "Nothing was imported. Fix these rows and try again:", errors: r.errors };
    revalidatePath("/sales");
    return { ok: `Imported ${r.sales} sale${r.sales === 1 ? "" : "s"} from ${r.lines} rows.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

function revalidateAll() {
  for (const p of ["/import", "/products", "/inventory", "/sales", "/profit", "/"]) revalidatePath(p);
}

export async function renameBatchAction(id: number, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireActionUser("importExport");
    const name = await renameBatch(await getDb(), id, String(fd.get("name") ?? ""), String(fd.get("supplier") ?? ""));
    revalidateAll();
    return { ok: `Saved as “${name}”.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function deleteBatchAction(id: number, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireActionUser("manageSettings");
    if (fd.get("confirm") !== "on") throw new UserError("Tick the box to confirm.");
    const r = await deleteBatch(await getDb(), id);
    revalidateAll();
    return { ok: `Deleted “${r.name}”: ${r.products} product${r.products === 1 ? "" : "s"} and ${r.sales} sale${r.sales === 1 ? "" : "s"} removed.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
