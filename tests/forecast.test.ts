import { describe, expect, it } from "vitest";
import { abcClassify, forecastProduct, weeklyTotals, WINDOW_DAYS } from "@/lib/forecast";

const base = { onHand: 100, committed: 0, reorderLevel: 10, reorderQty: 0, leadTimeDays: 7, coverDays: 30, historyDays: 365 };
const flat = (perDay: number) => new Array(WINDOW_DAYS).fill(perDay);

describe("forecastProduct", () => {
  it("uses a weighted weekly average", () => {
    const r = forecastProduct({ ...base, dailyQty: flat(2) });
    expect(r.enoughHistory).toBe(true);
    expect(r.avgDailyDemand).toBeCloseTo(2);
    expect(r.forecastNext30).toBe(60);
    expect(r.trend).toBe("steady");
    expect(r.daysOfCover).toBeCloseTo(50);
    // reorder point = 2*7 + 2*4 = 22
    expect(r.reorderPoint).toBe(22);
    expect(r.urgency).toBe("ok");
  });

  it("suggests enough for lead time + cover days when below the reorder point", () => {
    const r = forecastProduct({ ...base, onHand: 20, dailyQty: flat(2) });
    // target = 2*(7+30) + 8 = 82 → order 62
    expect(r.suggestedOrderQty).toBe(62);
    expect(r.urgency).toBe("order_soon");
  });

  it("flags order_now when stock runs out within the lead time", () => {
    const r = forecastProduct({ ...base, onHand: 10, dailyQty: flat(2) });
    expect(r.urgency).toBe("order_now");
  });

  it("detects rising demand", () => {
    const daily = [...new Array(28).fill(1), ...new Array(28).fill(2)];
    const r = forecastProduct({ ...base, dailyQty: daily });
    expect(r.trend).toBe("rising");
    expect(r.trendPct).toBe(100);
  });

  it("falls back to the reorder level without enough history", () => {
    const daily = new Array(WINDOW_DAYS).fill(0);
    daily[55] = 3;
    const r = forecastProduct({ ...base, onHand: 4, reorderQty: 24, dailyQty: daily, historyDays: 5 });
    expect(r.enoughHistory).toBe(false);
    expect(r.suggestedOrderQty).toBe(24);
    expect(r.explanation).toMatch(/Not enough sales history/);
  });

  it("always covers customer orders that exceed stock", () => {
    const r = forecastProduct({ ...base, onHand: 0, committed: 15, reorderLevel: 0, dailyQty: flat(0) });
    expect(r.available).toBe(-15);
    expect(r.suggestedOrderQty).toBe(15);
    expect(r.urgency).toBe("order_now");
  });

  it("does not dilute new products with weeks before they existed", () => {
    const daily = new Array(WINDOW_DAYS).fill(0);
    for (let i = 42; i < 56; i++) daily[i] = 3;
    const r = forecastProduct({ ...base, dailyQty: daily, historyDays: 14 });
    expect(r.avgDailyDemand).toBeCloseTo(3);
  });

  it("does not recommend anything for idle, well-stocked items", () => {
    const r = forecastProduct({ ...base, dailyQty: flat(0), reorderLevel: 0 });
    expect(r.suggestedOrderQty).toBe(0);
    expect(r.urgency).toBe("ok");
  });
});

describe("helpers", () => {
  it("weeklyTotals aligns weeks to the most recent day", () => {
    expect(weeklyTotals([1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2])).toEqual([7, 14]);
  });

  it("abcClassify splits by cumulative revenue", () => {
    const m = abcClassify(new Map([[1, 800], [2, 150], [3, 50]]), [1, 2, 3, 4]);
    expect([m.get(1), m.get(2), m.get(3), m.get(4)]).toEqual(["A", "B", "C", "C"]);
  });
});
