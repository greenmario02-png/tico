import type { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { authenticate, requireRole } from "../lib/auth";
import { ApiError } from "../lib/errors";
import { buildPaginationMeta, parsePagination } from "../lib/pagination";
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  updateCategory,
} from "../services/categoryService";
import { validateCategoryKind, validateCategoryName } from "../services/validation/categoryValidation";

export async function categoryRoutes(app: FastifyInstance) {
  app.get("/api/categories", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const { page, pageSize } = parsePagination(query);
    const kind =
      query.kind === "ingrediente" || query.kind === "receta" ? (query.kind as "ingrediente" | "receta") : undefined;
    const { data, totalItems } = await listCategories(db, { page, pageSize, kind });
    return { data, pagination: buildPaginationMeta(page, pageSize, totalItems) };
  });

  app.get("/api/categories/:id", { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    return getCategoryById(db, id);
  });

  app.post(
    "/api/categories",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const name = validateCategoryName(body.name);
      const kind = validateCategoryKind(body.kind);

      const created = await createCategory(db, { name, kind });
      reply.code(201);
      return created;
    },
  );

  app.put(
    "/api/categories/:id",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      if (body.kind !== undefined) {
        throw ApiError.validation("El tipo de categoría no se puede modificar después de crearla.", [
          { field: "kind", message: "El tipo de categoría no se puede modificar después de crearla." },
        ]);
      }

      const updateInput: Record<string, unknown> = {};
      if (body.name !== undefined) updateInput.name = validateCategoryName(body.name);

      return updateCategory(db, id, updateInput);
    },
  );

  app.delete(
    "/api/categories/:id",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return deleteCategory(db, id);
    },
  );
}
