import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { categories, ingredients, products, recipeIngredients, recipes } from "../db/schema/index";
import { ApiError, isUniqueViolation } from "../lib/errors";
import {
  MAX_NESTING_DEPTH,
  convertUnit,
  getSubRecipeDepth,
  wouldCreateCycle,
  type BaseUnit,
  type RecipeUnit,
} from "./costingService";
import type { RawRecipeIngredientLine } from "./validation/recipeValidation";

export interface CreateRecipeInput {
  name: string;
  categoryId?: string | null;
  description?: string | null;
  yieldQuantity: string;
  yieldUnit: string;
  wastePercent: string;
  prepTimeMinutes?: number | null;
  bakeTimeMinutes?: number | null;
  instructions?: string | null;
  imageUrl?: string | null;
  ingredients: RawRecipeIngredientLine[];
}

export type UpdateRecipeInput = Partial<CreateRecipeInput>;

async function assertRecipeNameNotDuplicate(db: Database, name: string, excludeId?: string) {
  const rows = await db
    .select({ id: recipes.id, name: recipes.name })
    .from(recipes)
    .where(and(eq(recipes.isDeleted, false), ilike(recipes.name, name)));
  const conflict = rows.find((r) => r.id !== excludeId);
  if (conflict) {
    throw duplicateRecipeNameError(name);
  }
}

function duplicateRecipeNameError(name: string) {
  return ApiError.conflict(`Ya existe una receta llamada "${name}".`, [
    { field: "name", message: `Ya existe una receta llamada "${name}".` },
  ]);
}

// Ver nota equivalente en `ingredientService.ts`: el SELECT previo es un fast
// path, el guardián real es el índice único `recipes_active_name_lower_unique`
// (`db/schema/recipes.ts`). Esto traduce la violación (Postgres 23505) al
// mismo mensaje de negocio existente.
function withDuplicateNameTranslation<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return fn().catch((err) => {
    if (isUniqueViolation(err)) {
      throw duplicateRecipeNameError(name);
    }
    throw err;
  });
}

async function assertCategoryValid(db: Database, categoryId: string | null | undefined) {
  if (!categoryId) return;
  const [cat] = await db.select().from(categories).where(eq(categories.id, categoryId));
  if (!cat || cat.kind !== "receta") {
    throw ApiError.validation("Esa categoría no existe. Elige una de la lista o crea una nueva.", [
      { field: "categoryId", message: "Esa categoría no existe. Elige una de la lista o crea una nueva." },
    ]);
  }
}

interface ResolvedLine {
  ingredientId: string | null;
  subRecipeId: string | null;
  quantity: string;
  unit: string;
}

/**
 * Valida y resuelve las líneas de `recipe_ingredients` de una receta (SDD-06
 * §4). `recipeId` es `null` en creación (aún no existe id, ver SDD-05 §6.3
 * nota sobre ciclos) y el id real en edición (habilita detección de ciclos
 * y auto-referencia, SDD-05 §6.4).
 */
export async function resolveAndValidateIngredientLines(
  db: Database,
  recipeId: string | null,
  rawLines: RawRecipeIngredientLine[],
): Promise<ResolvedLine[]> {
  const seen = new Set<string>();
  const resolved: ResolvedLine[] = [];

  for (const line of rawLines) {
    if (line.ingredientId) {
      const dedupeKey = `ingredient:${line.ingredientId}`;
      if (seen.has(dedupeKey)) {
        const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, line.ingredientId));
        const name = ingredient?.name ?? "Ingrediente";
        throw ApiError.validation(
          `"${name}" ya está agregado a esta receta. Edita la cantidad existente en vez de agregarlo de nuevo.`,
          [{ field: "ingredientId", message: `"${name}" ya está agregado a esta receta.` }],
        );
      }
      seen.add(dedupeKey);

      const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, line.ingredientId));
      if (!ingredient || !ingredient.isActive) {
        throw ApiError.notFound("El ingrediente seleccionado ya no está disponible. Elige otro.");
      }

      // RI-008: la unidad debe ser convertible a la unidad base del ingrediente.
      convertUnit(Number(line.quantity), line.unit as RecipeUnit, ingredient.baseUnit as BaseUnit, ingredient.name);

      resolved.push({
        ingredientId: ingredient.id,
        subRecipeId: null,
        quantity: line.quantity,
        unit: line.unit,
      });
    } else if (line.subRecipeId) {
      const dedupeKey = `sub:${line.subRecipeId}`;
      if (seen.has(dedupeKey)) {
        throw ApiError.validation(
          "Esta sub-receta ya está agregada a esta receta. Edita la cantidad existente en vez de agregarla de nuevo.",
          [{ field: "subRecipeId", message: "Esta sub-receta ya está agregada a esta receta." }],
        );
      }
      seen.add(dedupeKey);

      if (recipeId && line.subRecipeId === recipeId) {
        throw ApiError.validation("Una receta no puede usarse como ingrediente de sí misma.", [
          { field: "subRecipeId", message: "Una receta no puede usarse como ingrediente de sí misma." },
        ]);
      }

      const [subRecipe] = await db.select().from(recipes).where(eq(recipes.id, line.subRecipeId));
      if (!subRecipe || subRecipe.isDeleted) {
        throw ApiError.notFound("La receta seleccionada como sub-receta ya no está disponible.");
      }

      if (recipeId) {
        const creates = await wouldCreateCycle(db, recipeId, line.subRecipeId);
        if (creates) {
          throw ApiError.conflict("Esta combinación crearía una referencia circular entre recetas", [
            {
              field: "subRecipeId",
              message: `No se puede usar "${subRecipe.name}" aquí porque ya usa a esta receta dentro de sus propios ingredientes. Esto crearía una receta que se referencia a sí misma en un círculo.`,
            },
          ]);
        }
      }

      const subDepth = await getSubRecipeDepth(db, line.subRecipeId);
      if (subDepth + 1 > MAX_NESTING_DEPTH) {
        throw ApiError.validation("Esta receta tiene demasiados niveles de sub-recetas anidadas.", [
          { field: "subRecipeId", message: "Esta receta tiene demasiados niveles de sub-recetas anidadas." },
        ]);
      }

      resolved.push({
        ingredientId: null,
        subRecipeId: subRecipe.id,
        quantity: line.quantity,
        unit: line.unit,
      });
    }
  }

  return resolved;
}

