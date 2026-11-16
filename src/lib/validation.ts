import { z } from "zod";
import { UserError } from "./errors";

export const linesSchema = z
  .array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().positive("Quantities must be at least 1."), originId: z.number().int().positive().nullable().optional() }))
  .min(1, "Add at least one product.")
  .max(500, "Too many lines.");

export function parseLines(raw: FormDataEntryValue | null) {
  let json: unknown;
  try {
    json = JSON.parse(String(raw ?? "[]"));
  } catch {
    throw new UserError("Couldn't read the list of products.");
  }
  const r = linesSchema.safeParse(json);
  if (!r.success) throw new UserError(r.error.issues[0].message);
  return r.data;
}
