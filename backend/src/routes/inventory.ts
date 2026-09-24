import type { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { authenticate } from "../lib/auth";
import { ApiError } from "../lib/errors";
import { buildPaginationMeta, parsePagination } from "../lib/pagination";
import { getInventoryOverview, listMovements } from "../services/inventoryService";

const MOVEMENT_TYPES = ["compra", "uso_produccion", "ajuste", "merma"] as const;

export async function inventoryRoutes(app: FastifyInstance) {
  app.get("/api/inventory", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const { page, pageSize } = parsePagination(query);
    const { data, totalItems, summary } = await getInventoryOverview(db, {
      page,
      pageSize,
      categoryId: typeof query.categoryId === "string" ? query.categoryId : undefined,
      belowMinOnly: query.belowMinOnly === "true" || query.belowMinOnly === true,
      sortBy: query.sortBy as "name" | "currentStock" | "stockValue" | undefined,
    });
    return { data, pagination: buildPaginationMeta(page, pageSize, totalItems), summary };
  });

  app.get("/api/inventory/movements", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const { page, pageSize } = parsePagination(query);

    let movementType: (typeof MOVEMENT_TYPES)[number] | undefined;
    if (query.movementType !== undefined) {
      if (typeof query.movementType !== "string" || !MOVEMENT_TYPES.includes(query.movementType as never)) {
        throw ApiError.validation("El tipo de movimiento indicado no es válido.", [
          { field: "movementType", message: "El tipo de movimiento indicado no es válido." },
        ]);
      }
      movementType = query.movementType as (typeof MOVEMENT_TYPES)[number];
    }

    const { data, totalItems } = await listMovements(db, {
      page,
      pageSize,
      ingredientId: typeof query.ingredientId === "string" ? query.ingredientId : undefined,
      movementType,
      from: typeof query.from === "string" ? new Date(query.from) : undefined,
      to: typeof query.to === "string" ? new Date(query.to) : undefined,
      sortOrder: query.sortOrder as "asc" | "desc" | undefined,
    });
    return { data, pagination: buildPaginationMeta(page, pageSize, totalItems) };
  });
}
