import { and, eq, isNotNull } from "drizzle-orm";
import type { Database } from "../db/client";
import { ingredients, recipeIngredients, recipes } from "../db/schema/index";
import { ApiError } from "../lib/errors";
import { getCurrentPrice } from "./priceHistoryService";

/**
 * Algoritmos de SDD-04: costeo recursivo de recetas (§1), conversión de
 * unidades (§2), ajuste por merma (§3) y fórmulas de margen (§6).
 *
 * Las funciones "puras" (sin I/O) están separadas de la orquestación con DB
 * para poder testearlas unitariamente sin base de datos (ver SDD-09 §1/§2/§5).
 */

// SDD-10 §2.3
export const MAX_RECIPE_INGREDIENTS = 50;
export const MAX_NESTING_DEPTH = 5;

export type RecipeUnit =
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "pieza"
  | "docena"
  | "cucharada"
  | "cucharadita"
  | "taza";
export type BaseUnit = "g" | "ml" | "pieza";

// SDD-04 §2 — TABLA_CONVERSION_A_ANCLA
const CONVERSION_TABLE: Record<RecipeUnit, { factor: number; anchor: BaseUnit }> = {
  g: { factor: 1, anchor: "g" },
  kg: { factor: 1000, anchor: "g" },
  ml: { factor: 1, anchor: "ml" },
  l: { factor: 1000, anchor: "ml" },
  taza: { factor: 240, anchor: "ml" },
  cucharada: { factor: 15, anchor: "ml" },
  cucharadita: { factor: 5, anchor: "ml" },
  pieza: { factor: 1, anchor: "pieza" },
  docena: { factor: 12, anchor: "pieza" },
};

const MAGNITUDE_LABEL: Record<BaseUnit, string> = {
  g: "peso (gramos o kilos)",
  ml: "volumen (mililitros, litros, tazas, cucharadas o cucharaditas)",
  pieza: "conteo (piezas o docenas)",
};

/** SDD-04 §2: convierte una cantidad de la unidad de receta a la unidad base del ingrediente. */
export function convertUnit(
  quantity: number,
  fromUnit: RecipeUnit,
  toBaseUnit: BaseUnit,
  ingredientName?: string,
): number {
  const entry = CONVERSION_TABLE[fromUnit];
  if (!entry || entry.anchor !== toBaseUnit) {
    const message = ingredientName
      ? `No puedes usar "${fromUnit}" con "${ingredientName}" porque son magnitudes distintas (por ejemplo, no se puede medir harina en mililitros). Elige una unidad de ${MAGNITUDE_LABEL[toBaseUnit]}.`
      : `La unidad "${fromUnit}" no se puede usar con este ingrediente (se mide en ${toBaseUnit}).`;
    throw ApiError.validation(message, [{ field: "unit", message }]);
  }
  return quantity * entry.factor;
}

/** SDD-04 §3: ajusta una cantidad por el porcentaje de merma de la receta. */
export function applyWaste(quantity: number, wastePercent: number): number {
  if (wastePercent < 0 || wastePercent >= 100) {
    throw ApiError.validation(
      "El porcentaje de merma debe estar entre 0 y 100, sin llegar a 100.",
      [{ field: "wastePercent", message: "El porcentaje de merma debe estar entre 0 y 100, sin llegar a 100." }],
    );
  }
  return quantity / (1 - wastePercent / 100);
}

export interface IngredientLineInput {
  type: "ingredient";
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: RecipeUnit;
  baseUnit: BaseUnit;
  pricePerBaseUnit: number;
}

export interface SubRecipeLineInput {
  type: "sub_recipe";
  subRecipeId: string;
  subRecipeName: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  subBreakdown?: CostDetail[];
}

export type CostLineInput = IngredientLineInput | SubRecipeLineInput;

export interface CostDetail {
  type: "ingredient" | "sub_recipe";
  id: string;
  name: string;
  quantityInRecipe: number;
  unitInRecipe: string;
  baseQuantity: number;
  quantityAfterWaste: number;
  unitPrice: number;
  lineCost: number;
  subBreakdown?: CostDetail[];
}

export interface RecipeCostResult {
  totalCost: number;
  costPerUnit: number;
  details: CostDetail[];
}

