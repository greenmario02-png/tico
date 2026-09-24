// E2E: CRUD completo + borrado lógico de Recetas, más los dos flujos que el
// usuario pidió explícitamente: (1) crear un ingrediente nuevo desde dentro
// del formulario de receta (modal de creación rápida), y (2) que el backend
// rechace una sub-receta que crearía un ciclo. Mensajes de error copiados
// literalmente de app/backend/src/services/recipeService.ts y
// validation/recipeValidation.ts (fuente de verdad).

describe("Recetas", () => {
  const runId = Date.now();
  const originalName = `Receta QA ${runId}`;
  const editedName = `${originalName} editada`;
  let recipeId: string;

  beforeEach(() => {
    cy.loginAsAdmin();
    cy.screenshot("recetas-01-login");
  });

  it("Listado: muestra recetas sembradas reales", () => {
    cy.get('[data-testid="nav-recetas"]').click();
    cy.get('[data-testid="recipe-row"]').should("have.length.greaterThan", 0);
    cy.contains('[data-testid="recipe-row-name"]', "Pan de Molde").should("be.visible");
    cy.screenshot("recetas-02-listado-real");
  });

  it("Añadir: crea una receta nueva con un ingrediente real", () => {
    cy.get('[data-testid="nav-recetas"]').click();
    cy.get('[data-testid="recipe-new-button"]').click();
    cy.get('[data-testid="recipe-create-dialog"]').should("be.visible");
    cy.screenshot("recetas-03-crear-formulario");

    cy.get('[data-testid="recipe-form-name"]').type(originalName);
    cy.get('[data-testid="recipe-form-yield"]').clear().type("10");
    cy.get('[data-testid="recipe-form-waste"]').clear().type("0");

    cy.get('[data-testid="recipe-form-add-ingredient"]').click();
    cy.get('[data-testid="recipe-form-line"]').within(() => {
      cy.get('[data-testid="ingredient-picker-search"]').type("Harina de trigo");
    });
    cy.contains('[data-testid="ingredient-picker-option"]', "Harina de trigo").click();
    cy.get('[data-testid="recipe-form-line-quantity"]').type("200");
    // Unidad por defecto "g" ya es correcta para Harina de trigo (baseUnit g).

    cy.get('[data-testid="recipe-form-submit"]').click();
    cy.get('[data-testid="recipe-create-dialog"]').should("not.exist");

    cy.get('[data-testid="recipe-search-input"]').clear().type(originalName);
    cy.contains('[data-testid="recipe-row-name"]', originalName).should("be.visible");
    cy.screenshot("recetas-04-crear-exito");
  });

  it("Añadir (validación): rechaza un nombre de receta duplicado", () => {
    cy.get('[data-testid="nav-recetas"]').click();
    cy.get('[data-testid="recipe-new-button"]').click();
    cy.get('[data-testid="recipe-form-name"]').type(originalName);
    cy.get('[data-testid="recipe-form-add-ingredient"]').click();
    cy.get('[data-testid="ingredient-picker-search"]').type("Azúcar blanca");
    cy.contains('[data-testid="ingredient-picker-option"]', "Azúcar blanca").click();
    cy.get('[data-testid="recipe-form-line-quantity"]').type("50");
    cy.get('[data-testid="recipe-form-submit"]').click();
    cy.get('[data-testid="recipe-form-error"]').should("contain.text", `Ya existe una receta llamada "${originalName}".`);
    cy.screenshot("recetas-05-validacion-duplicado");
  });

  it("Modificar: edita el nombre de la receta creada y refleja el cambio", () => {
    cy.get('[data-testid="nav-recetas"]').click();
    cy.get('[data-testid="recipe-search-input"]').clear().type(originalName);
    cy.contains('[data-testid="recipe-row-name"]', originalName)
      .parents('[data-testid="recipe-row"]')
      .find('[data-testid="recipe-view-button"]')
      .click();

    cy.url().should("match", /\/recetas\/[^/]+$/);
    cy.url().then((url) => {
      recipeId = url.split("/recetas/")[1];
      expect(recipeId).to.have.length.greaterThan(0);
    });

    cy.get('[data-testid="recipe-detail-name"]').should("contain.text", originalName);
    cy.get('[data-testid="recipe-edit-button"]').click();
    cy.get('[data-testid="recipe-edit-dialog"]').should("be.visible");
    cy.get('[data-testid="recipe-form-name"]').clear().type(editedName);
    cy.get('[data-testid="recipe-form-submit"]').click();
    cy.get('[data-testid="recipe-edit-dialog"]').should("not.exist");
    cy.get('[data-testid="recipe-detail-name"]').should("contain.text", editedName);
    cy.screenshot("recetas-06-editar-exito");

    cy.get('[data-testid="nav-recetas"]').click();
    cy.get('[data-testid="recipe-search-input"]').clear().type(editedName);
    cy.contains('[data-testid="recipe-row-name"]', editedName).should("be.visible");
  });

  it("Eliminar (borrado lógico): desaparece del listado pero sigue existiendo en la BD marcada isDeleted", () => {
    cy.get('[data-testid="nav-recetas"]').click();
    cy.get('[data-testid="recipe-search-input"]').clear().type(editedName);
    cy.contains('[data-testid="recipe-row-name"]', editedName)
      .parents('[data-testid="recipe-row"]')
      .find('[data-testid="recipe-view-button"]')
      .click();

    cy.get('[data-testid="recipe-delete-button"]').click();
    cy.get('[data-testid="recipe-delete-dialog"]').should("be.visible");
    cy.screenshot("recetas-07-dialogo-eliminar");
    cy.get('[data-testid="recipe-delete-confirm"]').click();

    cy.url().should("match", /\/recetas$/);
    cy.get('[data-testid="recipe-search-input"]').clear().type(editedName);
    cy.get('[data-testid="recipes-empty"]').should("be.visible");
    cy.get('[data-testid="recipe-row"]').should("not.exist");
    cy.screenshot("recetas-08-eliminado-borrado-logico");

    // Verificación independiente vía API real: GET /api/recipes/:id (sin
    // includeDeleted) devuelve 404 (isDeleted oculta el registro por
    // defecto, ver recipeService.getRecipeById), pero con
    // ?includeDeleted=true el registro SIGUE existiendo con isDeleted:true
    // — la prueba de que es un borrado LÓGICO, no un DELETE físico de la fila.
    cy.apiLoginAsAdmin().then((token) => {
      cy.request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}/recipes/${recipeId}`,
        headers: { Authorization: `Bearer ${token}` },
        failOnStatusCode: false,
      }).then((resp) => {
        expect(resp.status).to.eq(404);
      });

      cy.request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}/recipes/${recipeId}`,
        qs: { includeDeleted: "true" },
        headers: { Authorization: `Bearer ${token}` },
      }).then((resp) => {
        expect(resp.status).to.eq(200);
        expect(resp.body.id).to.eq(recipeId);
        expect(resp.body.name).to.eq(editedName);
        expect(resp.body.isDeleted).to.eq(true);
      });
    });
  });

  it("Crear ingrediente nuevo desde el picker de una receta (modal de creación rápida)", () => {
    const inlineIngredientName = `Ingrediente inline QA ${runId}`;
    const recipeWithInlineIngredient = `Receta con ingrediente inline ${runId}`;

    cy.get('[data-testid="nav-recetas"]').click();
    cy.get('[data-testid="recipe-new-button"]').click();
    cy.get('[data-testid="recipe-form-name"]').type(recipeWithInlineIngredient);
    cy.get('[data-testid="recipe-form-yield"]').clear().type("5");

    cy.get('[data-testid="recipe-form-add-ingredient"]').click();
    cy.get('[data-testid="ingredient-picker-search"]').type(inlineIngredientName);
    cy.get('[data-testid="ingredient-picker-create-new"]').click();

    cy.get('[data-testid="ingredient-quick-create-dialog"]').should("be.visible");
    cy.get('[data-testid="ingredient-form-name"]').type(inlineIngredientName);
    cy.get('[data-testid="ingredient-form-price"]').type("3.25");
    cy.get('[data-testid="ingredient-form-submit"]').click();
    cy.get('[data-testid="ingredient-quick-create-dialog"]').should("not.exist");

    // El ingrediente recién creado queda seleccionado automáticamente en la
    // línea que se estaba editando (requisito explícito de UX, ver
    // IngredientPicker.tsx).
    cy.get('[data-testid="ingredient-picker-search"]').should("have.value", inlineIngredientName);
    cy.get('[data-testid="recipe-form-line-quantity"]').type("10");

    cy.get('[data-testid="recipe-form-submit"]').click();
    cy.get('[data-testid="recipe-create-dialog"]').should("not.exist");

    cy.get('[data-testid="recipe-search-input"]').clear().type(recipeWithInlineIngredient);
    cy.contains('[data-testid="recipe-row-name"]', recipeWithInlineIngredient)
      .parents('[data-testid="recipe-row"]')
      .find('[data-testid="recipe-view-button"]')
      .click();
    cy.contains('[data-testid="recipe-ingredient-lines"] li', inlineIngredientName).should("be.visible");
    cy.screenshot("recetas-09-ingrediente-inline-creado");
  });

  it("Sub-receta cíclica: el backend rechaza una referencia circular entre recetas", () => {
    const recipeAName = `Receta Ciclo A ${runId}`;
    const recipeBName = `Receta Ciclo B ${runId}`;

    // Receta A: usa un ingrediente simple.
    cy.get('[data-testid="nav-recetas"]').click();
    cy.get('[data-testid="recipe-new-button"]').click();
    cy.get('[data-testid="recipe-form-name"]').type(recipeAName);
    cy.get('[data-testid="recipe-form-yield"]').clear().type("10");
    cy.get('[data-testid="recipe-form-add-ingredient"]').click();
    cy.get('[data-testid="ingredient-picker-search"]').type("Sal");
    cy.contains('[data-testid="ingredient-picker-option"]', "Sal").click();
    cy.get('[data-testid="recipe-form-line-quantity"]').type("100");
    // "Sal" tiene baseUnit "g", igual a la unidad por defecto de una línea
    // nueva ("g"), así que no hace falta tocar el selector de unidad (RI-008
    // exige que la unidad sea convertible a la unidad base del ingrediente).
    cy.get('[data-testid="recipe-form-submit"]').click();
    cy.get('[data-testid="recipe-create-dialog"]').should("not.exist");

    // Receta B: usa la Receta A como sub-receta.
    cy.get('[data-testid="recipe-new-button"]').click();
    cy.get('[data-testid="recipe-form-name"]').type(recipeBName);
    cy.get('[data-testid="recipe-form-yield"]').clear().type("10");
    cy.get('[data-testid="recipe-form-add-subrecipe"]').click();
    cy.get('[data-testid="recipe-form-subrecipe-select"]').click();
    // El listado de sub-recetas del <Select> de Radix es una lista larga con
    // scroll interno: hay que desplazar la opción a la vista antes de poder
    // clicarla de forma confiable en Cypress/Electron headless.
    cy.contains('[role="option"]', `${recipeAName} (receta)`).scrollIntoView().click({ force: true });
    cy.get('[data-testid="recipe-form-line-quantity"]').type("1");
    cy.get('[data-testid="recipe-form-submit"]').click();
    cy.get('[data-testid="recipe-create-dialog"]').should("not.exist");

    // Ahora se edita la Receta A para agregarle la Receta B como sub-receta:
    // A ya es usada dentro de B, así que esto crearía un ciclo A -> B -> A,
    // y el backend debe rechazarlo (ver recipeService.resolveAndValidateIngredientLines).
    cy.get('[data-testid="recipe-search-input"]').clear().type(recipeAName);
    cy.contains('[data-testid="recipe-row-name"]', recipeAName)
      .parents('[data-testid="recipe-row"]')
      .find('[data-testid="recipe-view-button"]')
      .click();
    cy.get('[data-testid="recipe-edit-button"]').click();
    cy.get('[data-testid="recipe-edit-dialog"]').should("be.visible");
    cy.get('[data-testid="recipe-form-add-subrecipe"]').click();
    cy.get('[data-testid="recipe-form-subrecipe-select"]').last().click();
    cy.contains('[role="option"]', `${recipeBName} (receta)`).scrollIntoView().click({ force: true });
    cy.get('[data-testid="recipe-form-line-quantity"]').last().type("1");
    cy.get('[data-testid="recipe-form-submit"]').click();

    cy.get('[data-testid="recipe-form-error"]').should(
      "contain.text",
      "Esta combinación crearía una referencia circular entre recetas",
    );
    cy.screenshot("recetas-10-error-ciclo-detectado");
  });
});

