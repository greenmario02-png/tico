import path from "node:path";
import dotenv from "dotenv";

// Carga primero `.env` (valores de desarrollo por defecto) y luego
// `.env.test` con `override: true`, que apunta a una base de datos de
// PostgreSQL SEPARADA de `panaderia_dev` (ver `.env.test`). Esto evita que
// los tests de integración (que insertan filas reales vía la app) ensucien
// la base de datos que usa `npm run dev` / `npm run db:seed` para QA manual,
// y que corridas repetidas de `npm test` acumulen filas entre sí — ver
// `src/tests/globalSetup.ts`, que además trunca esa base de test antes de
// correr la suite, por si quedaron filas de una corrida anterior.
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../.env.test"), override: true });

// Variables de entorno mínimas para que src/lib/config.ts no explote durante
// los tests que no dependen de una base de datos real (ver test de
// config.fail-fast.test.ts para el caso que sí verifica el fallo).
// Vitest fuerza NODE_ENV="test" antes de este archivo, pero SDD-10 §1 solo
// admite development|staging|production — se sobreescribe explícitamente.
process.env.NODE_ENV = "development";
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test_secret_only_for_vitest_do_not_reuse";
// Reutiliza la base de datos local de docker-compose.yml (ver README de dev)
// salvo que el entorno provea una distinta (p.ej. `.env.test` o CI con su
// propia instancia).
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://panaderia:panaderia@localhost:5432/panaderia_dev";

// Los tests de integración comparten IP (127.0.0.1): tope por IP alto para no interferir.
process.env.LOGIN_IP_LIMIT_PER_MINUTE = process.env.LOGIN_IP_LIMIT_PER_MINUTE ?? "100000";
