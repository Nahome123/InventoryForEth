/**
 * Basic, explainable demand forecasting (PRD: "basic forecasting rather than complex ML").
 *
 * Method, in plain words:
 *  1. Look at the last 8 weeks of sales for a product.
 *  2. Average weekly sales, counting recent weeks more (week 8 counts 8x, week 1 counts 1x).
 *  3. Compare the last 4 weeks with the 4 before to call the trend rising / falling / steady.
 *  4. Reorder point = demand during the supplier lead time + a safety buffer of half the lead time.
 *  5. When available stock drops to the reorder point, suggest enough to cover lead time + cover days.
 */

export const WINDOW_DAYS = 56;
export const MIN_HISTORY_DAYS = 14;
export const MIN_SALE_DAYS = 3;

export type ForecastInput = {
  /** Units sold per day, oldest first; last element is today. Length should be WINDOW_DAYS. */
  dailyQty: number[];
  /** Days since the product's first recorded sale (or since it was created), whichever is the relevant history. */
  historyDays: number;
  onHand: number;
  committed: number;
  reorderLevel: number;
  reorderQty: number;
  leadTimeDays: number;
  coverDays: number;
};

export type Trend = "rising" | "falling" | "steady" | "unknown";
export type Urgency = "order_now" | "order_soon" | "ok";

export type ForecastResult = {
  enoughHistory: boolean;
  avgDailyDemand: number;
  unitsSoldInWindow: number;
  trend: Trend;
  trendPct: number | null;
  forecastNext30: number;
  available: number;
  daysOfCover: number | null;
  reorderPoint: number;
  suggestedOrderQty: number;
  urgency: Urgency;
  explanation: string;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function weeklyTotals(dailyQty: number[]): number[] {
  const weeks: number[] = [];
  // Align weeks to end at the most recent day.
  for (let end = dailyQty.length; end > 0; end -= 7) {
    const start = Math.max(0, end - 7);
    weeks.unshift(dailyQty.slice(start, end).reduce((s, n) => s + n, 0));
  }
  return weeks;
}

export function forecastProduct(input: ForecastInput): ForecastResult {
  const available = input.onHand - input.committed;
  const lead = Math.max(0, input.leadTimeDays);
  const unitsSold = input.dailyQty.reduce((s, n) => s + n, 0);
  const saleDays = input.dailyQty.filter((n) => n > 0).length;
  const usableDays = Math.min(input.dailyQty.length, Math.max(0, input.historyDays));
  const enoughHistory = usableDays >= MIN_HISTORY_DAYS && saleDays >= MIN_SALE_DAYS;

  // Only use whole weeks the product actually existed for, so new items aren't diluted by zeros.
  const fullWeekDays = Math.floor(usableDays / 7) * 7;
  const weeks = fullWeekDays > 0 ? weeklyTotals(input.dailyQty.slice(input.dailyQty.length - fullWeekDays)) : [];
  let avgDaily = 0;
  if (enoughHistory && weeks.length) {
    let wSum = 0;
    let total = 0;
    weeks.forEach((q, i) => {
      const w = i + 1;
      wSum += w;
      total += w * q;
    });
    avgDaily = total / wSum / 7;
  }

  let trend: Trend = "unknown";
  let trendPct: number | null = null;
  if (enoughHistory && weeks.length >= 8) {
    const recent = weeks.slice(-4).reduce((s, n) => s + n, 0);
    const prior = weeks.slice(-8, -4).reduce((s, n) => s + n, 0);
    if (prior > 0) {
      trendPct = Math.round(((recent - prior) / prior) * 100);
      trend = trendPct >= 15 ? "rising" : trendPct <= -15 ? "falling" : "steady";
    } else if (recent > 0) {
      trend = "rising";
    }
  }

  const safety = avgDaily * Math.ceil(lead / 2);
  const reorderPoint = Math.max(input.reorderLevel, Math.ceil(avgDaily * lead + safety));
  const daysOfCover = avgDaily > 0 ? Math.max(0, available) / avgDaily : null;

  let suggested = 0;
  const needsStock = available <= reorderPoint;
  if (needsStock) {
    if (enoughHistory && avgDaily > 0) {
      const target = Math.ceil(avgDaily * (lead + input.coverDays) + safety);
      suggested = Math.max(target - available, input.reorderQty);
    } else {
      suggested = Math.max(input.reorderQty, input.reorderLevel - available, 0);
    }
    // Always at least cover orders customers are already waiting for.
    suggested = Math.max(suggested, -available);
  }

  let urgency: Urgency = "ok";
  if (available <= 0 && (input.committed > 0 || avgDaily > 0 || input.reorderLevel > 0)) urgency = "order_now";
  else if (daysOfCover !== null && daysOfCover <= lead) urgency = "order_now";
  else if (needsStock && (reorderPoint > 0 || input.committed > 0)) urgency = "order_soon";
  if (suggested === 0) urgency = "ok";

  const parts: string[] = [];
  if (enoughHistory) {
    parts.push(`Sells about ${round1(avgDaily * 7)} per week (weighted average of the last ${weeks.length} weeks).`);
    if (trend === "rising" || trend === "falling") parts.push(`Demand is ${trend}${trendPct !== null ? ` (${trendPct > 0 ? "+" : ""}${trendPct}% vs the 4 weeks before)` : ""}.`);
    if (daysOfCover !== null) parts.push(`Available stock lasts about ${Math.floor(daysOfCover)} days.`);
    parts.push(`Reorder point ${reorderPoint} = ${lead}-day lead time demand + safety buffer${input.reorderLevel > Math.ceil(avgDaily * lead + safety) ? " (your reorder level is higher, so it's used)" : ""}.`);
  } else {
    parts.push(`Not enough sales history to forecast (needs ${MIN_HISTORY_DAYS}+ days and sales on ${MIN_SALE_DAYS}+ days); using the reorder level of ${input.reorderLevel}.`);
  }
  if (input.committed > 0) parts.push(`${input.committed} reserved for customer orders.`);
  if (suggested > 0) parts.push(`Suggest ordering ${suggested}.`);

  return {
    enoughHistory,
    avgDailyDemand: avgDaily,
    unitsSoldInWindow: unitsSold,
    trend,
    trendPct,
    forecastNext30: Math.round(avgDaily * 30),
    available,
    daysOfCover,
    reorderPoint,
    suggestedOrderQty: suggested,
    urgency,
    explanation: parts.join(" "),
  };
}

/** ABC classification: A = products making the top 80% of revenue, B = next 15%, C = the rest (incl. no sales). */
export function abcClassify(revenueByProduct: Map<number, number>, allProductIds: number[]): Map<number, "A" | "B" | "C"> {
  const total = [...revenueByProduct.values()].reduce((s, n) => s + n, 0);
  const out = new Map<number, "A" | "B" | "C">();
  allProductIds.forEach((id) => out.set(id, "C"));
  if (total <= 0) return out;
  const sorted = [...revenueByProduct.entries()].filter(([, r]) => r > 0).sort((a, b) => b[1] - a[1]);
  let cum = 0;
  for (const [id, rev] of sorted) {
    const before = cum / total;
    cum += rev;
    out.set(id, before < 0.8 ? "A" : before < 0.95 ? "B" : "C");
  }
  return out;
}