export async function createRecipe(db: Database, input: CreateRecipeInput) {
  await assertRecipeNameNotDuplicate(db, input.name);
  await assertCategoryValid(db, input.categoryId);
  const resolvedLines = await resolveAndValidateIngredientLines(db, null, input.ingredients);

  return withDuplicateNameTranslation(input.name, () =>
    db.transaction(async (tx) => {
      const [recipe] = await tx
        .insert(recipes)
        .values({
          name: input.name,
          categoryId: input.categoryId ?? null,
          description: input.description ?? null,
          yieldQuantity: input.yieldQuantity,
          yieldUnit: input.yieldUnit,
          wastePercent: input.wastePercent,
          prepTimeMinutes: input.prepTimeMinutes ?? null,
          bakeTimeMinutes: input.bakeTimeMinutes ?? null,
          instructions: input.instructions ?? null,
          imageUrl: input.imageUrl ?? null,
        })
        .returning();

      for (const line of resolvedLines) {
        await tx.insert(recipeIngredients).values({
          recipeId: recipe.id,
          ingredientId: line.ingredientId,
          subRecipeId: line.subRecipeId,
          quantity: line.quantity,
          unit: line.unit as RecipeUnit,
        });
      }

      return getRecipeById(tx as unknown as Database, recipe.id);
    }),
  );
}

export async function updateRecipe(db: Database, id: string, input: UpdateRecipeInput) {
  const [existing] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!existing || existing.isDeleted) {
    throw ApiError.notFound("Receta no encontrada");
  }

  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    await assertRecipeNameNotDuplicate(db, input.name, id);
  }
  if (input.categoryId !== undefined) await assertCategoryValid(db, input.categoryId);

  let resolvedLines: ResolvedLine[] | null = null;
  if (input.ingredients !== undefined) {
    resolvedLines = await resolveAndValidateIngredientLines(db, id, input.ingredients);
  }

  return withDuplicateNameTranslation(input.name ?? existing.name, () =>
    db.transaction(async (tx) => {
      await tx
        .update(recipes)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.yieldQuantity !== undefined ? { yieldQuantity: input.yieldQuantity } : {}),
          ...(input.yieldUnit !== undefined ? { yieldUnit: input.yieldUnit } : {}),
          ...(input.wastePercent !== undefined ? { wastePercent: input.wastePercent } : {}),
          ...(input.prepTimeMinutes !== undefined ? { prepTimeMinutes: input.prepTimeMinutes } : {}),
          ...(input.bakeTimeMinutes !== undefined ? { bakeTimeMinutes: input.bakeTimeMinutes } : {}),
          ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          updatedAt: new Date(),
        })
        .where(eq(recipes.id, id));

      if (resolvedLines) {
        await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
        for (const line of resolvedLines) {
          await tx.insert(recipeIngredients).values({
            recipeId: id,
            ingredientId: line.ingredientId,
            subRecipeId: line.subRecipeId,
            quantity: line.quantity,
            unit: line.unit as RecipeUnit,
          });
        }
      }

      return getRecipeById(tx as unknown as Database, id);
    }),
  );
}

