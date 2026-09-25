import "dotenv/config";

/**
 * Config bootstrap — SDD-10 §1.1 y SDD-11 §9.2/9.3.
 *
 * REGLA NO NEGOCIABLE: JWT_SECRET (y DATABASE_URL) NUNCA tienen un valor
 * por defecto en código. Si faltan, el proceso debe fallar al arrancar.
 * Esto evita repetir la falla de AUDIT_ROUX.md §2.1 / AUDIT_GOVIND.md §10.4
 * (secretos por defecto públicos y commiteados).
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === null || value.trim() === "") {
    throw new Error(
      `Falta la variable de entorno obligatoria "${name}". ` +
        `El servidor no puede arrancar sin ella (ver SDD-10 §1). ` +
        `Copia .env.example a .env y complétala.`,
    );
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? fallback : value;
}

export interface AppConfig {
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  port: number;
  nodeEnv: "development" | "staging" | "production";
  corsOrigin: string;
  /**
   * Base URL pública del backend (sin slash final), usada para construir
   * URLs absolutas hacia archivos estáticos servidos por este proceso
   * (p.ej. `imageUrl` de recetas/ingredientes en `public/images/`). No forma
   * parte de 01-PROJECT_SPEC.md/SDD-06 original — se agregó junto con el
   * campo `imageUrl` a pedido explícito del usuario. Default coherente con
   * `app/web/.env`'s `VITE_API_BASE_URL=http://localhost:3000/api`.
   */
  publicBaseUrl: string;
  /**
   * Umbral (%) de margen real por debajo del cual un producto se marca como
   * "poco rentable" en el reporte de rentabilidad (RF-012, SDD-07 CU6,
   * SDD-10 §1). Configurable por el dueño vía env var en vez de una
   * constante fija en código, per la pregunta abierta que dejó SDD-07 CU6.
   * Default 20 — mismo valor de ejemplo usado en SDD-07 CU6/SDD-03 §6.2.
   */
  lowMarginThresholdPercent: number;
  /** Cotización oficial BCB (valores fijos configurables) — GET /api/exchange-rate. */
  officialUsdBuy: string;
  officialUsdSell: string;
  /** TTL (minutos) de la caché en memoria de la cotización paralela (Binance P2P). */
  exchangeRateTtlMinutes: number;
}

export function loadConfig(): AppConfig {
  const databaseUrl = requireEnv("DATABASE_URL");
  // JWT_SECRET: NUNCA un `?? "algo"` aquí. Debe explotar si falta.
  const jwtSecret = requireEnv("JWT_SECRET");
  const nodeEnvRaw = requireEnv("NODE_ENV");

  if (!["development", "staging", "production"].includes(nodeEnvRaw)) {
    throw new Error(
      `NODE_ENV="${nodeEnvRaw}" no es válido. Debe ser development, staging o production.`,
    );
  }

  const corsOrigin = requireEnv("CORS_ORIGIN");
  const port = Number(optionalEnv("PORT", "3000"));

  return {
    databaseUrl,
    jwtSecret,
    jwtExpiresIn: optionalEnv("JWT_EXPIRES_IN", "8h"),
    port,
    nodeEnv: nodeEnvRaw as AppConfig["nodeEnv"],
    corsOrigin,
    publicBaseUrl: optionalEnv("PUBLIC_BASE_URL", `http://localhost:${port}`),
    lowMarginThresholdPercent: Number(optionalEnv("LOW_MARGIN_THRESHOLD_PERCENT", "20")),
    officialUsdBuy: optionalEnv("OFFICIAL_USD_BUY", "6.86"),
    officialUsdSell: optionalEnv("OFFICIAL_USD_SELL", "6.96"),
    exchangeRateTtlMinutes: Number(optionalEnv("EXCHANGE_RATE_TTL_MINUTES", "10")),
  };
}

export const config = loadConfig();
