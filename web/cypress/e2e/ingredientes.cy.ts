// E2E: CRUD completo + borrado lógico de Ingredientes, contra el backend
// real (Fastify + Postgres) y la UI real de app/web (sin mocks/stubs de
// red: cy.request() se usa solo para la verificación independiente del
// borrado lógico, nunca para "atajar" el flujo de UI).
//
// Mensajes de error esperados: copiados literalmente de
// app/backend/src/services/validation/ingredientValidation.ts y
// app/backend/src/services/ingredientService.ts (fuente de verdad, ver
// también SDD-06-VALIDACIONES.md), nunca inventados en la spec.

describe("Ingredientes", () => {
  const runId = Date.now();
  const originalName = `Ingrediente QA ${runId}`;
  const editedName = `${originalName} editado`;
  let ingredientId: string;

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.screenshot("ingredientes-01-login");
  });

  it("Listado: muestra ingredientes sembrados reales", () => {
    // Nota importante: el JWT vive SOLO en memoria (ver src/lib/api.ts), así
    // que cy.visit() a otra ruta después de loguearse recargaría la página y
    // perdería la sesión. Por eso, después del login, la navegación dentro
    // de la SPA se hace con clics en el menú real (nav-*), nunca con
    // cy.visit() de nuevo.
    cy.get('[data-testid="nav-ingredientes"]').click();
    cy.get('[data-testid="ingredient-row"]').should("have.length.greaterThan", 0);
    cy.contains('[data-testid="ingredient-row-name"]', "Harina de trigo").should("be.visible");
    cy.screenshot("ingredientes-02-listado-real");
  });

  it("Añadir: crea un ingrediente nuevo vía el formulario real", () => {
    cy.get('[data-testid="nav-ingredientes"]').click();
    cy.get('[data-testid="ingredient-new-button"]').click();
    cy.get('[data-testid="ingredient-create-dialog"]').should("be.visible");
    cy.screenshot("ingredientes-03-crear-formulario");

    cy.get('[data-testid="ingredient-form-name"]').type(originalName);
    // Unidad base por defecto "g" ya viene seleccionada; queda explícita
    // para que el test no dependa de un valor por defecto silencioso.
    cy.get('[data-testid="ingredient-form-unit"]').click();
    cy.get('[data-testid="ingredient-form-unit-option-g"]').click();
    cy.get('[data-testid="ingredient-form-price"]').type("12.5");
    cy.get('[data-testid="ingredient-form-minstock"]').clear().type("5");
    cy.get('[data-testid="ingredient-form-submit"]').click();

    cy.get('[data-testid="ingredient-create-dialog"]').should("not.exist");

    cy.get('[data-testid="ingredient-search-input"]').clear().type(originalName);
    cy.contains('[data-testid="ingredient-row-name"]', originalName).should("be.visible");
    cy.screenshot("ingredientes-04-crear-exito");
  });

  it("Añadir (validación): rechaza un nombre de ingrediente duplicado", () => {
    cy.get('[data-testid="nav-ingredientes"]').click();
    cy.get('[data-testid="ingredient-new-button"]').click();
    cy.get('[data-testid="ingredient-form-name"]').type("Harina de trigo");
    cy.get('[data-testid="ingredient-form-price"]').type("1");
    cy.get('[data-testid="ingredient-form-submit"]').click();
    cy.get('[data-testid="ingredient-form-error"]').should(
      "contain.text",
      'Ya existe un ingrediente llamado "Harina de trigo". Usa ese o cambia el nombre.',
    );
    cy.screenshot("ingredientes-05-validacion-duplicado");
  });

  it("Modificar: edita el nombre del ingrediente creado y refleja el cambio", () => {
    cy.get('[data-testid="nav-ingredientes"]').click();
    cy.get('[data-testid="ingredient-search-input"]').clear().type(originalName);
    cy.contains('[data-testid="ingredient-row-name"]', originalName)
      .parents('[data-testid="ingredient-row"]')
      .find('[data-testid="ingredient-view-button"]')
      .click();

    cy.url().should("match", /\/ingredientes\/[^/]+$/);
    cy.url().then((url) => {
      ingredientId = url.split("/ingredientes/")[1];
      expect(ingredientId).to.have.length.greaterThan(0);
    });

    cy.get('[data-testid="ingredient-detail-name"]').should("contain.text", originalName);
    cy.get('[data-testid="ingredient-edit-button"]').click();
    cy.get('[data-testid="ingredient-edit-dialog"]').should("be.visible");
    cy.screenshot("ingredientes-06-editar-formulario");
    cy.get('[data-testid="ingredient-form-name"]').clear().type(editedName);
    cy.get('[data-testid="ingredient-form-submit"]').click();
    cy.get('[data-testid="ingredient-edit-dialog"]').should("not.exist");
    cy.get('[data-testid="ingredient-detail-name"]').should("contain.text", editedName);
    cy.screenshot("ingredientes-07-editar-exito");

    // También lo registra una nueva compra + cambio de precio (flujo real
    // de la pantalla de detalle, SDD-08 §3.3): confirma que el cambio de
    // precio queda reflejado y nunca sobrescribe el historial anterior.
    cy.get('[data-testid="ingredient-price-input"]').type("15.75");
    cy.get('[data-testid="ingredient-price-submit"]').click();
    cy.get('[data-testid="ingredient-price-success"]').should("be.visible");
    cy.screenshot("ingredientes-08-precio-actualizado");

    cy.get('[data-testid="nav-ingredientes"]').click();
    cy.get('[data-testid="ingredient-search-input"]').clear().type(editedName);
    cy.contains('[data-testid="ingredient-row-name"]', editedName).should("be.visible");
  });

  it("Eliminar (borrado lógico): desaparece del listado pero sigue existiendo en la BD como inactivo", () => {
    cy.get('[data-testid="nav-ingredientes"]').click();
    cy.get('[data-testid="ingredient-search-input"]').clear().type(editedName);
    cy.contains('[data-testid="ingredient-row-name"]', editedName)
      .parents('[data-testid="ingredient-row"]')
      .find('[data-testid="ingredient-view-button"]')
      .click();

    cy.get('[data-testid="ingredient-delete-button"]').click();
    cy.get('[data-testid="ingredient-delete-dialog"]').should("be.visible");
    cy.screenshot("ingredientes-09-dialogo-eliminar");
    cy.get('[data-testid="ingredient-delete-confirm"]').click();

    // La UI redirige al listado y el ingrediente ya no aparece (el listado
    // por defecto filtra isActive=true, ver ingredientService.listIngredients).
    cy.url().should("match", /\/ingredientes$/);
    cy.get('[data-testid="ingredient-search-input"]').clear().type(editedName);
    cy.get('[data-testid="ingredients-empty"]').should("be.visible");
    cy.get('[data-testid="ingredient-row"]').should("not.exist");
    cy.screenshot("ingredientes-10-eliminado-borrado-logico");

    // Verificación independiente vía API real (no UI): GET /api/ingredients/:id
    // NO filtra por isActive (ver ingredientService.getIngredientById), así
    // que un registro borrado lógicamente se sigue pudiendo consultar por id
    // y debe traer isActive:false — la prueba de que es un borrado LÓGICO,
    // no un DELETE físico de la fila.
    cy.apiLoginAsAdmin().then((token) => {
      cy.request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}/ingredients/${ingredientId}`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((resp) => {
        expect(resp.status).to.eq(200);
        expect(resp.body.id).to.eq(ingredientId);
        expect(resp.body.name).to.eq(editedName);
        expect(resp.body.isActive).to.eq(false);
      });
    });
  });
});
