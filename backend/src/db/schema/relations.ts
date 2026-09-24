import { relations } from "drizzle-orm";
import { recipes } from "./recipes";
import { recipeIngredients } from "./recipeIngredients";
import { batches } from "./batches";
import { products } from "./products";
import { ingredients } from "./ingredients";
import { ingredientPriceHistory } from "./ingredientPriceHistory";
import { ingredientStockMovements } from "./ingredientStockMovements";
import { suppliers } from "./suppliers";
import { batchIngredientUsage } from "./batchIngredientUsage";
import { sales } from "./sales";

export const recipesRelations = relations(recipes, ({ many }) => ({
  ingredients: many(recipeIngredients, { relationName: "recipe_to_ingredients" }),
  usedAsSubRecipeIn: many(recipeIngredients, { relationName: "sub_recipe_usage" }),
  batches: many(batches),
  products: many(products),
}));

export const ingredientsRelations = relations(ingredients, ({ many, one }) => ({
  priceHistory: many(ingredientPriceHistory),
  stockMovements: many(ingredientStockMovements),
  supplier: one(suppliers, { fields: [ingredients.supplierId], references: [suppliers.id] }),
}));

export const batchesRelations = relations(batches, ({ many, one }) => ({
  recipe: one(recipes, { fields: [batches.recipeId], references: [recipes.id] }),
  usage: many(batchIngredientUsage),
  sales: many(sales),
}));
