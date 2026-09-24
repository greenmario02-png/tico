// E2E: CRUD completo + borrado lógico de Proveedores, contra el backend
// real (Fastify + Postgres) y la UI real de app/web (sin mocks/stubs de
// red: cy.request() se usa solo para la verificación independiente del
// borrado lógico, nunca para "atajar" el flujo de UI). Reemplaza la
// cobertura parcial que existía en categorias-proveedores.cy.ts (que solo
// probaba creación) y sigue el mismo patrón de ingredientes.cy.ts.
//
// A diferencia de Categorías, el borrado de Proveedores SÍ es lógico
// (isActive=false, ver supplierService.deactivateSupplier / SDD-05 §5.4):
// un proveedor puede estar referenciado por ingredientes históricos, así
// que nunca se borra físicamente.
//
// Mensajes de error copiados literalmente de
// app/backend/src/services/supplierService.ts y
// validation/supplierValidation.ts (fuente de verdad).

describe("Proveedores", () => {
  const runId = Date.now();
  const supplierName = `Proveedor QA ${runId}`;
  const editedName = `${supplierName} editado`;
  let supplierId: string;

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.screenshot("proveedores-01-login");
  });

  it("Listado: muestra proveedores sembrados reales", () => {
    cy.get('[data-testid="nav-proveedores"]').click();
    cy.get('[data-testid="suppliers-page"]').should("be.visible");
    cy.get('[data-testid="supplier-row"]').should("have.length.greaterThan", 0);
    cy.contains('[data-testid="supplier-row-name"]', "Molino La Paz").should("be.visible");
    cy.screenshot("proveedores-02-listado-real");
  });

  it("Añadir: crea un proveedor nuevo vía el formulario real", () => {
    cy.get('[data-testid="nav-proveedores"]').click();
    cy.get('[data-testid="supplier-new-button"]').click();
    cy.get('[data-testid="supplier-create-dialog"]').should("be.visible");
    cy.screenshot("proveedores-03-crear-formulario");

    cy.get('[data-testid="supplier-form-name"]').type(supplierName);
    cy.get('[data-testid="supplier-form-contact"]').type("Juan Pérez");
    cy.get('[data-testid="supplier-form-phone"]').type("70012345");
    cy.get('[data-testid="supplier-form-submit"]').click();

    cy.get('[data-testid="supplier-create-dialog"]').should("not.exist");
    cy.contains('[data-testid="supplier-row-name"]', supplierName).should("be.visible");
    cy.screenshot("proveedores-04-crear-exito");
  });

  it("Añadir (validación): rechaza un nombre de proveedor duplicado", () => {
    cy.get('[data-testid="nav-proveedores"]').click();
    cy.get('[data-testid="supplier-new-button"]').click();
    cy.get('[data-testid="supplier-form-name"]').type(supplierName);
    cy.get('[data-testid="supplier-form-submit"]').click();
    cy.get('[data-testid="supplier-form-error"]').should(
      "contain.text",
      `Ya existe un proveedor llamado "${supplierName}".`,
    );
    cy.screenshot("proveedores-05-validacion-duplicado");
  });

  it("Modificar: edita nombre, contacto y teléfono del proveedor creado y refleja el cambio", () => {
    cy.get('[data-testid="nav-proveedores"]').click();
    cy.contains('[data-testid="supplier-row-name"]', supplierName)
      .parents('[data-testid="supplier-row"]')
      .find('[data-testid="supplier-edit-button"]')
      .click();
    cy.get('[data-testid="supplier-edit-dialog"]').should("be.visible");
    cy.screenshot("proveedores-06-editar-formulario");

    cy.get('[data-testid="supplier-form-name"]').clear().type(editedName);
    cy.get('[data-testid="supplier-form-contact"]').clear().type("María Editada");
    cy.get('[data-testid="supplier-form-phone"]').clear().type("70099999");
    cy.get('[data-testid="supplier-form-submit"]').click();

    cy.get('[data-testid="supplier-edit-dialog"]').should("not.exist");
    cy.contains('[data-testid="supplier-row-name"]', editedName).should("be.visible");
    cy.contains('[data-testid="supplier-row"]', "María Editada").should("be.visible");
    cy.contains('[data-testid="supplier-row"]', "70099999").should("be.visible");
    cy.screenshot("proveedores-07-editar-exito");

    // Captura el id real (la tabla no lo expone en el DOM) para la
    // verificación de borrado lógico del siguiente test.
    cy.apiLoginAsAdmin().then((token) => {
      cy.request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}/suppliers`,
        qs: { search: editedName, pageSize: 100 },
        headers: { Authorization: `Bearer ${token}` },
      }).then((resp) => {
        const match = (resp.body.data as Array<{ id: string; name: string }>).find(
          (s) => s.name === editedName,
        );
        expect(match, "proveedor editado encontrado por API").to.exist;
        supplierId = match!.id;
      });
    });
  });

  it("Eliminar (borrado lógico): desaparece del listado activo pero sigue existiendo en la BD como inactivo", () => {
    cy.get('[data-testid="nav-proveedores"]').click();
    cy.contains('[data-testid="supplier-row-name"]', editedName)
      .parents('[data-testid="supplier-row"]')
      .find('[data-testid="supplier-delete-button"]')
      .click();
    cy.get('[data-testid="supplier-delete-dialog"]').should("be.visible");
    cy.screenshot("proveedores-08-dialogo-desactivar");
    cy.get('[data-testid="supplier-delete-confirm"]').click();

    // Por defecto el listado filtra isActive=true (ver SuppliersPage), así
    // que el proveedor recién desactivado desaparece de la vista activa.
    cy.get('[data-testid="supplier-delete-dialog"]').should("not.exist");
    cy.contains('[data-testid="supplier-row-name"]', editedName).should("not.exist");
    cy.screenshot("proveedores-09-desaparece-de-activos");

    // Con "Mostrar desactivados" marcado, el proveedor reaparece con el
    // badge de "desactivado" — confirmando en la propia UI que no fue un
    // DELETE físico.
    cy.get('[data-testid="supplier-show-inactive"]').click();
    cy.contains('[data-testid="supplier-row-name"]', editedName)
      .parents('[data-testid="supplier-row"]')
      .contains("desactivado")
      .should("be.visible");
    cy.screenshot("proveedores-10-visible-como-desactivado");

    // Verificación independiente por API real (no UI): GET /api/suppliers/:id
    // NO filtra por isActive (mismo patrón que ingredientService), así que
    // un registro desactivado se sigue pudiendo consultar por id y debe
    // traer isActive:false — la prueba de que es un borrado LÓGICO, no un
    // DELETE físico de la fila.
    cy.apiLoginAsAdmin().then((token) => {
      cy.request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}/suppliers/${supplierId}`,
        headers: { Authorization: `Bearer ${token}` },
      }).then((resp) => {
        expect(resp.status).to.eq(200);
        expect(resp.body.id).to.eq(supplierId);
        expect(resp.body.name).to.eq(editedName);
        expect(resp.body.isActive).to.eq(false);
      });
    });
  });

  it("Integración: crea un ingrediente referenciando una categoría y un proveedor reales", () => {
    const categoryName = `Categoría QA integ ${runId}`;
    const supplierName2 = `Proveedor QA integ ${runId}`;
    const ingredientName = `Ingrediente QA cat-prov ${runId}`;

    cy.get('[data-testid="nav-categorias"]').click();
    cy.get('[data-testid="category-new-button"]').click();
    cy.get('[data-testid="category-form-name"]').type(categoryName);
    cy.get('[data-testid="category-form-kind"]').click();
    cy.get('[data-testid="category-form-kind-option-ingrediente"]').click();
    cy.get('[data-testid="category-form-submit"]').click();
    cy.get('[data-testid="category-create-dialog"]').should("not.exist");

    cy.get('[data-testid="nav-proveedores"]').click();
    cy.get('[data-testid="supplier-new-button"]').click();
    cy.get('[data-testid="supplier-form-name"]').type(supplierName2);
    cy.get('[data-testid="supplier-form-submit"]').click();
    cy.get('[data-testid="supplier-create-dialog"]').should("not.exist");

    cy.get('[data-testid="nav-ingredientes"]').click();
    cy.get('[data-testid="ingredient-new-button"]').click();
    cy.get('[data-testid="ingredient-create-dialog"]').should("be.visible");

    cy.get('[data-testid="ingredient-form-name"]').type(ingredientName);
    cy.get('[data-testid="ingredient-form-unit"]').click();
    cy.get('[data-testid="ingredient-form-unit-option-g"]').click();
    cy.get('[data-testid="ingredient-form-price"]').type("5");

    cy.get('[data-testid="ingredient-form-category"]').click();
    cy.contains('[data-testid^="ingredient-form-category-option-"]', categoryName).click();
    cy.get('[data-testid="ingredient-form-supplier"]').click();
    cy.contains('[data-testid^="ingredient-form-supplier-option-"]', supplierName2).click();

    cy.get('[data-testid="ingredient-form-submit"]').click();
    cy.get('[data-testid="ingredient-create-dialog"]').should("not.exist");

    cy.get('[data-testid="ingredient-search-input"]').clear().type(ingredientName);
    cy.contains('[data-testid="ingredient-row-name"]', ingredientName)
      .parents('[data-testid="ingredient-row"]')
      .find('[data-testid="ingredient-view-button"]')
      .click();

    // Verificación en la propia UI: el detalle del ingrediente muestra el
    // nombre real de la categoría/proveedor elegidos (categoryName/
    // supplierName vienen resueltos por el backend, ver types.ts).
    cy.contains(categoryName).should("be.visible");
    cy.contains(supplierName2).should("be.visible");
    cy.screenshot("proveedores-11-integracion-ingrediente-cat-prov");

    // Verificación independiente por API real: confirma que categoryId y
    // supplierId quedaron efectivamente guardados en el ingrediente (no
    // solo mostrados en la UI).
    cy.url().then((url) => {
      const ingredientId = url.split("/ingredientes/")[1];
      cy.apiLoginAsAdmin().then((token) => {
        cy.request({
          method: "GET",
          url: `${Cypress.env("apiUrl")}/ingredients/${ingredientId}`,
          headers: { Authorization: `Bearer ${token}` },
        }).then((resp) => {
          expect(resp.status).to.eq(200);
          expect(resp.body.categoryName).to.eq(categoryName);
          expect(resp.body.supplierName).to.eq(supplierName2);
          expect(resp.body.categoryId).to.be.a("string").and.not.be.empty;
          expect(resp.body.supplierId).to.be.a("string").and.not.be.empty;
        });
      });
    });
  });
});
