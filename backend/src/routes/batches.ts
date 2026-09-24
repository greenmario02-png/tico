import type { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { authenticate, requireRole } from "../lib/auth";
import { ApiError } from "../lib/errors";
import { buildPaginationMeta, parsePagination } from "../lib/pagination";
import { getBatchById, listBatches, produceBatch } from "../services/batchService";
import { validateNotes, validateRecipeIdField, validateRequestedUnits } from "../services/validation/batchValidation";

export async function batchRoutes(app: FastifyInstance) {
  app.get("/api/batches", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const { page, pageSize } = parsePagination(query);
    const { data, totalItems } = await listBatches(db, {
      page,
      pageSize,
      recipeId: typeof query.recipeId === "string" ? query.recipeId : undefined,
      productId: typeof query.productId === "string" ? query.productId : undefined,
      createdBy: typeof query.createdBy === "string" ? query.createdBy : undefined,
      from: typeof query.from === "string" ? new Date(query.from) : undefined,
      to: typeof query.to === "string" ? new Date(query.to) : undefined,
      sortOrder: query.sortOrder as "asc" | "desc" | undefined,
    });
    return { data, pagination: buildPaginationMeta(page, pageSize, totalItems) };
  });

  app.get("/api/batches/:id", { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    return getBatchById(db, id);
  });

  app.post(
    "/api/batches",
    { preHandler: [authenticate, requireRole("admin", "dueño", "operario")] },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;

      const recipeId = validateRecipeIdField(body.recipeId);
      const requestedUnits = validateRequestedUnits(body.requestedUnits);
      const notes = validateNotes(body.notes);

      if (body.productId !== undefined && body.productId !== null && typeof body.productId !== "string") {
        throw ApiError.validation("El producto seleccionado no corresponde a esta receta.", [
          { field: "productId", message: "El producto seleccionado no corresponde a esta receta." },
        ]);
      }

      const created = await produceBatch(db, {
        recipeId,
        requestedUnits,
        productId: (body.productId as string) ?? null,
        notes,
        createdBy: request.user!.id,
      });
      reply.code(201);
      return created;
    },
  );
}
