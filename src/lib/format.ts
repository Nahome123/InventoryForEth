export const saleNo = (id: number) => `S-${String(id).padStart(6, "0")}`;
export const orderNo = (id: number) => `O-${String(id).padStart(5, "0")}`;

export function formatDateTime(d: Date | string | null, timeZone?: string) {
  if (d === null) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(d));
}

/** Value for an <input type="datetime-local"> showing `d` in the store's time zone. */
export function toLocalInput(d: Date | string | null, timeZone: string): string {
  if (d === null) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(d))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function formatDate(d: Date | string | null, timeZone?: string) {
  if (d === null) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone }).format(new Date(d));
}

/** Formats a plain YYYY-MM-DD date (no time zone shift). */
export function formatPlainDate(ymd: string | null | undefined) {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(Date.UTC(y, m - 1, d));
}

/** Today's date (YYYY-MM-DD) in the given IANA time zone. */
export function todayInZone(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  mobile_money: "Mobile money",
  bank_transfer: "Bank transfer",
  credit: "Credit (pay later)",
  other: "Other",
};

export const MOVEMENT_LABELS: Record<string, string> = {
  opening: "Opening stock",
  receipt: "Received",
  sale: "Sale",
  sale_void: "Sale voided",
  return: "Customer return",
  adjustment: "Count adjustment",
  damage: "Damaged / lost",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  ready: "Ready for pickup",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};
