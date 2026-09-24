import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "../../db/client";
import { ingredients } from "../../db/schema/index";
import { insertPrice } from "../../services/priceHistoryService";
import { createRecipe } from "../../services/recipeService";
import { createProduct } from "../../services/productService";
import { getBatchById, produceBatch } from "../../services/batchService";
import { getProfitabilityReport, listSales, registerSale } from "../../services/saleService";
import { getInventoryOverview, listMovements } from "../../services/inventoryService";
import { config } from "../../lib/config";

/**
 * SDD-09 §7 (VENTAS) + Caso de Uso 5/6. Reutiliza el fixture "Pan de Molde"
 * (rendimiento 5, merma 5%) de SDD-07 CU6 para reproducir exactamente su
 * ejemplo numérico: costo por unidad congelado = 7.58 Bs/pan.
 */
describe("Ventas — registro y ganancia real (SDD-05 §9 / SDD-06 §7 / SDD-07 CU5-CU6)", () => {
  async function makeIngredient(name: string, baseUnit: "g" | "ml" | "pieza", stock: string, price: string) {
    const [row] = await db
      .insert(ingredients)
      .values({ name: `${name} VENTA_TEST ${Date.now()}_${Math.random()}`, baseUnit, currentStock: stock, minStock: "0" })
      .returning();
    await insertPrice(db, { ingredientId: row.id, pricePerBaseUnit: price, effectiveAt: new Date("2026-01-01T00:00:00Z") });
    return row;
  }

  async function makePanDeMolde5() {
    // Fixture EXACTO de SDD-07 CU6: rinde 5 panes, merma 5%, costo por
    // unidad congelado esperado ≈ 7.58 Bs/pan.
    const harina = await makeIngredient("Harina de trigo", "g", "100000", "0.0135");
    const azucar = await makeIngredient("Azúcar blanca", "g", "100000", "0.009"); // 9.00 Bs/kg
    const mantequilla = await makeIngredient("Mantequilla", "g", "100000", "0.032");
    const huevos = await makeIngredient("Huevos", "pieza", "1000", "0.65");
    const leche = await makeIngredient("Leche", "ml", "100000", "0.0035");
    const levadura = await makeIngredient("Levadura", "g", "10000", "0.03");

    const recipe = await createRecipe(db, {
      name: `Pan de Molde CU6 TEST ${Date.now()}_${Math.random()}`,
      yieldQuantity: "5.00",
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

    const product = await createProduct(db, {
      recipeId: recipe.id as string,
      name: `Pan de Molde CU6 TEST ${Date.now()}_${Math.random()}`,
      salePrice: "12.00",
    });

    return { recipe, product };
  }

  afterAll(async () => {
    await pool.end();
  });

  it("T-VENTA-01: registra una venta y calcula ganancia/margen real (CU6: 7.58 Bs/pan costo, 12.00 Bs venta)", async () => {
    const { recipe, product } = await makePanDeMolde5();

    // 20 unidades producidas (no 5) para poder vender las 20 unidades del
    // caso de ejemplo sin chocar con la nueva validación de sobreventa por
    // lote (VEN-008) — el costo por unidad congelado no cambia con el
    // tamaño del lote, solo escala linealmente.
    const batch = await produceBatch(db, {
      recipeId: recipe.id as string,
      requestedUnits: "20.00",
      productId: product.id as string,
      createdBy: null,
    });

    expect(Number(batch.costPerUnitSnapshot)).toBeCloseTo(7.58, 1);

    const sale = await registerSale(db, {
      productId: product.id as string,
      batchId: batch.id as string,
      quantity: "20",
      salePricePerUnit: "12.00",
      createdBy: null,
    });

    expect(sale.costPerUnitSnapshot).toBe(batch.costPerUnitSnapshot);
    expect(Number(sale.revenue)).toBeCloseTo(240.0, 2);
    expect(Number(sale.costTotal)).toBeCloseTo(20 * Number(batch.costPerUnitSnapshot), 1);
    expect(Number(sale.realProfit)).toBeCloseTo(240.0 - 20 * Number(batch.costPerUnitSnapshot), 1);
    // margen_real = ganancia / ingreso ≈ 36.8% (CU6)
    expect(Number(sale.realMarginPercent)).toBeCloseTo(36.8, 0);
  });

  it("T-VENTA-02: sin batchId, usa el costo del lote MÁS RECIENTE de la receta", async () => {
    const { recipe, product } = await makePanDeMolde5();

    await produceBatch(db, { recipeId: recipe.id as string, requestedUnits: "5.00", createdBy: null });
    // Cambia el precio de un ingrediente y produce un segundo lote más caro.
    const secondBatch = await produceBatch(db, { recipeId: recipe.id as string, requestedUnits: "5.00", createdBy: null });

    const sale = await registerSale(db, {
      productId: product.id as string,
      batchId: null,
      quantity: "1",
      salePricePerUnit: "12.00",
      createdBy: null,
    });

    expect(sale.costPerUnitSnapshot).toBe(secondBatch.costPerUnitSnapshot);
    expect(sale.batchId).toBe(secondBatch.id);
  });

  it("T-VENTA-03 (VEN-006): rechaza la venta si el producto no tiene ningún lote producido", async () => {
    const harina = await makeIngredient("Harina Sin Lote", "g", "1000", "0.0135");
    const recipe = await createRecipe(db, {
      name: `Receta Sin Lote TEST ${Date.now()}_${Math.random()}`,
      yieldQuantity: "1.00",
      yieldUnit: "pieza",
      wastePercent: "0",
      ingredients: [{ ingredientId: harina.id, subRecipeId: null, quantity: "10.000", unit: "g" }],
    });
    const product = await createProduct(db, {
      recipeId: recipe.id as string,
      name: `Producto Sin Lote TEST ${Date.now()}_${Math.random()}`,
    });

    await expect(
      registerSale(db, {
        productId: product.id as string,
        batchId: null,
        quantity: "1",
        salePricePerUnit: "5.00",
        createdBy: null,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
  });

  it("T-VENTA-04 (VEN-002): rechaza un batchId que no corresponde a la receta del producto", async () => {
    const { recipe: recipeA, product: productA } = await makePanDeMolde5();
    const { recipe: recipeB } = await makePanDeMolde5();

    await produceBatch(db, { recipeId: recipeA.id as string, requestedUnits: "5.00", createdBy: null });
    const batchB = await produceBatch(db, { recipeId: recipeB.id as string, requestedUnits: "5.00", createdBy: null });

    await expect(
      registerSale(db, {
        productId: productA.id as string,
        batchId: batchB.id as string,
        quantity: "1",
        salePricePerUnit: "5.00",
        createdBy: null,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "CONFLICT" });
  });

  it("T-VENTA-05: GET listSales agrega un resumen sobre el conjunto filtrado completo", async () => {
    const { recipe, product } = await makePanDeMolde5();
    // 15 unidades producidas para poder vender 10 + 5 = 15 sin chocar con la
    // validación de sobreventa por lote (VEN-008).
    const batch = await produceBatch(db, { recipeId: recipe.id as string, requestedUnits: "15.00", createdBy: null });

    await registerSale(db, {
      productId: product.id as string,
      batchId: batch.id as string,
      quantity: "10",
      salePricePerUnit: "12.00",
      createdBy: null,
    });
    await registerSale(db, {
      productId: product.id as string,
      batchId: batch.id as string,
      quantity: "5",
      salePricePerUnit: "12.00",
      createdBy: null,
    });

    const result = await listSales(db, { page: 1, pageSize: 25, productId: product.id as string });
    expect(result.data).toHaveLength(2);
    expect(Number(result.summary.totalRevenue)).toBeCloseTo(15 * 12.0, 2);
  });

  it("T-REPORTE-01: getProfitabilityReport reproduce el ejemplo numérico de CU6 (40 panes a 12.00 Bs)", async () => {
    const { recipe, product } = await makePanDeMolde5();
    const batch = await produceBatch(db, { recipeId: recipe.id as string, requestedUnits: "40.00", createdBy: null });

    await registerSale(db, {
      productId: product.id as string,
      batchId: batch.id as string,
      quantity: "40",
      salePricePerUnit: "12.00",
      createdBy: null,
    });

    const report = await getProfitabilityReport(db, { productId: product.id as string });
    expect(report.data).toHaveLength(1);
    expect(Number(report.data[0].totalRevenue)).toBeCloseTo(480.0, 1);
    expect(Number(report.data[0].totalCost)).toBeCloseTo(40 * Number(batch.costPerUnitSnapshot), 1);
    expect(Number(report.data[0].realMarginPercent)).toBeCloseTo(36.8, 0);
  });

  it("T-INVENTARIO-01: GET inventory overview calcula stockValue = currentStock * currentPricePerBaseUnit", async () => {
    const harina = await makeIngredient("Harina Inventario", "g", "1000", "0.0135");
    const overview = await getInventoryOverview(db, { page: 1, pageSize: 100 });
    const row = overview.data.find((r) => r.id === harina.id);
    expect(row).toBeDefined();
    expect(Number(row!.stockValue)).toBeCloseTo(1000 * 0.0135, 2);
  });

  it("T-INVENTARIO-02: GET inventory movements lista los movimientos generados por un lote (kardex)", async () => {
    const { recipe } = await makePanDeMolde5();
    const batch = await produceBatch(db, { recipeId: recipe.id as string, requestedUnits: "5.00", createdBy: null });

    const movements = await listMovements(db, { page: 1, pageSize: 100, from: new Date("2020-01-01") });
    const forThisBatch = movements.data.filter((m) => m.referenceId === batch.id);
    // 6 ingredientes × (uso_produccion + merma) = 12 movimientos.
    expect(forThisBatch.length).toBeGreaterThanOrEqual(6);
  });

  // ---------------------------------------------------------------------
  // unitsRemaining / sobreventa de lote (SDD-03 §7, SDD-07 CU5 flujo
  // alternativo, SDD-06 VEN-008, SDD-00 pendientes — ahora resuelto).
  // ---------------------------------------------------------------------

  it("T-LOTE-04: unitsRemaining disminuye correctamente después de cada venta", async () => {
    const { recipe, product } = await makePanDeMolde5();
    const batch = await produceBatch(db, { recipeId: recipe.id as string, requestedUnits: "5.00", createdBy: null });

    let reloaded = await getBatchById(db, batch.id as string);
    expect(Number(reloaded.unitsRemaining)).toBeCloseTo(5, 2);

    await registerSale(db, {
      productId: product.id as string,
      batchId: batch.id as string,
      quantity: "2",
      salePricePerUnit: "12.00",
      createdBy: null,
    });

    reloaded = await getBatchById(db, batch.id as string);
    expect(Number(reloaded.unitsRemaining)).toBeCloseTo(3, 2);

    await registerSale(db, {
      productId: product.id as string,
      batchId: batch.id as string,
      quantity: "3",
      salePricePerUnit: "12.00",
      createdBy: null,
    });

    reloaded = await getBatchById(db, batch.id as string);
    expect(Number(reloaded.unitsRemaining)).toBeCloseTo(0, 2);
  });

  it("T-VENTA-06 (VEN-008): vender exactamente todas las unidades del lote funciona, vender 1 más se rechaza", async () => {
    const { recipe, product } = await makePanDeMolde5();
    const batch = await produceBatch(db, { recipeId: recipe.id as string, requestedUnits: "5.00", createdBy: null });

    // Vender exactamente las 5 unidades producidas: debe funcionar.
    await registerSale(db, {
      productId: product.id as string,
      batchId: batch.id as string,
      quantity: "5",
      salePricePerUnit: "12.00",
      createdBy: null,
    });

    const reloaded = await getBatchById(db, batch.id as string);
    expect(Number(reloaded.unitsRemaining)).toBeCloseTo(0, 2);

    // Intentar vender 1 unidad más contra el mismo lote ya agotado: rechazo.
    await expect(
      registerSale(db, {
        productId: product.id as string,
        batchId: batch.id as string,
        quantity: "1",
        salePricePerUnit: "12.00",
        createdBy: null,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "BATCH_OVERSELLING" });
  });

  it("T-VENTA-07 (VEN-008): la sobreventa también se rechaza cuando el batchId se resuelve implícitamente", async () => {
    const { recipe, product } = await makePanDeMolde5();
    await produceBatch(db, { recipeId: recipe.id as string, requestedUnits: "5.00", productId: product.id as string, createdBy: null });

    // Sin batchId explícito: se resuelve al lote más reciente (único acá).
    await registerSale(db, {
      productId: product.id as string,
      batchId: null,
      quantity: "5",
      salePricePerUnit: "12.00",
      createdBy: null,
    });

    await expect(
      registerSale(db, {
        productId: product.id as string,
        batchId: null,
        quantity: "1",
        salePricePerUnit: "12.00",
        createdBy: null,
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "BATCH_OVERSELLING" });
  });

  // ---------------------------------------------------------------------
  // Umbral configurable de "producto poco rentable" (RF-012, SDD-07 CU6,
  // SDD-10 §1, SDD-00 pendientes — ahora resuelto).
  // ---------------------------------------------------------------------

  it("T-REPORTE-02: marca isLowProfitability según el umbral configurado (LOW_MARGIN_THRESHOLD_PERCENT)", async () => {
    // Producto de margen alto: costo bajo, precio de venta alto (~70% margen).
    const { recipe: recipeAlto, product: productAlto } = await makePanDeMolde5();
    const batchAlto = await produceBatch(db, { recipeId: recipeAlto.id as string, requestedUnits: "5.00", createdBy: null });
    await registerSale(db, {
      productId: productAlto.id as string,
      batchId: batchAlto.id as string,
      quantity: "5",
      salePricePerUnit: "25.00",
      createdBy: null,
    });

    // Producto de margen bajo: precio de venta apenas por encima del costo
    // congelado (~7.58 Bs/pan), muy por debajo del umbral configurado (20%).
    const { recipe: recipeBajo, product: productBajo } = await makePanDeMolde5();
    const batchBajo = await produceBatch(db, { recipeId: recipeBajo.id as string, requestedUnits: "5.00", createdBy: null });
    await registerSale(db, {
      productId: productBajo.id as string,
      batchId: batchBajo.id as string,
      quantity: "5",
      salePricePerUnit: "7.90",
      createdBy: null,
    });

    const reportAlto = await getProfitabilityReport(db, { productId: productAlto.id as string });
    const reportBajo = await getProfitabilityReport(db, { productId: productBajo.id as string });

    expect(reportAlto.lowProfitabilityThresholdPercent).toBe(config.lowMarginThresholdPercent);
    expect(reportBajo.lowProfitabilityThresholdPercent).toBe(config.lowMarginThresholdPercent);
    expect(reportAlto.data[0].isLowProfitability).toBe(false);
    expect(reportBajo.data[0].isLowProfitability).toBe(true);
  });
});