/** SDD-04 §1, pasos 5-7 — aritmética pura, sin I/O. */
export function computeRecipeCostPure(params: {
  yieldQuantity: number;
  wastePercent: number;
  lines: CostLineInput[];
}): RecipeCostResult {
  if (!(params.yieldQuantity > 0)) {
    throw ApiError.validation("Esta receta no tiene un rendimiento válido (debe ser mayor a cero).", [
      { field: "yieldQuantity", message: "Esta receta no tiene un rendimiento válido (debe ser mayor a cero)." },
    ]);
  }
  if (params.lines.length === 0) {
    throw ApiError.conflict("Esta receta no tiene ingredientes cargados.");
  }

  let totalCost = 0;
  const details: CostDetail[] = [];

  for (const line of params.lines) {
    if (!(line.quantity > 0)) {
      throw ApiError.validation("La cantidad debe ser mayor a cero.", [
        { field: "quantity", message: "La cantidad debe ser mayor a cero." },
      ]);
    }

    if (line.type === "ingredient") {
      const baseQuantity = convertUnit(line.quantity, line.unit, line.baseUnit, line.ingredientName);
      const quantityAfterWaste = applyWaste(baseQuantity, params.wastePercent);
      const lineCost = quantityAfterWaste * line.pricePerBaseUnit;
      totalCost += lineCost;
      details.push({
        type: "ingredient",
        id: line.ingredientId,
        name: line.ingredientName,
        quantityInRecipe: line.quantity,
        unitInRecipe: line.unit,
        baseQuantity,
        quantityAfterWaste,
        unitPrice: line.pricePerBaseUnit,
        lineCost,
      });
    } else {
      const quantityAfterWaste = applyWaste(line.quantity, params.wastePercent);
      const lineCost = quantityAfterWaste * line.costPerUnit;
      totalCost += lineCost;
      details.push({
        type: "sub_recipe",
        id: line.subRecipeId,
        name: line.subRecipeName,
        quantityInRecipe: line.quantity,
        unitInRecipe: line.unit,
        baseQuantity: line.quantity,
        quantityAfterWaste,
        unitPrice: line.costPerUnit,
        lineCost,
        subBreakdown: line.subBreakdown,
      });
    }
  }

  const costPerUnit = totalCost / params.yieldQuantity;
  return { totalCost, costPerUnit, details };
}

export interface CalculateRecipeCostOptions {
  asOf?: Date;
  visited?: Set<string>;
  depth?: number;
}

/**
 * SDD-04 §1 completo, con resolución recursiva de sub-recetas y precios
 * vigentes vía `priceHistoryService` (§8, ya implementado en Fase 1).
 */
export async function calculateRecipeCost(
  db: Database,
  recipeId: string,
  options: CalculateRecipeCostOptions = {},
): Promise<RecipeCostResult & { recipe: typeof recipes.$inferSelect }> {
  const asOf = options.asOf ?? new Date();
  const visited = options.visited ?? new Set<string>();
  const depth = options.depth ?? 0;

  if (visited.has(recipeId)) {
    throw ApiError.conflict("Esta receta se usa a sí misma indirectamente. Revisa las sub-recetas.");
  }
  if (depth > MAX_NESTING_DEPTH) {
    throw ApiError.validation("Esta receta tiene demasiados niveles de sub-recetas anidadas.", [
      { field: "subRecipeId", message: "Esta receta tiene demasiados niveles de sub-recetas anidadas." },
    ]);
  }
  const nextVisited = new Set(visited);
  nextVisited.add(recipeId);

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
  if (!recipe || recipe.isDeleted) {
    throw ApiError.notFound("Esta receta ya no existe.");
  }
  if (!(Number(recipe.yieldQuantity) > 0)) {
    throw ApiError.validation("Esta receta no tiene un rendimiento válido (debe ser mayor a cero).", [
      { field: "yieldQuantity", message: "Esta receta no tiene un rendimiento válido (debe ser mayor a cero)." },
    ]);
  }

  const lines = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));
  if (lines.length === 0) {
    throw ApiError.conflict("Esta receta no tiene ingredientes cargados.");
  }

  const resolvedLines: CostLineInput[] = [];
  for (const line of lines) {
    if (line.ingredientId) {
      const [ingredient] = await db.select().from(ingredients).where(eq(ingredients.id, line.ingredientId));
      if (!ingredient) {
        throw ApiError.notFound("El ingrediente seleccionado ya no está disponible. Elige otro.");
      }
      const priceRow = await getCurrentPrice(db, line.ingredientId, asOf);
      if (!priceRow) {
        throw ApiError.conflict(`No hay precio registrado para "${ingredient.name}" en la fecha indicada`, [
          { field: "ingredientId", message: ingredient.id },
        ]);
      }
      resolvedLines.push({
        type: "ingredient",
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        quantity: Number(line.quantity),
        unit: line.unit as RecipeUnit,
        baseUnit: ingredient.baseUnit as BaseUnit,
        pricePerBaseUnit: Number(priceRow.pricePerBaseUnit),
      });
    } else if (line.subRecipeId) {
      const subResult = await calculateRecipeCost(db, line.subRecipeId, {
        asOf,
        visited: nextVisited,
        depth: depth + 1,
      });
      resolvedLines.push({
        type: "sub_recipe",
        subRecipeId: line.subRecipeId,
        subRecipeName: subResult.recipe.name,
        quantity: Number(line.quantity),
        unit: line.unit,
        costPerUnit: subResult.costPerUnit,
        subBreakdown: subResult.details,
      });
    }
  }

  const computed = computeRecipeCostPure({
    yieldQuantity: Number(recipe.yieldQuantity),
    wastePercent: Number(recipe.wastePercent),
    lines: resolvedLines,
  });

  return { recipe, ...computed };
}

