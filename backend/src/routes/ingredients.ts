import type { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { authenticate, requireRole } from "../lib/auth";
import { ApiError } from "../lib/errors";
import { buildPaginationMeta, parsePagination } from "../lib/pagination";
import {
  createIngredient,
  deactivateIngredient,
  getIngredientById,
  listIngredients,
  listLowStock,
  registerPurchase,
  updateIngredient,
} from "../services/ingredientService";
import { getCurrentPrice, insertPrice, listPriceHistory } from "../services/priceHistoryService";
import {
  validateBaseUnit,
  validateCurrentStock,
  validateEffectiveAt,
  validateImageUrl,
  validateMinStock,
  validateName,
  validatePricePerBaseUnit,
  validateQuantityBaseUnit,
} from "../services/validation/ingredientValidation";

export async function ingredientRoutes(app: FastifyInstance) {
  app.get("/api/ingredients", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const { page, pageSize } = parsePagination(query);
    const { data, totalItems } = await listIngredients(db, {
      page,
      pageSize,
      search: typeof query.search === "string" ? query.search : undefined,
      categoryId: typeof query.categoryId === "string" ? query.categoryId : undefined,
      supplierId: typeof query.supplierId === "string" ? query.supplierId : undefined,
      isActive: query.isActive as "true" | "false" | "all" | undefined,
      sortBy: query.sortBy as "name" | "createdAt" | "currentStock" | undefined,
      sortOrder: query.sortOrder as "asc" | "desc" | undefined,
    });
    return { data, pagination: buildPaginationMeta(page, pageSize, totalItems) };
  });

  app.get("/api/ingredients/low-stock", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const { page, pageSize } = parsePagination(query);
    const { data, totalItems } = await listLowStock(db, { page, pageSize });
    return { data, pagination: buildPaginationMeta(page, pageSize, totalItems) };
  });

  app.get("/api/ingredients/:id", { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    return getIngredientById(db, id);
  });

  app.post(
    "/api/ingredients",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;
      const name = validateName(body.name);
      const baseUnit = validateBaseUnit(body.baseUnit);
      const initialPricePerBaseUnit = validatePricePerBaseUnit(body.initialPricePerBaseUnit);
      const currentStock = validateCurrentStock(body.currentStock);
      const minStock = validateMinStock(body.minStock);
      const imageUrl = validateImageUrl(body.imageUrl);

      const created = await createIngredient(db, {
        name,
        categoryId: (body.categoryId as string) ?? null,
        baseUnit,
        initialPricePerBaseUnit,
        currentStock,
        minStock,
        supplierId: (body.supplierId as string) ?? null,
        imageUrl,
        createdBy: request.user!.id,
      });
      reply.code(201);
      return created;
    },
  );

  app.put(
    "/api/ingredients/:id",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      for (const forbidden of ["currentStock", "initialPricePerBaseUnit", "pricePerBaseUnit"]) {
        if (body[forbidden] !== undefined) {
          throw ApiError.validation("El stock se actualiza vía /purchase o movimientos, no aquí", [
            { field: forbidden, message: "El stock se actualiza vía /purchase o movimientos, no aquí" },
          ]);
        }
      }

      const updateInput: Record<string, unknown> = {};
      if (body.name !== undefined) updateInput.name = validateName(body.name);
      if (body.baseUnit !== undefined) updateInput.baseUnit = validateBaseUnit(body.baseUnit);
      if (body.minStock !== undefined) updateInput.minStock = validateMinStock(body.minStock);
      if (body.categoryId !== undefined) updateInput.categoryId = body.categoryId;
      if (body.supplierId !== undefined) updateInput.supplierId = body.supplierId;
      if (body.imageUrl !== undefined) updateInput.imageUrl = validateImageUrl(body.imageUrl);
      if (body.isActive !== undefined) updateInput.isActive = body.isActive;

      return updateIngredient(db, id, updateInput);
    },
  );

  app.delete(
    "/api/ingredients/:id",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return deactivateIngredient(db, id);
    },
  );

  app.post(
    "/api/ingredients/:id/purchase",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const quantityBaseUnit = validateQuantityBaseUnit(body.quantityBaseUnit);
      let alsoUpdatePrice: { pricePerBaseUnit: string } | null = null;
      if (body.alsoUpdatePrice && typeof body.alsoUpdatePrice === "object") {
        const price = validatePricePerBaseUnit((body.alsoUpdatePrice as Record<string, unknown>).pricePerBaseUnit);
        alsoUpdatePrice = { pricePerBaseUnit: price };
      }

      const result = await registerPurchase(db, id, {
        quantityBaseUnit,
        note: (body.note as string) ?? null,
        alsoUpdatePrice,
        createdBy: request.user!.id,
      });
      reply.code(201);
      return result;
    },
  );

  app.post(
    "/api/ingredients/:id/price",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      await getIngredientById(db, id); // 404 if not found

      const pricePerBaseUnit = validatePricePerBaseUnit(body.pricePerBaseUnit);
      const effectiveAt = validateEffectiveAt(body.effectiveAt, { allowFuture: false });

      const row = await insertPrice(db, {
        ingredientId: id,
        pricePerBaseUnit,
        effectiveAt,
        createdBy: request.user!.id,
      });
      reply.code(201);
      return row;
    },
  );

  app.get("/api/ingredients/:id/price-history", { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, unknown>;
    const { page, pageSize } = parsePagination(query);

    await getIngredientById(db, id); // 404 if not found

    const from = typeof query.from === "string" ? new Date(query.from) : undefined;
    const to = typeof query.to === "string" ? new Date(query.to) : undefined;

    const { rows, totalItems } = await listPriceHistory(db, { ingredientId: id, page, pageSize, from, to });
    return { data: rows, pagination: buildPaginationMeta(page, pageSize, totalItems) };
  });
}
