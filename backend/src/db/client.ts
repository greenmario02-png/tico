import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { config } from "../lib/config";
import * as schema from "./schema/index";

// Neon (y cualquier Postgres gestionado) exige TLS: se activa solo si la URL
// trae sslmode=require|verify-* o ssl=true, o con DATABASE_SSL=true. En
// desarrollo local (sin esos parámetros) no cambia nada.
function needsSsl(url: string): boolean {
  if (process.env.DATABASE_SSL === "true") return true;
  return /[?&](sslmode=(require|verify-ca|verify-full)|ssl=true)/i.test(url);
}

function stripSslParams(url: string): string {
  // pg trata sslmode=require como verify-full y emite avisos; el objeto ssl
  // explícito de abajo manda.
  const u = new URL(url);
  u.searchParams.delete("sslmode");
  u.searchParams.delete("channel_binding");
  return u.toString();
}

const ssl = needsSsl(config.databaseUrl);

export const pool = new pg.Pool({
  connectionString: ssl ? stripSslParams(config.databaseUrl) : config.databaseUrl,
  ...(ssl ? { ssl: { rejectUnauthorized: true } } : {}),
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;
