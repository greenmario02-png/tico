import type { Database } from "../db/client";
import { ApiError } from "../lib/errors";
import { calculateRecipeCost, type CostDetail } from "./costingService";

export interface RecipeCostPreviewParams {
  date?: Date;
  quantity?: number;
}

function scaleDetail(detail: CostDetail, scaleFactor: number): Record<string, unknown> {
  return {
    type: detail.type,
    ...(detail.type === "ingredient" ? { ingredientId: detail.id, ingredientName: detail.name } : {}),
    ...(detail.type === "sub_recipe" ? { subRecipeId: detail.id, subRecipeName: detail.name } : {}),
    baseQuantity: detail.quantityInRecipe.toFixed(3),
    unit: detail.unitInRecipe,
    scaledQuantity: (detail.baseQuantity * scaleFactor).toFixed(4),
    quantityAfterWaste: (detail.quantityAfterWaste * scaleFactor).toFixed(4),
    pricePerBaseUnit: detail.unitPrice.toFixed(4),
    lineCost: (detail.lineCost * scaleFactor).toFixed(2),
    ...(detail.subBreakdown ? { subBreakdown: detail.subBreakdown.map((d) => scaleDetail(d, scaleFactor)) } : {}),
  };
}

/** SDD-05 §6.6 — preview de costo (recursivo, sin escribir en BD). */
export async function getRecipeCostPreview(db: Database, recipeId: string, params: RecipeCostPreviewParams) {
  const asOf = params.date ?? new Date();
  if (asOf.getTime() > Date.now()) {
    throw ApiError.validation("No se puede calcular costo con una fecha futura", [
      { field: "date", message: "No se puede calcular costo con una fecha futura" },
    ]);
  }

  const result = await calculateRecipeCost(db, recipeId, { asOf });

  const yieldQuantity = Number(result.recipe.yieldQuantity);
  const requestedQuantity = params.quantity ?? yieldQuantity;
  if (!(requestedQuantity > 0)) {
    throw ApiError.validation("Ingresa cuántas unidades quieres producir (debe ser más de cero).", [
      { field: "quantity", message: "Ingresa cuántas unidades quieres producir (debe ser más de cero)." },
    ]);
  }
  const scaleFactor = requestedQuantity / yieldQuantity;

  return {
    recipeId: result.recipe.id,
    recipeName: result.recipe.name,
    priceDate: asOf.toISOString().slice(0, 10),
    requestedQuantity: requestedQuantity.toFixed(2),
    yieldQuantity: yieldQuantity.toFixed(2),
    scaleFactor: scaleFactor.toFixed(4),
    wastePercent: result.recipe.wastePercent,
    totalCost: (result.totalCost * scaleFactor).toFixed(2),
    costPerUnit: result.costPerUnit.toFixed(4),
    breakdown: result.details.map((d) => scaleDetail(d, scaleFactor)),
  };
}
