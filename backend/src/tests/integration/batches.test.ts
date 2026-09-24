import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "../../db/client";
import { batchIngredientUsage, ingredients } from "../../db/schema/index";
import { insertPrice } from "../../services/priceHistoryService";
import { createRecipe } from "../../services/recipeService";
import { getBatchById, produceBatch } from "../../services/batchService";

/**
 * SDD-09 §4 — T-LOTE-01/02/03. Usa la receta de ejemplo "Pan de Molde"
 * (rendimiento 24, merma 5%) que aparece en SDD-04 §1 y SDD-09 §4.
 */
describe("Producción de lotes — descuento de stock y snapshot congelado (SDD-03 §4 / SDD-09 §4)", () => {
  async function makeIngredient(name: string, baseUnit: "g" | "ml" | "pieza", stock: string, price: string) {
    const [row] = await db
      .insert(ingredients)
      .values({ name: `${name} TEST ${Date.now()}_${Math.random()}`, baseUnit, currentStock: stock, minStock: "0" })
      .returning();
    await insertPrice(db, { ingredientId: row.id, pricePerBaseUnit: price, effectiveAt: new Date("2026-01-01T00:00:00Z") });
    return row;
  }

  async function makePanDeMoldeRecipe(stocks: {
    harina: string;
    azucar: string;
    mantequilla: string;
    huevos: string;
    leche: string;
    levadura: string;
  }) {
    // Precios tal cual el fixture "Pan de Molde" de SDD-09 §1/§2/§4 (costo
    // sin merma = 35.05 Bs para 24 panes, ver costingService.test.ts T-COSTO-02).
    const harina = await makeIngredient("Harina de trigo", "g", stocks.harina, "0.0135");
    const azucar = await makeIngredient("Azúcar blanca", "g", stocks.azucar, "0.0080");
    const mantequilla = await makeIngredient("Mantequilla", "g", stocks.mantequilla, "0.0320");
    const huevos = await makeIngredient("Huevos", "pieza", stocks.huevos, "0.60");
    const leche = await makeIngredient("Leche", "ml", stocks.leche, "0.0035");
    const levadura = await makeIngredient("Levadura", "g", stocks.levadura, "0.04");

    const recipe = await createRecipe(db, {
      name: `Pan de Molde TEST ${Date.now()}_${Math.random()}`,
      yieldQuantity: "24.00",
      yieldUnit: "pieza",
      wastePercent: "5",
      ingredients: [
        { ingredientId: harina.id, subRecipeId: null, quantity: "1.000", unit: "kg" },
        { ingredientId: azucar.id, subRecipeId: null, quantity: "0.500", unit: "kg" },
        { ingredientId: mantequilla.id, subRecipeId: null, quantity: "0.300", unit: "kg" },
        { ingredientId: huevos.id, subRecipeId: null, quantity: "10.000", unit: "pieza" },
        { ingredientId: leche.id, subRecipeId: null, quantity: "0.500", unit: "l" },
        { ingredientId: levadura.id, subRecipeId: null, quantity: "5.000", unit: "g" },
      ],
    });

    return { recipe, harina, azucar, mantequilla, huevos, leche, levadura };
  }

  afterAll(async () => {
    await pool.end();
  });

  it("T-LOTE-01: produce 50 panes con descuento de stock y snapshot correctos", async () => {
    const { recipe, harina, azucar, mantequilla, huevos, leche, levadura } = await makePanDeMoldeRecipe({
      harina: "50000",
      azucar: "20000",
      mantequilla: "10000",
      huevos: "200",
      leche: "30000",
      levadura: "500",
    });

    const batch = await produceBatch(db, {
      recipeId: recipe.id as string,
      requestedUnits: "50.00",
      createdBy: null,
    });

    expect(batch.scaleFactor).toBe("2.0833");
    expect(Number(batch.costPerUnitSnapshot)).toBeCloseTo(1.5372, 3);
    expect(Number(batch.totalCostSnapshot)).toBeCloseTo(76.86, 1);
    expect(batch.usage).toHaveLength(6);

    const [harinaAfter] = await db.select().from(ingredients).where(eq(ingredients.id, harina.id));
    const [azucarAfter] = await db.select().from(ingredients).where(eq(ingredients.id, azucar.id));
    const [mantequillaAfter] = await db.select().from(ingredients).where(eq(ingredients.id, mantequilla.id));
    const [huevosAfter] = await db.select().from(ingredients).where(eq(ingredients.id, huevos.id));
    const [lecheAfter] = await db.select().from(ingredients).where(eq(ingredients.id, leche.id));
    const [levaduraAfter] = await db.select().from(ingredients).where(eq(ingredients.id, levadura.id));

    expect(Number(harinaAfter.currentStock)).toBeCloseTo(50000 - 2192.98, 1);
    expect(Number(azucarAfter.currentStock)).toBeCloseTo(20000 - 1096.49, 1);
    expect(Number(mantequillaAfter.currentStock)).toBeCloseTo(10000 - 657.89, 1);
    expect(Number(huevosAfter.currentStock)).toBeCloseTo(200 - 21.93, 1);
    expect(Number(lecheAfter.currentStock)).toBeCloseTo(30000 - 1096.49, 1);
    expect(Number(levaduraAfter.currentStock)).toBeCloseTo(500 - 10.96, 1);

    const usageRows = await db.select().from(batchIngredientUsage).where(eq(batchIngredientUsage.batchId, batch.id as string));
    expect(usageRows).toHaveLength(6);
    const harinaUsage = usageRows.find((r) => r.ingredientId === harina.id);
    expect(Number(harinaUsage!.quantityUsedBaseUnit)).toBeCloseTo(2192.98, 1);
    expect(Number(harinaUsage!.unitCostSnapshot)).toBeCloseTo(0.0135, 4);
  });

  it("T-LOTE-02: stock insuficiente rechaza TODO el lote (atomicidad)", async () => {
    const { recipe, harina, azucar, mantequilla, huevos, leche, levadura } = await makePanDeMoldeRecipe({
      harina: "50000",
      azucar: "20000",
      mantequilla: "500", // insuficiente: se necesitan 657.89 g
      huevos: "200",
      leche: "30000",
      levadura: "500",
    });

    await expect(
      produceBatch(db, { recipeId: recipe.id as string, requestedUnits: "50.00", createdBy: null }),
    ).rejects.toMatchObject({ statusCode: 409, code: "INSUFFICIENT_STOCK" });

    const [harinaAfter] = await db.select().from(ingredients).where(eq(ingredients.id, harina.id));
    const [azucarAfter] = await db.select().from(ingredients).where(eq(ingredients.id, azucar.id));
    const [mantequillaAfter] = await db.select().from(ingredients).where(eq(ingredients.id, mantequilla.id));
    const [huevosAfter] = await db.select().from(ingredients).where(eq(ingredients.id, huevos.id));
    const [lecheAfter] = await db.select().from(ingredients).where(eq(ingredients.id, leche.id));
    const [levaduraAfter] = await db.select().from(ingredients).where(eq(ingredients.id, levadura.id));

    // NINGÚN ingrediente fue descontado, ni siquiera los que sí alcanzaban.
    expect(harinaAfter.currentStock).toBe("50000.000");
    expect(azucarAfter.currentStock).toBe("20000.000");
    expect(mantequillaAfter.currentStock).toBe("500.000");
    expect(huevosAfter.currentStock).toBe("200.000");
    expect(lecheAfter.currentStock).toBe("30000.000");
    expect(levaduraAfter.currentStock).toBe("500.000");
  });

  it("T-LOTE-03: el snapshot del lote no cambia si el precio del ingrediente cambia después", async () => {
    const { recipe, harina } = await makePanDeMoldeRecipe({
      harina: "50000",
      azucar: "20000",
      mantequilla: "10000",
      huevos: "200",
      leche: "30000",
      levadura: "500",
    });

    const batch = await produceBatch(db, {
      recipeId: recipe.id as string,
      requestedUnits: "50.00",
      createdBy: null,
    });

    const originalTotal = batch.totalCostSnapshot;
    const originalPerUnit = batch.costPerUnitSnapshot;

    // Nuevo precio de harina: 20.00 Bs/kg = 0.02 Bs/g
    await insertPrice(db, { ingredientId: harina.id, pricePerBaseUnit: "0.02", effectiveAt: new Date() });

    const reloaded = await getBatchById(db, batch.id as string);
    expect(reloaded.totalCostSnapshot).toBe(originalTotal);
    expect(reloaded.costPerUnitSnapshot).toBe(originalPerUnit);

    const harinaUsage = reloaded.usage.find((u) => u.ingredientId === harina.id);
    expect(Number(harinaUsage!.unitCostSnapshot)).toBeCloseTo(0.0135, 4);
  });

  it("BAT-002: rechaza requestedUnits <= 0", async () => {
    const { recipe } = await makePanDeMoldeRecipe({
      harina: "50000",
      azucar: "20000",
      mantequilla: "10000",
      huevos: "200",
      leche: "30000",
      levadura: "500",
    });

    await expect(
      produceBatch(db, { recipeId: recipe.id as string, requestedUnits: "0", createdBy: null }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("Suma correctamente un ingrediente base que aparece directo y dentro de una sub-receta anidada", async () => {
    const harina = await makeIngredient("Harina Compartida", "g", "100000", "0.0135");

    const masaBase = await createRecipe(db, {
      name: `Masa Base TEST ${Date.now()}_${Math.random()}`,
      yieldQuantity: "10.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      ingredients: [{ ingredientId: harina.id, subRecipeId: null, quantity: "0.500", unit: "kg" }],
    });

    const panRelleno = await createRecipe(db, {
      name: `Pan Relleno TEST ${Date.now()}_${Math.random()}`,
      yieldQuantity: "5.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      ingredients: [
        { ingredientId: harina.id, subRecipeId: null, quantity: "0.200", unit: "kg" },
        { ingredientId: null, subRecipeId: masaBase.id as string, quantity: "2.000", unit: "pieza" },
      ],
    });

    // Para 5 panes rellenos (scaleFactor = 1):
    // Directo: 0.200 kg = 200 g de harina.
    // Vía sub-receta: se usan 2 "piezas" de Masa Base (rinde 10), es decir
    // 2/10 = 20% de una tanda completa de Masa Base, que a su vez usa
    // 500 g de harina por tanda completa → 100 g de harina.
    // Total esperado: 200 + 100 = 300 g.
    const batch = await produceBatch(db, {
      recipeId: panRelleno.id as string,
      requestedUnits: "5.00",
      createdBy: null,
    });

    const usageRows = await db.select().from(batchIngredientUsage).where(eq(batchIngredientUsage.batchId, batch.id as string));
    const harinaUsageRows = usageRows.filter((r) => r.ingredientId === harina.id);
    expect(harinaUsageRows).toHaveLength(1); // sumado en una sola fila, no duplicado
    expect(Number(harinaUsageRows[0].quantityUsedBaseUnit)).toBeCloseTo(300, 2);

    const [harinaAfter] = await db.select().from(ingredients).where(eq(ingredients.id, harina.id));
    expect(Number(harinaAfter.currentStock)).toBeCloseTo(100000 - 300, 2);
  });
});