// ---------------------------------------------------------------------------
// SDD-04 §6 — Fórmulas de margen (ambas direcciones)
// ---------------------------------------------------------------------------

/** Dirección A: precio sugerido a partir de un costo y un margen deseado. */
export function suggestedPrice(costPerUnit: number, desiredMarginPercent: number): number {
  if (!(costPerUnit > 0)) {
    throw ApiError.validation("No se puede sugerir un precio sin un costo válido.", [
      { field: "costPerUnit", message: "No se puede sugerir un precio sin un costo válido." },
    ]);
  }
  if (desiredMarginPercent >= 100) {
    throw ApiError.validation(
      "Un margen de 100% o más no es posible: el precio de venta nunca sería suficiente para cubrirlo. Elige un margen menor a 100%.",
      [
        {
          field: "margin",
          message:
            "Un margen de 100% o más no es posible: el precio de venta nunca sería suficiente para cubrirlo. Elige un margen menor a 100%.",
        },
      ],
    );
  }
  if (!(desiredMarginPercent > 0)) {
    throw ApiError.validation("El margen debe ser un porcentaje mayor a 0% y menor a 100%.", [
      { field: "margin", message: "El margen debe ser un porcentaje mayor a 0% y menor a 100%." },
    ]);
  }
  return costPerUnit / (1 - desiredMarginPercent / 100);
}

/** Dirección B: margen real a partir de un precio de venta ya fijado. */
export function realMargin(
  salePrice: number,
  costPerUnit: number,
): { marginReal: number; profitPerUnit: number } {
  if (!(salePrice > 0)) {
    throw ApiError.validation("El precio de venta debe ser mayor a cero para calcular el margen.", [
      { field: "salePrice", message: "El precio de venta debe ser mayor a cero para calcular el margen." },
    ]);
  }
  const profitPerUnit = salePrice - costPerUnit;
  const marginReal = profitPerUnit / salePrice;
  return { marginReal, profitPerUnit };
}

// ---------------------------------------------------------------------------
// SDD-04 §7 — Detección de recetas cíclicas (DFS)
// ---------------------------------------------------------------------------

async function dfsHasPath(db: Database, current: string, target: string, visited: Set<string>): Promise<boolean> {
  if (current === target) return true;
  if (visited.has(current)) return false;
  visited.add(current);

  const children = await db
    .select({ subRecipeId: recipeIngredients.subRecipeId })
    .from(recipeIngredients)
    .where(and(eq(recipeIngredients.recipeId, current), isNotNull(recipeIngredients.subRecipeId)));

  for (const child of children) {
    if (child.subRecipeId && (await dfsHasPath(db, child.subRecipeId, target, visited))) {
      return true;
    }
  }
  return false;
}

/** true si agregar `candidateSubRecipeId` como sub-receta de `recipeId` crearía un ciclo. */
export async function wouldCreateCycle(
  db: Database,
  recipeId: string,
  candidateSubRecipeId: string,
): Promise<boolean> {
  if (recipeId === candidateSubRecipeId) return true;
  return dfsHasPath(db, candidateSubRecipeId, recipeId, new Set());
}

/** Profundidad máxima del árbol de sub-recetas bajo `recipeId` (0 si no tiene sub-recetas). */
export async function getSubRecipeDepth(db: Database, recipeId: string, visited: Set<string> = new Set()): Promise<number> {
  if (visited.has(recipeId)) return 0;
  visited.add(recipeId);

  const children = await db
    .select({ subRecipeId: recipeIngredients.subRecipeId })
    .from(recipeIngredients)
    .where(and(eq(recipeIngredients.recipeId, recipeId), isNotNull(recipeIngredients.subRecipeId)));

  let maxChildDepth = 0;
  for (const child of children) {
    if (!child.subRecipeId) continue;
    const childDepth = await getSubRecipeDepth(db, child.subRecipeId, visited);
    maxChildDepth = Math.max(maxChildDepth, childDepth + 1);
  }
  return maxChildDepth;
}
