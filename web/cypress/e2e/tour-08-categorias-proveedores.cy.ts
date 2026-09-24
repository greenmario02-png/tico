import { VIEWPORT, quickLogin, pause, goTo, slowType, scrollTour } from "../support/tour";

describe("Tour 08 - Categorias y Proveedores", VIEWPORT, () => {
  const CAT = "Demo Tour Categoria";
  const CAT2 = "Demo Tour Categoria Editada";
  const SUP = "Demo Tour Proveedor";
  const SUP2 = "Demo Tour Proveedor Editado";

  it("categorias y proveedores: crear, editar, eliminar", () => {
    quickLogin();
    goTo("nav-categorias");
    cy.get('[data-testid="categories-page"]').should("be.visible");
    scrollTour();
    cy.get('[data-testid="category-new-button"]').click();
    pause(1500);
    slowType('[data-testid="category-form-name"]', CAT);
    cy.get('[data-testid="category-form-submit"]').click();
    cy.get('[data-testid="category-create-dialog"]').should("not.exist");
    pause(2500);
    cy.contains('[data-testid="category-row"]', CAT).find('[data-testid="category-edit-button"]').click();
    pause(1500);
    slowType('[data-testid="category-form-name"]', CAT2);
    cy.get('[data-testid="category-form-submit"]').click();
    cy.get('[data-testid="category-edit-dialog"]').should("not.exist");
    pause(2500);
    cy.contains('[data-testid="category-row"]', CAT2).find('[data-testid="category-delete-button"]').click();
    pause(2500);
    cy.get('[data-testid="category-delete-confirm"]').click();
    cy.get('[data-testid="category-delete-dialog"]').should("not.exist");
    pause(2500);

    goTo("nav-proveedores");
    cy.get('[data-testid="suppliers-page"]').should("be.visible");
    scrollTour();
    cy.get('[data-testid="supplier-new-button"]').click();
    pause(1500);
    slowType('[data-testid="supplier-form-name"]', SUP);
    slowType('[data-testid="supplier-form-contact"]', "Juan Perez");
    slowType('[data-testid="supplier-form-phone"]', "70012345");
    cy.get('[data-testid="supplier-form-submit"]').click();
    cy.get('[data-testid="supplier-create-dialog"]').should("not.exist");
    pause(2500);
    cy.contains('[data-testid="supplier-row"]', SUP).find('[data-testid="supplier-edit-button"]').click();
    pause(1500);
    slowType('[data-testid="supplier-form-name"]', SUP2);
    cy.get('[data-testid="supplier-form-submit"]').click();
    cy.get('[data-testid="supplier-edit-dialog"]').should("not.exist");
    pause(2500);
    cy.contains('[data-testid="supplier-row"]', SUP2).find('[data-testid="supplier-delete-button"]').click();
    pause(2500);
    cy.get('[data-testid="supplier-delete-confirm"]').click();
    cy.get('[data-testid="supplier-delete-dialog"]').should("not.exist");
    pause(2500);
  });
});
