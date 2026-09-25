/**
 * Cotización del dólar en Bolivia (GET /api/exchange-rate).
 *
 * - official: valores fijos configurables (BCB).
 * - parallel: Binance P2P USDT/BOB (API NO OFICIAL, puede cambiar sin aviso).
 *   `buy`  = lo que cuesta COMPRAR un dólar (tradeType BUY del usuario).
 *   `sell` = lo que pagan por VENDER un dólar (tradeType SELL).
 *   Se usa la mediana de los precios de cada lado, descartando outliers.
 * - Caché en memoria con TTL; si Binance falla se devuelve lo último cacheado
 *   con stale:true, o parallel:null si nunca hubo dato. Nunca lanza.
 */
export const BINANCE_P2P_URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";
export const BINANCE_TIMEOUT_MS = 6000;

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export interface ParallelRate {
  buy: string;
  sell: string;
  source: string;
}

export interface ExchangeRateResponse {
  currency: "USD";
  official: { buy: string; sell: string; source: string };
  parallel: ParallelRate | null;
  updatedAt: string;
  stale: boolean;
}

export interface ExchangeRateOptions {
  officialBuy: string;
  officialSell: string;
  ttlMinutes: number;
  fetchFn?: FetchFn;
  now?: () => number;
}

/** Mediana ignorando outliers evidentes (> 20% de desvío respecto a la mediana inicial). */
export function robustMedian(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const median = (arr: number[]) => {
    const m = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
  };
  const first = median(v);
  const filtered = v.filter((n) => Math.abs(n - first) / first <= 0.2);
  return median(filtered.length ? filtered : v);
}

export function createExchangeRateService(opts: ExchangeRateOptions) {
  const fetchFn: FetchFn = opts.fetchFn ?? ((url, init) => fetch(url, init));
  const now = opts.now ?? (() => Date.now());
  const ttlMs = opts.ttlMinutes * 60_000;
  let cache: { parallel: ParallelRate; at: number } | null = null;

  async function fetchSide(tradeType: "BUY" | "SELL"): Promise<number> {
    const res = await fetchFn(BINANCE_P2P_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fiat: "BOB",
        page: 1,
        rows: 10,
        tradeType,
        asset: "USDT",
        countries: [],
        proMerchantAds: false,
        publisherType: null,
        payTypes: [],
      }),
      signal: AbortSignal.timeout(BINANCE_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
    const json = (await res.json()) as { data?: Array<{ adv?: { price?: string } }> };
    const prices = (json.data ?? []).map((d) => Number(d.adv?.price));
    const m = robustMedian(prices);
    if (m === null) throw new Error("Binance sin precios");
    return m;
  }

  async function getRate(): Promise<ExchangeRateResponse> {
    const official = { buy: opts.officialBuy, sell: opts.officialSell, source: "BCB (oficial)" };
    const t = now();
    let stale = false;
    if (!cache || t - cache.at >= ttlMs) {
      try {
        const [buy, sell] = await Promise.all([fetchSide("BUY"), fetchSide("SELL")]);
        cache = {
          parallel: { buy: buy.toFixed(2), sell: sell.toFixed(2), source: "Binance P2P (USDT/BOB)" },
          at: t,
        };
      } catch {
        stale = cache !== null;
      }
    }
    return {
      currency: "USD",
      official,
      parallel: cache ? cache.parallel : null,
      updatedAt: new Date(cache ? cache.at : t).toISOString(),
      stale,
    };
  }

  return { getRate };
}

export type ExchangeRateService = ReturnType<typeof createExchangeRateService>;
