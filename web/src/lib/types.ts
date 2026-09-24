// Tipos que reflejan la forma REAL de las respuestas del backend
// (ver app/backend/src/routes/*.ts y src/services/*.ts — fuente de verdad).

export type Role = "admin" | "operario" | "dueño";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive?: boolean;
  createdAt?: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export type BaseUnit = "g" | "ml" | "pieza";

export interface Ingredient {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  baseUnit: BaseUnit;
  currentStock: string;
  minStock: string;
  supplierId: string | null;
  supplierName: string | null;
  currentPricePerBaseUnit: string | null;
  // Campo nuevo agregado a pedido explícito del usuario (soporte de fotos en
  // la UI), no contemplado en 01-PROJECT_SPEC.md / SDD original.
  imageUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PriceHistoryEntry {
  id: string;
  ingredientId: string;
  pricePerBaseUnit: string;
  effectiveAt: string;
  createdBy: string | null;
  createdAt: string;
}

export const RECIPE_YIELD_UNITS = ["pieza", "docena"] as const;
export type RecipeYieldUnit = (typeof RECIPE_YIELD_UNITS)[number];

export const RECIPE_INGREDIENT_UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "pieza",
  "docena",
  "cucharada",
  "cucharadita",
  "taza",
] as const;
export type RecipeIngredientUnit = (typeof RECIPE_INGREDIENT_UNITS)[number];

export interface RecipeIngredientLine {
  id: string;
  type: "ingredient" | "sub_recipe";
  ingredientId: string | null;
  ingredientName: string | null;
  subRecipeId: string | null;
  subRecipeName: string | null;
  quantity: string;
  unit: RecipeIngredientUnit;
}

// NOTA (discrepancia SDD-05 vs backend real): GET /api/recipes (listado)
// devuelve una forma MÁS LIGERA que GET /api/recipes/:id — sin
// `description`, `instructions` ni `ingredients` (ver
// app/backend/src/services/recipeService.ts listRecipes() vs toApiShape()).
// Por eso esos 3 campos son opcionales acá: el detalle SIEMPRE los trae,
// el listado NUNCA los trae.
export interface Recipe {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  description?: string | null;
  yieldQuantity: string;
  yieldUnit: RecipeYieldUnit;
  wastePercent: string;
  prepTimeMinutes: number | null;
  bakeTimeMinutes: number | null;
  instructions?: string | null;
  // Campo nuevo agregado a pedido explícito del usuario (soporte de fotos en
  // la UI), no contemplado en 01-PROJECT_SPEC.md / SDD original.
  imageUrl?: string | null;
  isDeleted: boolean;
  ingredients?: RecipeIngredientLine[];
  createdAt: string;
  updatedAt: string;
}

export interface CostDetailApi {
  type: "ingredient" | "sub_recipe";
  ingredientId?: string;
  ingredientName?: string;
  subRecipeId?: string;
  subRecipeName?: string;
  baseQuantity: string;
  unit: string;
  scaledQuantity: string;
  quantityAfterWaste: string;
  pricePerBaseUnit: string;
  lineCost: string;
  subBreakdown?: CostDetailApi[];
}

export interface RecipeCostPreview {
  recipeId: string;
  recipeName: string;
  priceDate: string;
  requestedQuantity: string;
  yieldQuantity: string;
  scaleFactor: string;
  wastePercent: string;
  totalCost: string;
  costPerUnit: string;
  breakdown: CostDetailApi[];
}

export interface Product {
  id: string;
  recipeId: string;
  recipeName: string | null;
  name: string;
  salePrice: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SuggestedPrice {
  productId: string;
  productName: string;
  margin: number;
  costPerUnit: string;
  suggestedPrice: string;
  currentSalePrice: string | null;
}

export interface Batch {
  id: string;
  recipeId: string;
  productId: string | null;
  requestedUnits: string;
  scaleFactor: string;
  totalCostSnapshot: string;
  costPerUnitSnapshot: string;
  // Derivado (nunca una columna física): requestedUnits - SUM(ventas de ese
  // lote). Ver SDD-03 §7, SDD-05 §8. Opcional por si un endpoint viejo/mock
  // no lo incluye todavía.
  unitsRemaining?: string;
  producedAt: string;
  createdBy: string | null;
  notes: string | null;
}

// NOTA (discrepancia SDD-05 vs backend real): la respuesta real de
// POST/GET /api/sales YA incluye revenue/costTotal/realProfit/
// realMarginPercent calculados server-side (ver saleService.ts
// toApiShape()) — el frontend nunca debe recalcular la ganancia real por
// su cuenta, solo mostrar estos campos tal cual.
export interface Sale {
  id: string;
  productId: string;
  productName: string | null;
  batchId: string | null;
  quantity: string;
  salePricePerUnit: string;
  costPerUnitSnapshot: string;
  revenue: string;
  costTotal: string;
  realProfit: string;
  realMarginPercent: string;
  soldAt: string;
  createdBy: string | null;
  createdByName: string | null;
}

export type CategoryKind = "ingrediente" | "receta";

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export type MovementType = "compra" | "uso_produccion" | "ajuste" | "merma";

export interface InventoryMovement {
  id: string;
  ingredientId: string;
  ingredientName: string;
  movementType: MovementType;
  quantityBaseUnit: string;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface InventoryRow {
  id: string;
  name: string;
  categoryId: string | null;
  baseUnit: BaseUnit;
  currentStock: string;
  minStock: string;
  stockValue: string;
  isBelowMin: boolean;
}

export interface ProfitabilityRow {
  productId: string;
  productName: string | null;
  unitsSold: string;
  totalRevenue: string;
  totalCost: string;
  totalRealProfit: string;
  realMarginPercent: string;
  // Resuelto (SDD-07 CU6, SDD-10 §1): true si realMarginPercent está por
  // debajo del umbral configurable devuelto en lowProfitabilityThresholdPercent.
  isLowProfitability?: boolean;
}

export interface ProfitabilityReport {
  data: ProfitabilityRow[];
  totals: {
    totalRevenue: string;
    totalCost: string;
    totalRealProfit: string;
    realMarginPercent: string;
  };
  // Umbral (%) usado para calcular isLowProfitability, ver SDD-05 §11.5.
  lowProfitabilityThresholdPercent?: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}
