import type { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { authenticate, requireRole } from "../lib/auth";
import { ApiError } from "../lib/errors";
import { buildPaginationMeta, parsePagination } from "../lib/pagination";
import {
  createProduct,
  deactivateProduct,
  getProductById,
  getSuggestedPrice,
  listProducts,
  setProductPrice,
  updateProduct,
} from "../services/productService";
import { validateMarginParam, validateProductName, validateSalePrice } from "../services/validation/recipeValidation";

export async function productRoutes(app: FastifyInstance) {
  app.get("/api/products", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const { page, pageSize } = parsePagination(query);
    const { data, totalItems } = await listProducts(db, {
      page,
      pageSize,
      search: typeof query.search === "string" ? query.search : undefined,
      recipeId: typeof query.recipeId === "string" ? query.recipeId : undefined,
      isActive: query.isActive as "true" | "false" | "all" | undefined,
    });
    return { data, pagination: buildPaginationMeta(page, pageSize, totalItems) };
  });

  app.get("/api/products/:id", { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    return getProductById(db, id);
  });

  app.get("/api/products/:id/suggested-price", { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, unknown>;
    const margin = validateMarginParam(query.margin);

    let date: Date | undefined;
    if (typeof query.date === "string" && query.date.length > 0) {
      date = new Date(query.date);
      if (Number.isNaN(date.getTime())) {
        throw ApiError.validation("La fecha de vigencia no es válida.", [
          { field: "date", message: "La fecha de vigencia no es válida." },
        ]);
      }
    }

    return getSuggestedPrice(db, id, { margin, date });
  });

  app.post(
    "/api/products",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const name = validateProductName(body.name);
      const salePrice = validateSalePrice(body.salePrice, { required: false });

      if (typeof body.recipeId !== "string" || body.recipeId.length === 0) {
        throw ApiError.validation("Selecciona una receta válida para este producto.", [
          { field: "recipeId", message: "Selecciona una receta válida para este producto." },
        ]);
      }

      const created = await createProduct(db, { recipeId: body.recipeId, name, salePrice });
      reply.code(201);
      return created;
    },
  );

  app.put(
    "/api/products/:id",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const updateInput: Record<string, unknown> = {};
      if (body.name !== undefined) updateInput.name = validateProductName(body.name);
      if (body.recipeId !== undefined) updateInput.recipeId = body.recipeId;
      if (body.isActive !== undefined) updateInput.isActive = body.isActive;

      return updateProduct(db, id, updateInput);
    },
  );

  app.put(
    "/api/products/:id/price",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const salePrice = validateSalePrice(body.salePrice, { required: true });
      return setProductPrice(db, id, salePrice as string);
    },
  );

  app.delete(
    "/api/products/:id",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return deactivateProduct(db, id);
    },
  );
}
