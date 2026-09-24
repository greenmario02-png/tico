import { describe, expect, it } from "vitest";
import {
  applyWaste,
  computeRecipeCostPure,
  convertUnit,
  realMargin,
  suggestedPrice,
  type CostLineInput,
} from "../../services/costingService";

// SDD-09 §1 — cálculo de costo de receta (algoritmo puro).
describe("computeRecipeCostPure (SDD-04 §1 / SDD-09 §1)", () => {
  it("T-COSTO-01: caso básico correcto", () => {
    const lines: CostLineInput[] = [
      {
        type: "ingredient",
        ingredientId: "harina",
        ingredientName: "Harina de trigo",
        quantity: 1,
        unit: "kg",
        baseUnit: "g",
        pricePerBaseUnit: 12.5 / 1000, // 12.50 Bs/kg
      },
      {
        type: "ingredient",
        ingredientId: "azucar",
        ingredientName: "Azúcar blanca",
        quantity: 0.5,
        unit: "kg",
        baseUnit: "g",
        pricePerBaseUnit: 8.0 / 1000, // 8.00 Bs/kg
      },
    ];

    const result = computeRecipeCostPure({ yieldQuantity: 10, wastePercent: 0, lines });

    expect(result.totalCost).toBeCloseTo(16.5, 2);
    expect(result.costPerUnit).toBeCloseTo(1.65, 2);
  });

  it("T-COSTO-02: múltiples ingredientes con distintas unidades (conversión g/kg, ml/L)", () => {
    const lines: CostLineInput[] = [
      { type: "ingredient", ingredientId: "1", ingredientName: "Harina de trigo", quantity: 1, unit: "kg", baseUnit: "g", pricePerBaseUnit: 0.0135 },
      { type: "ingredient", ingredientId: "2", ingredientName: "Azúcar blanca", quantity: 0.5, unit: "kg", baseUnit: "g", pricePerBaseUnit: 0.008 },
      { type: "ingredient", ingredientId: "3", ingredientName: "Mantequilla", quantity: 0.3, unit: "kg", baseUnit: "g", pricePerBaseUnit: 0.032 },
      { type: "ingredient", ingredientId: "4", ingredientName: "Huevos", quantity: 10, unit: "pieza", baseUnit: "pieza", pricePerBaseUnit: 0.6 },
      { type: "ingredient", ingredientId: "5", ingredientName: "Leche", quantity: 0.5, unit: "l", baseUnit: "ml", pricePerBaseUnit: 0.0035 },
      { type: "ingredient", ingredientId: "6", ingredientName: "Levadura", quantity: 5, unit: "g", baseUnit: "g", pricePerBaseUnit: 0.04 },
    ];

    const result = computeRecipeCostPure({ yieldQuantity: 24, wastePercent: 0, lines });

    expect(result.details[0].baseQuantity).toBeCloseTo(1000, 3);
    expect(result.details[4].baseQuantity).toBeCloseTo(500, 3);
    expect(result.totalCost).toBeCloseTo(35.05, 2);
    expect(result.costPerUnit).toBeCloseTo(1.4604, 3);
  });

  it("T-COSTO-03: receta anidada (sub-receta) resuelta por el llamador", () => {
    // "Masa Base": costoPorUnidad = 0.695 Bs/porción (6.95 / 10)
    const lines: CostLineInput[] = [
      { type: "sub_recipe", subRecipeId: "masa-base", subRecipeName: "Masa Base", quantity: 2, unit: "porcion", costPerUnit: 0.695 },
      { type: "ingredient", ingredientId: "azucar", ingredientName: "Azúcar blanca", quantity: 0.2, unit: "kg", baseUnit: "g", pricePerBaseUnit: 0.008 },
      { type: "ingredient", ingredientId: "mantequilla", ingredientName: "Mantequilla", quantity: 0.1, unit: "kg", baseUnit: "g", pricePerBaseUnit: 0.032 },
    ];

    const result = computeRecipeCostPure({ yieldQuantity: 5, wastePercent: 0, lines });

    expect(result.totalCost).toBeCloseTo(6.19, 2);
    expect(result.costPerUnit).toBeCloseTo(1.238, 3);
  });
});

describe("convertUnit (SDD-04 §2)", () => {
  it("convierte kg a g, taza/cucharada a ml, docena a pieza", () => {
    expect(convertUnit(1.5, "kg", "g")).toBe(1500);
    expect(convertUnit(2, "taza", "ml")).toBe(480);
    expect(convertUnit(3, "cucharada", "ml")).toBe(45);
    expect(convertUnit(2, "docena", "pieza")).toBe(24);
  });

  it("rechaza unidades incompatibles con la unidad base del ingrediente", () => {
    expect(() => convertUnit(10, "pieza", "g")).toThrow();
  });
});

// SDD-09 §2 — ajuste por merma.
describe("applyWaste (SDD-04 §3 / SDD-09 §2)", () => {
  it("T-MERMA-01: merma de 5% sobre el total de Pan de Molde (35.05 Bs)", () => {
    const withWaste = applyWaste(35.05, 5);
    expect(withWaste).toBeCloseTo(36.89, 2);
  });

  it("T-MERMA-02: merma de 0% da exactamente el mismo valor", () => {
    expect(applyWaste(35.05, 0)).toBe(35.05);
  });

  it("T-MERMA-03: caso A válido — merma de 99% (factor 100)", () => {
    const result = applyWaste(1000, 99);
    expect(result).toBeCloseTo(100000, 0);
  });

  it("T-MERMA-03: caso B inválido — merma de 100% se rechaza", () => {
    expect(() => applyWaste(1000, 100)).toThrow();
  });

  it("rechaza merma negativa", () => {
    expect(() => applyWaste(1000, -1)).toThrow();
  });
});

// SDD-09 §5 — margen y precio de venta.
describe("suggestedPrice / realMargin (SDD-04 §6 / SDD-09 §5)", () => {
  it("T-MARGEN-01: precio sugerido desde margen deseado", () => {
    const price = suggestedPrice(1.54, 35);
    expect(price).toBeCloseTo(2.37, 2);
  });

  it("T-MARGEN-02: margen real desde precio ya fijado", () => {
    const { marginReal, profitPerUnit } = realMargin(2.5, 1.54);
    expect(profitPerUnit).toBeCloseTo(0.96, 2);
    expect(marginReal).toBeCloseTo(0.384, 3);
  });

  it("T-MARGEN-03: caso A — margen = 100% se rechaza", () => {
    expect(() => suggestedPrice(1.54, 100)).toThrow();
  });

  it("T-MARGEN-03: caso B — margen = 120% se rechaza", () => {
    expect(() => suggestedPrice(1.54, 120)).toThrow();
  });

  it("realMargin rechaza precio de venta <= 0", () => {
    expect(() => realMargin(0, 1.54)).toThrow();
  });
});
