// E2E: CRUD completo de Categorías (admin-only), contra el backend real
// (Fastify + Postgres) y la UI real de app/web (sin mocks/stubs de red:
// cy.request() se usa solo para la verificación independiente del borrado,
// nunca para "atajar" el flujo de UI). Reemplaza la cobertura parcial que
// existía en categorias-proveedores.cy.ts (que solo probaba creación) y
// sigue el mismo patrón de ingredientes.cy.ts/recetas.cy.ts.
//
// Particularidad de Categorías frente a Ingredientes/Recetas/Proveedores:
// el borrado NO es lógico, es un DELETE físico, pero está BLOQUEADO por el
// backend cuando hay ingredientes activos o recetas no eliminadas
// referenciando la categoría (ver categoryService.deleteCategory). Por eso
// esta spec prueba ambos caminos: (a) intentar borrar una categoría
// sembrada que SÍ está en uso ("Harinas") y confirmar el bloqueo real, y
// (b) borrar una categoría propia sin referencias y confirmar que
// desaparece de verdad (GET por id devuelve 404, no isActive:false).
//
// Mensajes de error copiados literalmente de
// app/backend/src/services/categoryService.ts y
// validation/categoryValidation.ts (fuente de verdad).

describe("Categorías", () => {
  const runId = Date.now();
  const categoryName = `Categoría QA ${runId}`;
  const editedName = `${categoryName} editada`;
  let categoryId: string;

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.screenshot("categorias-01-login");
  });

  it("Listado: muestra categorías sembradas reales", () => {
    cy.get('[data-testid="nav-categorias"]').click();
    cy.get('[data-testid="categories-page"]').should("be.visible");
    cy.get('[data-testid="category-row"]').should("have.length.greaterThan", 0);
    cy.contains('[data-testid="category-row-name"]', "Harinas").should("be.visible");
    cy.screenshot("categorias-02-listado-real");
  });

  it("Añadir: crea una categoría nueva vía el formulario real", () => {
    cy.get('[data-testid="nav-categorias"]').click();
    cy.get('[data-testid="category-new-button"]').click();
    cy.get('[data-testid="category-create-dialog"]').should("be.visible");
    cy.screenshot("categorias-03-crear-formulario");

    cy.get('[data-testid="category-form-name"]').type(categoryName);
    cy.get('[data-testid="category-form-kind"]').click();
    cy.get('[data-testid="category-form-kind-option-ingrediente"]').click();
    cy.get('[data-testid="category-form-submit"]').click();

    cy.get('[data-testid="category-create-dialog"]').should("not.exist");
    cy.contains('[data-testid="category-row-name"]', categoryName).should("be.visible");
    cy.screenshot("categorias-04-crear-exito");

    // Captura el id real (la tabla no lo expone en el DOM) para poder
    // verificar más adelante, por API, que el borrado exitoso es real.
    cy.apiLoginAsAdmin().then((token) => {
      cy.request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}/categories`,
        qs: { kind: "ingrediente", pageSize: 100 },
        headers: { Authorization: `Bearer ${token}` },
      }).then((resp) => {
        const match = (resp.body.data as Array<{ id: string; name: string }>).find(
          (c) => c.name === categoryName,
        );
        expect(match, "categoría recién creada encontrada por API").to.exist;
        categoryId = match!.id;
      });
    });
  });

  it("Añadir (validación): rechaza un nombre de categoría duplicado del mismo tipo", () => {
    cy.get('[data-testid="nav-categorias"]').click();
    cy.get('[data-testid="category-new-button"]').click();
    cy.get('[data-testid="category-form-name"]').type(categoryName);
    cy.get('[data-testid="category-form-kind"]').click();
    cy.get('[data-testid="category-form-kind-option-ingrediente"]').click();
    cy.get('[data-testid="category-form-submit"]').click();
    cy.get('[data-testid="category-form-error"]').should(
      "contain.text",
      "Ya existe una categoría de ingrediente con ese nombre",
    );
    cy.screenshot("categorias-05-validacion-duplicado");
  });

  it("Modificar: edita el nombre de la categoría creada y refleja el cambio", () => {
    cy.get('[data-testid="nav-categorias"]').click();
    cy.contains('[data-testid="category-row-name"]', categoryName)
      .parents('[data-testid="category-row"]')
      .find('[data-testid="category-edit-button"]')
      .click();
    cy.get('[data-testid="category-edit-dialog"]').should("be.visible");
    cy.screenshot("categorias-06-editar-formulario");

    // El tipo es inmutable tras creación (SDD-05 §4.3): el selector debe
    // quedar deshabilitado en modo edición.
    cy.get('[data-testid="category-form-kind"]').should("be.disabled");

    cy.get('[data-testid="category-form-name"]').clear().type(editedName);
    cy.get('[data-testid="category-form-submit"]').click();
    cy.get('[data-testid="category-edit-dialog"]').should("not.exist");
    cy.contains('[data-testid="category-row-name"]', editedName).should("be.visible");
    cy.screenshot("categorias-07-editar-exito");
  });

  it("Eliminar (bloqueado): el backend rechaza borrar una categoría en uso por ingredientes activos", () => {
    cy.get('[data-testid="nav-categorias"]').click();
    cy.contains('[data-testid="category-row-name"]', "Harinas")
      .parents('[data-testid="category-row"]')
      .find('[data-testid="category-delete-button"]')
      .click();
    cy.get('[data-testid="category-delete-dialog"]').should("be.visible");
    cy.screenshot("categorias-08-dialogo-eliminar-bloqueado");
    cy.get('[data-testid="category-delete-confirm"]').click();

    cy.get('[data-testid="category-delete-error"]')
      .should("be.visible")
      .and("contain.text", "No se puede eliminar")
      .and("contain.text", "usan esta categoría");
    cy.screenshot("categorias-09-error-bloqueado");

    // La categoría sigue existiendo pese al intento fallido de borrado.
    cy.get('[data-testid="category-delete-cancel"]').click();
    cy.contains('[data-testid="category-row-name"]', "Harinas").should("be.visible");
  });

  it("Eliminar (éxito): borra definitivamente una categoría propia sin ingredientes ni recetas asociados", () => {
    cy.get('[data-testid="nav-categorias"]').click();
    cy.contains('[data-testid="category-row-name"]', editedName)
      .parents('[data-testid="category-row"]')
      .find('[data-testid="category-delete-button"]')
      .click();
    cy.get('[data-testid="category-delete-dialog"]').should("be.visible");
    cy.get('[data-testid="category-delete-confirm"]').click();

    cy.get('[data-testid="category-delete-dialog"]').should("not.exist");
    cy.contains('[data-testid="category-row-name"]', editedName).should("not.exist");
    cy.screenshot("categorias-10-eliminada-fisicamente");

    // Verificación independiente por API real: a diferencia de
    // ingredientes/recetas/proveedores (borrado lógico), una categoría sin
    // referencias se borra de verdad de la tabla (categoryService.deleteCategory
    // hace un DELETE real cuando el conteo de uso es 0), así que
    // GET /api/categories/:id debe responder 404, no un registro inactivo.
    cy.apiLoginAsAdmin().then((token) => {
      cy.request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}/categories/${categoryId}`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(404);
      });
    });
  });
});