async function toApiShape(db: Database, row: typeof recipes.$inferSelect) {
  let categoryName: string | null = null;
  if (row.categoryId) {
    const [cat] = await db.select().from(categories).where(eq(categories.id, row.categoryId));
    categoryName = cat?.name ?? null;
  }

  const lines = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, row.id));
  const ingredientsOut = await Promise.all(
    lines.map(async (line) => {
      if (line.ingredientId) {
        const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, line.ingredientId));
        return {
          id: line.id,
          type: "ingredient" as const,
          ingredientId: line.ingredientId,
          ingredientName: ingredient?.name ?? null,
          subRecipeId: null,
          subRecipeName: null,
          quantity: line.quantity,
          unit: line.unit,
        };
      }
      const [subRecipe] = await db.select().from(recipes).where(eq(recipes.id, line.subRecipeId!));
      return {
        id: line.id,
        type: "sub_recipe" as const,
        ingredientId: null,
        ingredientName: null,
        subRecipeId: line.subRecipeId,
        subRecipeName: subRecipe?.name ?? null,
        quantity: line.quantity,
        unit: line.unit,
      };
    }),
  );

  return {
    id: row.id,
    name: row.name,
    categoryId: row.categoryId,
    categoryName,
    description: row.description,
    yieldQuantity: row.yieldQuantity,
    yieldUnit: row.yieldUnit,
    wastePercent: row.wastePercent,
    prepTimeMinutes: row.prepTimeMinutes,
    bakeTimeMinutes: row.bakeTimeMinutes,
    instructions: row.instructions,
    imageUrl: row.imageUrl,
    isDeleted: row.isDeleted,
    ingredients: ingredientsOut,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getRecipeById(db: Database, id: string, includeDeleted = false) {
  const [row] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!row) {
    throw ApiError.notFound("Receta no encontrada");
  }
  if (row.isDeleted && !includeDeleted) {
    throw ApiError.notFound("Receta no encontrada");
  }
  return toApiShape(db, row);
}

export interface ListRecipesParams {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
  includeDeleted?: boolean;
  sortBy?: "name" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export async function listRecipes(db: Database, params: ListRecipesParams) {
  const conditions = [];
  if (!params.includeDeleted) {
    conditions.push(eq(recipes.isDeleted, false));
  }
  if (params.search) {
    conditions.push(ilike(recipes.name, `%${params.search}%`));
  }
  if (params.categoryId) {
    conditions.push(eq(recipes.categoryId, params.categoryId));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const sortColumn = params.sortBy === "createdAt" ? recipes.createdAt : recipes.name;
  const orderFn = params.sortOrder === "desc" ? desc : asc;

  let query = db.select().from(recipes).$dynamic();
  if (whereClause) query = query.where(whereClause);
  const rows = await query
    .orderBy(orderFn(sortColumn))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  let countQuery = db.select({ count: sql<number>`count(*)::int` }).from(recipes).$dynamic();
  if (whereClause) countQuery = countQuery.where(whereClause);
  const [{ count }] = await countQuery;

  const data = await Promise.all(
    rows.map(async (row) => {
      let categoryName: string | null = null;
      if (row.categoryId) {
        const [cat] = await db.select().from(categories).where(eq(categories.id, row.categoryId));
        categoryName = cat?.name ?? null;
      }
      return {
        id: row.id,
        name: row.name,
        categoryId: row.categoryId,
        categoryName,
        yieldQuantity: row.yieldQuantity,
        yieldUnit: row.yieldUnit,
        wastePercent: row.wastePercent,
        prepTimeMinutes: row.prepTimeMinutes,
        bakeTimeMinutes: row.bakeTimeMinutes,
        imageUrl: row.imageUrl,
        isDeleted: row.isDeleted,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    }),
  );

  return { data, totalItems: count };
}

export async function deleteRecipe(db: Database, id: string) {
  const [existing] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!existing || existing.isDeleted) {
    throw ApiError.notFound("Receta no encontrada");
  }

  const usedAsSubRecipe = await db
    .select({ recipeName: recipes.name })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipeIngredients.recipeId, recipes.id))
    .where(and(eq(recipeIngredients.subRecipeId, id), eq(recipes.isDeleted, false)));

  if (usedAsSubRecipe.length > 0) {
    const name = usedAsSubRecipe[0].recipeName;
    throw ApiError.conflict(`No se puede eliminar: se usa como sub-receta en "${name}"`);
  }

  const activeProducts = await db
    .select()
    .from(products)
    .where(and(eq(products.recipeId, id), eq(products.isActive, true)));

  if (activeProducts.length > 0) {
    throw ApiError.conflict(`No se puede eliminar: el producto "${activeProducts[0].name}" usa esta receta`);
  }

  await db.update(recipes).set({ isDeleted: true, updatedAt: new Date() }).where(eq(recipes.id, id));
  return { message: "Receta eliminada", id };
}
