import type { FastifyInstance } from "fastify";
import { db } from "../db/client";
import { authenticate, requireRole } from "../lib/auth";
import { ApiError } from "../lib/errors";
import { buildPaginationMeta, parsePagination } from "../lib/pagination";
import { getRecipeCostPreview } from "../services/recipeCostService";
import {
  createRecipe,
  deleteRecipe,
  getRecipeById,
  listRecipes,
  updateRecipe,
} from "../services/recipeService";
import {
  validateDescription,
  validateImageUrl,
  validateInstructions,
  validateIngredientsArrayShape,
  validateMinutes,
  validateRecipeIngredientLine,
  validateRecipeName,
  validateWastePercent,
  validateYieldQuantity,
  validateYieldUnit,
} from "../services/validation/recipeValidation";

function validateIngredientsBody(body: Record<string, unknown>) {
  const rawArray = validateIngredientsArrayShape(body.ingredients);
  return rawArray.map((item, index) => validateRecipeIngredientLine(item, index));
}

export async function recipeRoutes(app: FastifyInstance) {
  app.get("/api/recipes", { preHandler: [authenticate] }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const { page, pageSize } = parsePagination(query);
    const { data, totalItems } = await listRecipes(db, {
      page,
      pageSize,
      search: typeof query.search === "string" ? query.search : undefined,
      categoryId: typeof query.categoryId === "string" ? query.categoryId : undefined,
      includeDeleted: query.includeDeleted === "true" || query.includeDeleted === true,
      sortBy: query.sortBy as "name" | "createdAt" | undefined,
      sortOrder: query.sortOrder as "asc" | "desc" | undefined,
    });
    return { data, pagination: buildPaginationMeta(page, pageSize, totalItems) };
  });

  app.get("/api/recipes/:id", { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, unknown>;
    const includeDeleted = query.includeDeleted === "true" || query.includeDeleted === true;
    return getRecipeById(db, id, includeDeleted);
  });

  app.get("/api/recipes/:id/cost", { preHandler: [authenticate] }, async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, unknown>;

    let date: Date | undefined;
    if (typeof query.date === "string" && query.date.length > 0) {
      date = new Date(query.date);
      if (Number.isNaN(date.getTime())) {
        throw ApiError.validation("La fecha de vigencia no es válida.", [
          { field: "date", message: "La fecha de vigencia no es válida." },
        ]);
      }
    }

    let quantity: number | undefined;
    if (typeof query.quantity === "string" && query.quantity.length > 0) {
      quantity = Number(query.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw ApiError.validation("Ingresa cuántas unidades quieres producir (debe ser más de cero).", [
          { field: "quantity", message: "Ingresa cuántas unidades quieres producir (debe ser más de cero)." },
        ]);
      }
    }

    return getRecipeCostPreview(db, id, { date, quantity });
  });

  app.post(
    "/api/recipes",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>;

      const name = validateRecipeName(body.name);
      const description = validateDescription(body.description);
      const yieldQuantity = validateYieldQuantity(body.yieldQuantity);
      const yieldUnit = validateYieldUnit(body.yieldUnit);
      const wastePercent = validateWastePercent(body.wastePercent);
      const prepTimeMinutes = validateMinutes(body.prepTimeMinutes, "prepTimeMinutes");
      const bakeTimeMinutes = validateMinutes(body.bakeTimeMinutes, "bakeTimeMinutes");
      const instructions = validateInstructions(body.instructions);
      const imageUrl = validateImageUrl(body.imageUrl);
      const ingredientLines = validateIngredientsBody(body);

      const created = await createRecipe(db, {
        name,
        categoryId: (body.categoryId as string) ?? null,
        description,
        yieldQuantity,
        yieldUnit,
        wastePercent,
        prepTimeMinutes,
        bakeTimeMinutes,
        instructions,
        imageUrl,
        ingredients: ingredientLines,
      });
      reply.code(201);
      return created;
    },
  );

  app.put(
    "/api/recipes/:id",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      const updateInput: Record<string, unknown> = {};
      if (body.name !== undefined) updateInput.name = validateRecipeName(body.name);
      if (body.categoryId !== undefined) updateInput.categoryId = body.categoryId;
      if (body.description !== undefined) updateInput.description = validateDescription(body.description);
      if (body.yieldQuantity !== undefined) updateInput.yieldQuantity = validateYieldQuantity(body.yieldQuantity);
      if (body.yieldUnit !== undefined) updateInput.yieldUnit = validateYieldUnit(body.yieldUnit);
      if (body.wastePercent !== undefined) updateInput.wastePercent = validateWastePercent(body.wastePercent);
      if (body.prepTimeMinutes !== undefined)
        updateInput.prepTimeMinutes = validateMinutes(body.prepTimeMinutes, "prepTimeMinutes");
      if (body.bakeTimeMinutes !== undefined)
        updateInput.bakeTimeMinutes = validateMinutes(body.bakeTimeMinutes, "bakeTimeMinutes");
      if (body.instructions !== undefined) updateInput.instructions = validateInstructions(body.instructions);
      if (body.imageUrl !== undefined) updateInput.imageUrl = validateImageUrl(body.imageUrl);
      if (body.ingredients !== undefined) updateInput.ingredients = validateIngredientsBody(body);

      return updateRecipe(db, id, updateInput);
    },
  );

  app.delete(
    "/api/recipes/:id",
    { preHandler: [authenticate, requireRole("admin", "dueño")] },
    async (request) => {
      const { id } = request.params as { id: string };
      return deleteRecipe(db, id);
    },
  );
}
