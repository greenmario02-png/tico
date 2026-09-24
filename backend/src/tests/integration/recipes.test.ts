import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "../../db/client";
import { ingredients } from "../../db/schema/index";
import { insertPrice } from "../../services/priceHistoryService";
import { calculateRecipeCost } from "../../services/costingService";
import { createRecipe, deleteRecipe, getRecipeById, updateRecipe } from "../../services/recipeService";
import { getRecipeCostPreview } from "../../services/recipeCostService";

describe("Recetas — CRUD, costeo recursivo y ciclos (SDD-05 §6 / SDD-09 §1,§8)", () => {
  let harinaId: string;

  beforeAll(async () => {
    const [harina] = await db
      .insert(ingredients)
      .values({ name: `Harina de trigo TEST ${Date.now()}`, baseUnit: "g", currentStock: "0", minStock: "0" })
      .returning();
    harinaId = harina.id;

    await insertPrice(db, { ingredientId: harinaId, pricePerBaseUnit: "0.0125", effectiveAt: new Date("2026-08-01T00:00:00Z") });
    await insertPrice(db, { ingredientId: harinaId, pricePerBaseUnit: "0.0130", effectiveAt: new Date("2026-09-10T00:00:00Z") });
    await insertPrice(db, { ingredientId: harinaId, pricePerBaseUnit: "0.0135", effectiveAt: new Date("2026-09-17T00:00:00Z") });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("T-REC-CRUD-01: crea una receta con ingredientes y la recupera con su detalle", async () => {
    const recipe = await createRecipe(db, {
      name: `Solo Harina TEST ${Date.now()}`,
      yieldQuantity: "1.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      ingredients: [{ ingredientId: harinaId, subRecipeId: null, quantity: "1.000", unit: "kg" }],
    });

    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.isDeleted).toBe(false);

    const fetched = await getRecipeById(db, recipe.id as string);
    expect(fetched.id).toBe(recipe.id);
  });

  it("T-COSTO-04: costo histórico de la receta usa el precio vigente en la fecha consultada", async () => {
    const recipe = await createRecipe(db, {
      name: `Solo Harina Historico TEST ${Date.now()}`,
      yieldQuantity: "1.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      ingredients: [{ ingredientId: harinaId, subRecipeId: null, quantity: "1.000", unit: "kg" }],
    });

    const caseA = await calculateRecipeCost(db, recipe.id as string, { asOf: new Date("2026-09-12T00:00:00Z") });
    expect(caseA.totalCost).toBeCloseTo(13.0, 2);

    const caseB = await calculateRecipeCost(db, recipe.id as string, { asOf: new Date("2026-09-05T00:00:00Z") });
    expect(caseB.totalCost).toBeCloseTo(12.5, 2);

    const caseC = await calculateRecipeCost(db, recipe.id as string, { asOf: new Date("2026-09-17T00:00:00Z") });
    expect(caseC.totalCost).toBeCloseTo(13.5, 2);
  });

  it("GET /:id/cost (servicio) soporta fecha y cantidad escalada sin persistir nada", async () => {
    const recipe = await createRecipe(db, {
      name: `Receta Preview TEST ${Date.now()}`,
      yieldQuantity: "10.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      ingredients: [{ ingredientId: harinaId, subRecipeId: null, quantity: "1.000", unit: "kg" }],
    });

    const preview = await getRecipeCostPreview(db, recipe.id as string, {
      date: new Date("2026-09-17T00:00:00Z"),
      quantity: 20,
    });

    expect(preview.scaleFactor).toBe("2.0000");
    expect(Number(preview.totalCost)).toBeCloseTo(27.0, 2); // 13.50 * 2
  });

  it("T-CICLO-01: rechaza ciclo directo A <-> B", async () => {
    const masaBase = await createRecipe(db, {
      name: `Masa Base TEST ${Date.now()}`,
      yieldQuantity: "10.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      ingredients: [{ ingredientId: harinaId, subRecipeId: null, quantity: "0.500", unit: "kg" }],
    });

    const panRelleno = await createRecipe(db, {
      name: `Pan Relleno TEST ${Date.now()}`,
      yieldQuantity: "5.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      ingredients: [{ ingredientId: null, subRecipeId: masaBase.id as string, quantity: "2.000", unit: "pieza" }],
    });

    await expect(
      updateRecipe(db, masaBase.id as string, {
        ingredients: [{ ingredientId: null, subRecipeId: panRelleno.id as string, quantity: "1.000", unit: "pieza" }],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const reloaded = await getRecipeById(db, masaBase.id as string);
    expect(reloaded.ingredients.every((i) => i.subRecipeId !== panRelleno.id)).toBe(true);
  });

  it("T-CICLO-02: rechaza ciclo indirecto de 3 niveles A -> B -> C -> A", async () => {
    const recipeC = await createRecipe(db, {
      name: `Receta C TEST ${Date.now()}`,
      yieldQuantity: "10.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      ingredients: [{ ingredientId: harinaId, subRecipeId: null, quantity: "0.200", unit: "kg" }],
    });

    const recipeB = await createRecipe(db, {
      name: `Receta B TEST ${Date.now()}`,
      yieldQuantity: "10.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      ingredients: [{ ingredientId: null, subRecipeId: recipeC.id as string, quantity: "1.000", unit: "pieza" }],
    });

    const recipeA = await createRecipe(db, {
      name: `Receta A TEST ${Date.now()}`,
      yieldQuantity: "10.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      ingredients: [{ ingredientId: null, subRecipeId: recipeB.id as string, quantity: "1.000", unit: "pieza" }],
    });

    await expect(
      updateRecipe(db, recipeC.id as string, {
        ingredients: [{ ingredientId: null, subRecipeId: recipeA.id as string, quantity: "1.000", unit: "pieza" }],
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("T-REC-CRUD-02: DELETE hace soft-delete y no se puede eliminar si es sub-receta activa", async () => {
    const sub = await createRecipe(db, {
      name: `Sub Usada TEST ${Date.now()}`,
      yieldQuantity: "10.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      ingredients: [{ ingredientId: harinaId, subRecipeId: null, quantity: "0.100", unit: "kg" }],
    });
    const main = await createRecipe(db, {
      name: `Receta Contenedora TEST ${Date.now()}`,
      yieldQuantity: "5.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      ingredients: [{ ingredientId: null, subRecipeId: sub.id as string, quantity: "1.000", unit: "pieza" }],
    });

    await expect(deleteRecipe(db, sub.id as string)).rejects.toMatchObject({ statusCode: 409 });

    const result = await deleteRecipe(db, main.id as string);
    expect(result.message).toBe("Receta eliminada");

    await expect(getRecipeById(db, main.id as string)).rejects.toMatchObject({ statusCode: 404 });
  });

  // imageUrl: campo nuevo agregado a pedido explícito del usuario (soporte de
  // fotos en la UI), no contemplado en SDD-06 original.
  it("T-REC-CRUD-03: imageUrl se guarda en la creación, persiste en GET y se puede actualizar/limpiar", async () => {
    const url = "https://commons.wikimedia.org/wiki/Special:FilePath/Slice_of_chocolate_cake.jpg?width=400";
    const recipe = await createRecipe(db, {
      name: `Torta con Foto TEST ${Date.now()}`,
      yieldQuantity: "1.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      imageUrl: url,
      ingredients: [{ ingredientId: harinaId, subRecipeId: null, quantity: "1.000", unit: "kg" }],
    });
    expect(recipe.imageUrl).toBe(url);

    const fetched = await getRecipeById(db, recipe.id as string);
    expect(fetched.imageUrl).toBe(url);

    const newUrl = "https://commons.wikimedia.org/wiki/Special:FilePath/Butter_Cookies.JPG?width=400";
    const updated = await updateRecipe(db, recipe.id as string, { imageUrl: newUrl });
    expect(updated.imageUrl).toBe(newUrl);

    const cleared = await updateRecipe(db, recipe.id as string, { imageUrl: null });
    expect(cleared.imageUrl).toBeNull();
  });
});
