import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { exchangeRateRoutes } from "../../routes/exchangeRate";
import { createExchangeRateService } from "../../services/exchangeRateService";

describe("GET /api/exchange-rate (público)", () => {
  it("responde el contrato sin JWT con fetch mockeado", async () => {
    const fetchFn = vi.fn(async (_u: string, init?: RequestInit) => {
      const side = JSON.parse(String(init?.body)).tradeType;
      const p = side === "BUY" ? "10.05" : "9.50";
      return new Response(JSON.stringify({ data: [{ adv: { price: p } }] }), { status: 200 });
    });
    const app = Fastify();
    await app.register(exchangeRateRoutes, {
      service: createExchangeRateService({ officialBuy: "6.86", officialSell: "6.96", ttlMinutes: 10, fetchFn }),
    });
    const res = await app.inject({ method: "GET", url: "/api/exchange-rate" });
    expect(res.statusCode).toBe(200);
    const b = res.json();
    expect(b.currency).toBe("USD");
    expect(b.official).toEqual({ buy: "6.86", sell: "6.96", source: "BCB (oficial)" });
    expect(b.parallel).toEqual({ buy: "10.05", sell: "9.50", source: "Binance P2P (USDT/BOB)" });
    expect(b.stale).toBe(false);
    expect(typeof b.updatedAt).toBe("string");
  });

  it("nunca 500 si Binance falla", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("down");
    });
    const app = Fastify();
    await app.register(exchangeRateRoutes, {
      service: createExchangeRateService({ officialBuy: "6.86", officialSell: "6.96", ttlMinutes: 10, fetchFn }),
    });
    const res = await app.inject({ method: "GET", url: "/api/exchange-rate" });
    expect(res.statusCode).toBe(200);
    expect(res.json().parallel).toBeNull();
  });
});
