import type { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { authenticate, requireRole } from "../lib/auth";
import { ApiError } from "../lib/errors";
import { buildPaginationMeta, parsePagination } from "../lib/pagination";
import {
  getCostsReport,
  getInventoryStatusReport,
  getProductionReport,
  getTopExpensiveIngredients,
} from "../services/reportService";
import { getProfitabilityReport } from "../services/saleService";

function parseDateParam(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw ApiError.validation("La fecha indicada no es válida.", [
      { field, message: "La fecha indicada no es válida." },
    ]);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.validation("La fecha indicada no es válida.", [
      { field, message: "La fecha indicada no es válida." },
    ]);
  }
  return date;
}

export async function reportRoutes(app: FastifyInstance) {
  app.get(
    "/api/reports/costs",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const query = request.query as Record<string, unknown>;
      return getCostsReport(db, {
        from: parseDateParam(query.from, "from"),
        to: parseDateParam(query.to, "to"),
        groupBy: query.groupBy as "day" | "week" | "month" | undefined,
      });
    },
  );

  app.get(
    "/api/reports/top-expensive-ingredients",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const query = request.query as Record<string, unknown>;
      const limit = query.limit !== undefined ? Number(query.limit) : undefined;
      return getTopExpensiveIngredients(db, {
        from: parseDateParam(query.from, "from"),
        to: parseDateParam(query.to, "to"),
        limit: Number.isFinite(limit) ? limit : undefined,
        sortBy: query.sortBy as "totalSpent" | "pricePerBaseUnit" | undefined,
      });
    },
  );

  app.get(
    "/api/reports/production",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const query = request.query as Record<string, unknown>;
      const { page, pageSize } = parsePagination(query);
      const result = await getProductionReport(db, {
        from: parseDateParam(query.from, "from"),
        to: parseDateParam(query.to, "to"),
        recipeId: typeof query.recipeId === "string" ? query.recipeId : undefined,
        page,
        pageSize,
      });
      return {
        from: result.from,
        to: result.to,
        data: result.data,
        pagination: buildPaginationMeta(page, pageSize, result.totalItems),
      };
    },
  );

  app.get(
    "/api/reports/inventory-status",
    { preHandler: [authenticate] },
    async (request) => {
      const query = request.query as Record<string, unknown>;
      const { page, pageSize } = parsePagination(query);
      const { data, totalItems } = await getInventoryStatusReport(db, {
        categoryId: typeof query.categoryId === "string" ? query.categoryId : undefined,
        page,
        pageSize,
      });
      return { data, pagination: buildPaginationMeta(page, pageSize, totalItems) };
    },
  );

  // Reporte de rentabilidad por producto (RF-012, SDD-03 §6.2, SDD-07 CU6) —
  // no listado como ruta individual en SDD-05 §11 (que solo detalla costos,
  // top-ingredientes, producción e inventario), pero exigido explícitamente
  // por SDD-07 CU6 y los tests E2E de SDD-09 §9. Misma restricción de rol
  // que el resto de reportes financieros (SDD-05 §11 nota de autorización).
  app.get(
    "/api/reports/profitability",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const query = request.query as Record<string, unknown>;
      return getProfitabilityReport(db, {
        from: parseDateParam(query.from, "from"),
        to: parseDateParam(query.to, "to"),
        productId: typeof query.productId === "string" ? query.productId : undefined,
      });
    },
  );
}