// E2E: integridad ESTRUCTURAL de las miniaturas de recetas en el listado
// (EntityImage.tsx). Contexto: el seed creció de 7 a 22 recetas con fotos
// recién descargadas, y un bug real anterior (una foto con content-type
// correcto pero que era una imagen completamente distinta a la receta) solo
// lo detectó una persona mirando la pantalla renderizada — Cypress no puede
// "ver" si el contenido de la foto es el correcto.
//
// Lo que ESTA spec sí puede verificar honestamente: que cada receta con
// `imageUrl` realmente carga un bitmap válido (naturalWidth/naturalHeight >
// 0), es decir que no hay URLs rotas/404 ni content-type inválido. Esto NO
// prueba que la foto sea la correcta para esa receta — esa verificación de
// contenido requiere revisión humana o un modelo con visión, no Cypress.
describe("Recetas — integridad estructural de imágenes", () => {
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it("Todas las miniaturas de recetas con foto cargan un bitmap real (naturalWidth/naturalHeight > 0)", () => {
    // Primero se obtiene por API la lista completa real de recetas y cuántas
    // de ellas declaran `imageUrl`, para no depender de un número
    // hardcodeado (hoy 22, pero el seed puede seguir creciendo).
    cy.apiLoginAsAdmin().then((token) => {
      cy.request({
        method: "GET",
        url: `${Cypress.env("apiUrl")}/recipes`,
        qs: { pageSize: 100 },
        headers: { Authorization: `Bearer ${token}` },
      }).then((resp) => {
        const recipes = resp.body.data as Array<{ name: string; imageUrl: string | null }>;
        expect(recipes.length).to.be.greaterThan(0);
        const withImage = recipes.filter((r) => Boolean(r.imageUrl));
        expect(withImage.length, "recetas sembradas con imageUrl").to.be.greaterThan(0);

        cy.get('[data-testid="nav-recetas"]').click();
        cy.get('[data-testid="recipe-row"]').should("have.length", recipes.length);
        cy.screenshot("recetas-11-listado-completo-imagenes");

        withImage.forEach((recipe) => {
          cy.contains('[data-testid="recipe-row"]', recipe.name)
            .find('[data-testid="entity-image"]')
            .should(($img) => {
              const img = $img[0] as HTMLImageElement;
              expect(img.complete, `imagen de "${recipe.name}" terminó de cargar`).to.eq(true);
              expect(img.naturalWidth, `naturalWidth de "${recipe.name}"`).to.be.greaterThan(0);
              expect(img.naturalHeight, `naturalHeight de "${recipe.name}"`).to.be.greaterThan(0);
            });
          // Si la carga hubiera fallado, EntityImage reemplaza el <img> por
          // un placeholder con este testid — confirmamos también que NO
          // ocurrió ese fallback para ninguna receta con imageUrl.
          cy.contains('[data-testid="recipe-row"]', recipe.name).within(() => {
            cy.get('[data-testid="entity-image-placeholder"]').should("not.exist");
          });
        });
        cy.screenshot("recetas-12-imagenes-integridad-verificada");
      });
    });
  });
});
