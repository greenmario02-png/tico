import type { FastifyInstance } from "fastify";
import { config } from "../lib/config";
import { createExchangeRateService, type ExchangeRateService } from "../services/exchangeRateService";

export async function exchangeRateRoutes(
  app: FastifyInstance,
  opts: { service?: ExchangeRateService } = {},
) {
  const service =
    opts.service ??
    createExchangeRateService({
      officialBuy: config.officialUsdBuy,
      officialSell: config.officialUsdSell,
      ttlMinutes: config.exchangeRateTtlMinutes,
    });
  // Público: sin JWT.
  app.get("/api/exchange-rate", async () => service.getRate());
}
