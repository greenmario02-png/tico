import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "../../db/client";
import { ingredients } from "../../db/schema/index";
import { insertPrice } from "../../services/priceHistoryService";
import { createRecipe } from "../../services/recipeService";
import {
  createProduct,
  deactivateProduct,
  getSuggestedPrice,
  setProductPrice,
} from "../../services/productService";

describe("Productos — precio de venta y margen (SDD-05 §7 / SDD-09 §5)", () => {
  let recipeId: string;

  beforeAll(async () => {
    const [harina] = await db
      .insert(ingredients)
      .values({ name: `Harina Producto TEST ${Date.now()}`, baseUnit: "g", currentStock: "0", minStock: "0" })
      .returning();
    await insertPrice(db, { ingredientId: harina.id, pricePerBaseUnit: "0.0135", effectiveAt: new Date("2026-01-01T00:00:00Z") });

    const recipe = await createRecipe(db, {
      name: `Receta Para Producto TEST ${Date.now()}`,
      yieldQuantity: "1.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      ingredients: [{ ingredientId: harina.id, subRecipeId: null, quantity: "114.074", unit: "g" }],
    });
    // costoPorUnidad = 114.074 * 0.0135 = 1.540 Bs (aprox, coincide con SDD-09 §5)
    recipeId = recipe.id as string;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("T-PROD-01: crea un producto vinculado a una receta y fija su precio de venta", async () => {
    const product = await createProduct(db, { recipeId, name: `Pan de Molde 500g TEST ${Date.now()}` });
    expect(product.salePrice).toBeNull();

    const priced = await setProductPrice(db, product.id as string, "3.80");
    expect(priced.salePrice).toBe("3.80");
  });

  it("T-MARGEN-01 (endpoint): sugiere precio de venta a partir de un margen deseado", async () => {
    const product = await createProduct(db, { recipeId, name: `Producto Margen TEST ${Date.now()}` });
    const result = await getSuggestedPrice(db, product.id as string, { margin: 35, date: new Date("2026-01-02T00:00:00Z") });

    expect(Number(result.costPerUnit)).toBeCloseTo(1.54, 2);
    expect(Number(result.suggestedPrice)).toBeCloseTo(2.37, 2);
  });

  it("T-MARGEN-03 (endpoint): rechaza margen >= 100", async () => {
    const product = await createProduct(db, { recipeId, name: `Producto Margen Invalido TEST ${Date.now()}` });
    await expect(getSuggestedPrice(db, product.id as string, { margin: 100 })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(getSuggestedPrice(db, product.id as string, { margin: 120 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("T-PROD-02: DELETE hace soft-delete (isActive=false)", async () => {
    const product = await createProduct(db, { recipeId, name: `Producto Desactivar TEST ${Date.now()}` });
    const result = await deactivateProduct(db, product.id as string);
    expect(result.message).toBe("Producto desactivado");
  });
});
