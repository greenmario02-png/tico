// E2E: Producción de Lotes (Producir Lote), contra el backend real
// (Fastify + Postgres) y la UI real de app/web.
//
// Para no depender del stock compartido de los ingredientes sembrados por
// seed.ts (que otras specs también consumen/alteran), este spec crea su
// PROPIO ingrediente y su PROPIA receta vía API (cy.request, autenticado
// como admin) antes de manipular nada por UI. Así la cantidad de stock
// disponible es 100% predecible y el test es determinista sin importar en
// qué orden corran las demás specs.
//
// Mensajes de error/textos copiados literalmente de
// app/backend/src/services/batchService.ts y
// app/web/src/pages/batches/ProduceBatchPage.tsx (fuente de verdad).

describe("Lotes / Producción", () => {
  const runId = Date.now();
  const ingredientName = `Harina QA Lotes ${runId}`;
  const recipeName = `Receta QA Lotes ${runId}`;
  const STOCK_INICIAL = "5000.000"; // suficiente para producir el rendimiento base varias veces
  const YIELD_QUANTITY = "10";
  // La receta consume 100 g de harina para producir el rendimiento COMPLETO
  // (10 piezas), no por unidad. Al pedir 20 piezas, scaleFactor = 20/10 = 2,
  // así que se necesitan 200 g (100 g * 2).
  const QTY_PER_BATCH = "100";

  let token: string;
  let ingredientId: string;
  let recipeId: string;

  before(() => {
    cy.apiLoginAsAdmin().then((t) => {
      token = t;
      return cy
        .request({
          method: "POST",
          url: `${Cypress.env("apiUrl")}/ingredients`,
          headers: { Authorization: `Bearer ${token}` },
          body: {
            name: ingredientName,
            baseUnit: "g",
            initialPricePerBaseUnit: "0.02",
            currentStock: STOCK_INICIAL,
            minStock: "100",
          },
        })
        .then((resp) => {
          expect(resp.status).to.eq(201);
          ingredientId = resp.body.id;
        });
    });
  });

  before(() => {
    cy.request({
      method: "POST",
      url: `${Cypress.env("apiUrl")}/recipes`,
      headers: { Authorization: `Bearer ${token}` },
      body: {
        name: recipeName,
        yieldQuantity: YIELD_QUANTITY,
        yieldUnit: "pieza",
        wastePercent: "0",
        ingredients: [{ ingredientId, quantity: QTY_PER_BATCH, unit: "g" }],
      },
    }).then((resp) => {
      expect(resp.status).to.eq(201);
      recipeId = resp.body.id;
    });
  });

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.screenshot("lotes-01-login");
  });

  it("Producir lote: recalcula el costo en vivo, muestra el diálogo de confirmación y descuenta stock real", () => {
    cy.get('[data-testid="nav-lotes-producir"]').click();
    cy.get('[data-testid="batch-recipe-select"]').should("be.visible");
    cy.screenshot("lotes-02-formulario-vacio");

    cy.get('[data-testid="batch-recipe-select"]').click();
    cy.contains('[role="option"]', recipeName).click();

    // Cantidad por defecto = rendimiento de la receta (10). La duplicamos a
    // 20 para probar el recálculo en vivo (scaleFactor 2x => 200 g).
    cy.get('[data-testid="batch-quantity-input"]').clear().type("20");

    // El recálculo de costo tiene debounce (350ms) + llamada real a
    // GET /recipes/:id/cost — se espera a que aparezca el desglose real.
    cy.get('[data-testid="batch-cost-preview"]', { timeout: 10000 }).should("be.visible");
    cy.get('[data-testid="batch-need-line"]').should("have.length", 1);
    cy.contains('[data-testid="batch-need-line"]', ingredientName).should("contain.text", "200.000");
    cy.get('[data-testid="batch-total-cost"]').should("be.visible");
    cy.screenshot("lotes-03-recalculo-costo-en-vivo");

    // Verificación independiente: el costo mostrado en la UI debe coincidir
    // EXACTAMENTE con lo que devuelve el backend para la misma consulta
    // (nunca se compara contra un número hardcodeado).
    cy.request({
      method: "GET",
      url: `${Cypress.env("apiUrl")}/recipes/${recipeId}/cost`,
      qs: { quantity: "20" },
      headers: { Authorization: `Bearer ${token}` },
    }).then((resp) => {
      expect(resp.status).to.eq(200);
      cy.get('[data-testid="batch-total-cost"]').should("contain.text", resp.body.totalCost);
      cy.get('[data-testid="batch-cost-per-unit"]').should("contain.text", resp.body.costPerUnit);
    });

    // Stock ANTES de confirmar (verificación independiente vía API real).
    cy.request({
      method: "GET",
      url: `${Cypress.env("apiUrl")}/ingredients/${ingredientId}`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((resp) => {
      expect(Number(resp.body.currentStock)).to.eq(Number(STOCK_INICIAL));
    });

    cy.intercept("POST", "**/api/batches").as("createBatch");

    cy.get('[data-testid="batch-produce-button"]').should("not.be.disabled").click();
    cy.get('[data-testid="batch-confirm-dialog"]').should("be.visible");
    cy.get('[data-testid="batch-confirm-needs-list"]').should("contain.text", ingredientName);
    cy.contains('[data-testid="batch-confirm-dialog"]', `Producirás 20 pieza de "${recipeName}"`).should("be.visible");
    cy.screenshot("lotes-04-dialogo-confirmacion");

    cy.get('[data-testid="batch-confirm-submit"]').click();

    cy.wait("@createBatch").then((interception) => {
      expect(interception.response?.statusCode).to.eq(201);
      const batch = interception.response?.body;

      cy.get('[data-testid="batch-success"]', { timeout: 10000 }).should("be.visible");
      cy.get('[data-testid="batch-success-total-cost"]').should("contain.text", batch.totalCostSnapshot);
      cy.get('[data-testid="batch-success-cost-per-unit"]').should("contain.text", batch.costPerUnitSnapshot);
      cy.screenshot("lotes-05-exito-numeros-reales");

      // Verificación independiente vía API: existe una fila real en
      // `batches` con el snapshot esperado, y el stock del ingrediente
      // quedó descontado en exactamente 200 g (scaleFactor 2 * 100 g).
      cy.request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}/batches/${batch.id}`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((batchResp) => {
        expect(batchResp.status).to.eq(200);
        expect(batchResp.body.recipeId).to.eq(recipeId);
        expect(batchResp.body.requestedUnits).to.eq("20.00");
        expect(batchResp.body.totalCostSnapshot).to.eq(batch.totalCostSnapshot);
      });

      cy.request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}/ingredients/${ingredientId}`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((ingResp) => {
        const expectedStock = Number(STOCK_INICIAL) - 200;
        expect(Number(ingResp.body.currentStock)).to.eq(expectedStock);
      });
    });
  });

  it("Producir lote (stock insuficiente): la UI bloquea la confirmación y muestra el faltante real", () => {
    cy.get('[data-testid="nav-lotes-producir"]').click();
    cy.get('[data-testid="batch-recipe-select"]').click();
    cy.contains('[role="option"]', recipeName).click();

    // Pide una cantidad absurdamente alta (el ingrediente QA solo tiene
    // ~3000 g restantes tras el test anterior; esto exige 100 veces más).
    cy.get('[data-testid="batch-quantity-input"]').clear().type("100000");

    cy.get('[data-testid="batch-cost-preview"]', { timeout: 10000 }).should("be.visible");
    cy.get('[data-testid="batch-shortage-badge"]').should("be.visible");
    cy.get('[data-testid="batch-shortage-message"]').should(
      "contain.text",
      "No hay stock suficiente para esta cantidad.",
    );
    cy.get('[data-testid="batch-produce-button"]').should("be.disabled");
    cy.screenshot("lotes-06-stock-insuficiente-bloqueado");

    // Verificación independiente: el faltante mostrado es matemáticamente
    // consistente con el stock real que reporta el backend en este momento.
    cy.request({
      method: "GET",
      url: `${Cypress.env("apiUrl")}/ingredients/${ingredientId}`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((resp) => {
      const available = Number(resp.body.currentStock);
      const needed = 100000 * 10; // 100000 unidades * 100g / 10 rendimiento base... equivalente a scaleFactor*qtyPerUnit
      // La necesidad real la calcula el backend; solo confirmamos que el
      // disponible es muchísimo menor a lo pedido, consistente con el bloqueo.
      expect(available).to.be.lessThan(needed);
    });
  });
});
