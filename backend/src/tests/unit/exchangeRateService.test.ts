import { describe, expect, it, vi } from "vitest";
import { createExchangeRateService, robustMedian } from "../../services/exchangeRateService";

function binance(buy: string[], sell: string[]) {
  return vi.fn(async (_u: string, init?: RequestInit) => {
    const side = JSON.parse(String(init?.body)).tradeType as string;
    const prices = side === "BUY" ? buy : sell;
    return new Response(JSON.stringify({ data: prices.map((price) => ({ adv: { price } })) }), { status: 200 });
  });
}
const base = { ttlMinutes: 10 };

describe("exchangeRateService", () => {
  it("mediana ignora outliers", () => {
    expect(robustMedian([10, 10.2, 10.4, 99, 1])).toBeCloseTo(10.2);
    expect(robustMedian([])).toBeNull();
  });

  it("calcula parallel y cachea dentro del TTL", async () => {
    const fetchFn = binance(["10.00", "10.20", "10.10"], ["9.00", "9.10", "9.20"]);
    let t = 1_000_000;
    const s = createExchangeRateService({ ...base, fetchFn, now: () => t });
    const r1 = await s.getRate();
    expect(r1.parallel).toEqual({ buy: "10.10", sell: "9.10", source: "Binance P2P (USDT/BOB)" });
    expect(r1.stale).toBe(false);
    t += 9 * 60_000;
    await s.getRate();
    expect(fetchFn).toHaveBeenCalledTimes(2); // una por lado, solo la primera vez
    t += 2 * 60_000;
    await s.getRate();
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });

  it("si falla tras tener caché devuelve stale:true con el último valor", async () => {
    let ok = true;
    const good = binance(["10"], ["9"]);
    const fetchFn = vi.fn(async (u: string, i?: RequestInit) => {
      if (!ok) throw new Error("red");
      return good(u, i);
    });
    let t = 0;
    const s = createExchangeRateService({ ...base, fetchFn, now: () => t });
    await s.getRate();
    ok = false;
    t += 11 * 60_000;
    const r = await s.getRate();
    expect(r.stale).toBe(true);
    expect(r.parallel?.buy).toBe("10.00");
  });

  it("parallel:null si nunca hubo dato", async () => {
    const fetchFn = vi.fn(async () => new Response("x", { status: 500 }));
    const r = await createExchangeRateService({ ...base, fetchFn }).getRate();
    expect(r.parallel).toBeNull();
    expect((r as unknown as Record<string, unknown>).official).toBeUndefined();
    expect(r.stale).toBe(false);
  });
});
