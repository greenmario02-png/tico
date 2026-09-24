import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "../../db/client";
import { ingredients } from "../../db/schema/index";
import { getCurrentPrice, insertPrice } from "../../services/priceHistoryService";
import { eq } from "drizzle-orm";

// SDD-09 §7 — T-HIST-01 y T-HIST-02, implementados literalmente.
describe("Historial de precios (SDD-09 §7)", () => {
  let ingredientId: string;

  beforeAll(async () => {
    const [row] = await db
      .insert(ingredients)
      .values({ name: `Harina de trigo TEST ${Date.now()}`, baseUnit: "g", currentStock: "0", minStock: "0" })
      .returning();
    ingredientId = row.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("T-HIST-01: nunca se sobrescribe — insertar dos precios, ambos existen", async () => {
    const first = await insertPrice(db, {
      ingredientId,
      pricePerBaseUnit: "0.0125",
      effectiveAt: new Date("2026-08-01T00:00:00Z"),
    });
    const second = await insertPrice(db, {
      ingredientId,
      pricePerBaseUnit: "0.0135",
      effectiveAt: new Date("2026-09-17T00:00:00Z"),
    });

    const { ingredientPriceHistory: table } = await import("../../db/schema/index");
    const rows = await db.select().from(table).where(eq(table.ingredientId, ingredientId));

    expect(rows).toHaveLength(2);
    const reloaded = rows.find((r) => r.id === first.id);
    expect(reloaded?.pricePerBaseUnit).toBe("0.0125");
    expect(rows.find((r) => r.id === second.id)?.pricePerBaseUnit).toBe("0.0135");
  });

  it('T-HIST-02: "precio vigente" siempre trae el más reciente con fecha ya pasada', async () => {
    await insertPrice(db, {
      ingredientId,
      pricePerBaseUnit: "0.0130",
      effectiveAt: new Date("2026-09-10T00:00:00Z"),
    });

    // Caso A: fecha de referencia = 2026-09-17 (igual al último registro conocido)
    const caseA = await getCurrentPrice(db, ingredientId, new Date("2026-09-17T00:00:00Z"));
    expect(caseA?.pricePerBaseUnit).toBe("0.0135");

    // Caso B: se registra un precio futuro (2026-10-01); no debe considerarse vigente hoy.
    await insertPrice(db, {
      ingredientId,
      pricePerBaseUnit: "0.0140",
      effectiveAt: new Date("2026-10-01T00:00:00Z"),
    });

    const caseB = await getCurrentPrice(db, ingredientId, new Date("2026-09-17T00:00:00Z"));
    expect(caseB?.pricePerBaseUnit).toBe("0.0135");

    // El registro futuro sí resuelve correctamente en su propia fecha.
    const caseC = await getCurrentPrice(db, ingredientId, new Date("2026-10-01T00:00:00Z"));
    expect(caseC?.pricePerBaseUnit).toBe("0.0140");
  });

  it("T-HIST-03: resuelve el precio vigente en fechas intermedias del historial (SDD-09 T-COSTO-04)", async () => {
    const caseA = await getCurrentPrice(db, ingredientId, new Date("2026-09-12T00:00:00Z"));
    expect(caseA?.pricePerBaseUnit).toBe("0.0130");

    const caseB = await getCurrentPrice(db, ingredientId, new Date("2026-09-05T00:00:00Z"));
    expect(caseB?.pricePerBaseUnit).toBe("0.0125");
  });
});
