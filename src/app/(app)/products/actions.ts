"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { errorMessage, UserError } from "@/lib/errors";
import { adjustStock, type AdjustKind } from "@/lib/inventory";
import { createProduct, setProductActive, updateProduct } from "@/lib/products";
import type { ActionState } from "@/components/form";

function readProduct(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "");
  return {
    name: s("name"),
    sku: s("sku"),
    barcode: s("barcode"),
    category: s("category"),
    description: s("description"),
    unit: s("unit"),
    costPrice: s("costPrice"),
    sellPrice: s("sellPrice"),
    reorderLevel: s("reorderLevel"),
    reorderQty: s("reorderQty"),
    leadTimeDays: s("leadTimeDays"),
    supplier: s("supplier"),
  };
}

export async function createProductAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: number;
  try {
    const user = await requireActionUser("manageProducts");
    const p = await createProduct(await getDb(), { ...readProduct(fd), openingStock: String(fd.get("openingStock") ?? "") }, user.id);
    id = p.id;
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/products");
  redirect(fd.get("another") ? "/products/new?created=1" : `/products/${id}?created=1`);
}

export async function updateProductAction(id: number, _: ActionState, fd: FormData): Promise<ActionState> {
  try {
    await requireActionUser("manageProducts");
    await updateProduct(await getDb(), id, readProduct(fd));
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath(`/products/${id}`);
  return { ok: "Product saved." };
}

export async function setActiveAction(id: number, active: boolean) {
  await requireActionUser("manageProducts");
  await setProductActive(await getDb(), id, active);
  revalidatePath(`/products/${id}`);
}

export async function adjustStockAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireActionUser("adjustStock");
    const productId = Number(fd.get("productId"));
    const kind = String(fd.get("kind")) as AdjustKind;
    if (!["receipt", "return", "damage", "count"].includes(kind)) throw new UserError("Choose what kind of change this is.");
    const raw = String(fd.get("quantity") ?? "").trim();
    if (raw === "") throw new UserError("Enter a quantity.");
    const balance = await adjustStock(await getDb(), { productId, kind, quantity: Number(raw), note: String(fd.get("note") ?? ""), userId: user.id });
    revalidatePath(`/products/${productId}`);
    revalidatePath("/inventory");
    return { ok: `Saved. New stock on hand: ${balance}.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
