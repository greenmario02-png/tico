import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

/**
 * Vitest `globalSetup` (registrado en vitest.config.ts).
 *
 * Corre UNA VEZ, en un proceso aparte, antes de que arranque cualquier
 * archivo de test. Su único trabajo es dejar la base de datos de test en un
 * estado limpio y determinístico, para que `npm test` sea idempotente sin
 * importar cuántas veces se haya corrido antes contra la misma base de datos
 * (bug real encontrado: ~300+ filas acumuladas de ingredientes/recetas/etc.
 * de corridas manuales repetidas rompían tests que asumen conteos exactos,
 * p. ej. T-INVENTARIO-01 y aserciones de paginación en sales.test.ts).
 *
 * Este archivo NO pasa por `src/tests/setup.ts` (ese es un `setupFiles`, que
 * corre por archivo de test, dentro de los workers) — por eso carga sus
 * propias variables de entorno aquí, con la misma prioridad: `.env` y luego
 * `.env.test` (que apunta a `panaderia_test`, separada de `panaderia_dev`).
 *
 * TRUNCATE ... CASCADE se usa en vez de DROP/recrear el schema porque es
 * mucho más rápido y no requiere volver a correr migraciones en cada
 * ejecución de la suite; el orden de la lista no importa para CASCADE, pero
 * se mantiene el orden inverso de creación (SDD-02 §5) por legibilidad.
 */
export default async function globalSetup() {
  dotenv.config();
  dotenv.config({ path: path.resolve(__dirname, "../../.env.test"), override: true });

  const databaseUrl =
    process.env.DATABASE_URL ?? "postgresql://panaderia:panaderia@localhost:5432/panaderia_dev";

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await pool.query(`
      TRUNCATE TABLE
        sales,
        batch_ingredient_usage,
        batches,
        products,
        recipe_ingredients,
        recipes,
        ingredient_stock_movements,
        ingredient_price_history,
        ingredients,
        suppliers,
        categories,
        users
      RESTART IDENTITY CASCADE
    `);
  } finally {
    await pool.end();
  }
}
