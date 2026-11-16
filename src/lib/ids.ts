/** Postgres `integer` ids top out at 2,147,483,647. Anything else (e.g. a long part number typed into a search) is not an id. */
const MAX_ID = 2_147_483_647;

export function toId(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!/^\d{1,10}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= MAX_ID ? n : null;
}
