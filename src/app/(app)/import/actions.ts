"use server";

import { revalidatePath } from "next/cache";
import { requireActionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorMessage, UserError } from "@/lib/errors";
import { importProducts, importSales } from "@/lib/import";
import { getSettings } from "@/lib/analytics";
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
    const r = await importProducts(await getDb(), await readCsv(fd), user.id);
    if (r.errors.length) return { error: "Nothing was imported. Fix these rows and try again:", errors: r.errors };
    revalidatePath("/products");
    return { ok: `Imported: ${r.created} new product${r.created === 1 ? "" : "s"}, ${r.updated} updated.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function importSalesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireActionUser("importExport");
    const db = await getDb();
    const s = await getSettings(db);
    const r = await importSales(db, await readCsv(fd), { userId: user.id, timeZone: s.timezone, affectStock: fd.get("affectStock") === "on" });
    if (r.errors.length) return { error: "Nothing was imported. Fix these rows and try again:", errors: r.errors };
    revalidatePath("/sales");
    return { ok: `Imported ${r.sales} sale${r.sales === 1 ? "" : "s"} from ${r.lines} rows.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
