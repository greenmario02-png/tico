import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { config } from "./lib/config";
import { ApiError } from "./lib/errors";
import { authRoutes } from "./routes/auth";
import { batchRoutes } from "./routes/batches";
import { categoryRoutes } from "./routes/categories";
import { exchangeRateRoutes } from "./routes/exchangeRate";
import { ingredientRoutes } from "./routes/ingredients";
import { inventoryRoutes } from "./routes/inventory";
import { productRoutes } from "./routes/products";
import { recipeRoutes } from "./routes/recipes";
import { reportRoutes } from "./routes/reports";
import { saleRoutes } from "./routes/sales";
import { supplierRoutes } from "./routes/suppliers";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env.VITEST !== "true" });

  // CORS_ORIGIN admite varios orígenes separados por coma.
  const corsOrigins = config.corsOrigin
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  await app.register(cors, { origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins });

  // Archivos estáticos (fotos de recetas/ingredientes, campo `imageUrl` —
  // agregado a pedido explícito del usuario, no forma parte del SDD
  // original). Se descargan y guardan localmente en `public/images/` en vez
  // de hotlinkear un tercero, para que la URL sea estable (ver seed.ts).
  await app.register(fastifyStatic, {
    root: path.join(__dirname, "..", "public", "images"),
    prefix: "/images/",
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      reply.code(error.statusCode).send(error.toBody());
      return;
    }
    app.log.error(error);
    reply.code(500).send({
      error: { code: "INTERNAL_ERROR", message: "Ocurrió un error inesperado. Intenta de nuevo." },
    });
  });

  await app.register(authRoutes);
  await app.register(categoryRoutes);
  await app.register(supplierRoutes);
  await app.register(ingredientRoutes);
  await app.register(recipeRoutes);
  await app.register(productRoutes);
  await app.register(batchRoutes);
  await app.register(saleRoutes);
  await app.register(inventoryRoutes);
  await app.register(reportRoutes);
  await app.register(exchangeRateRoutes);

  app.get("/api/health", async () => ({ status: "ok" }));

  return app;
}
