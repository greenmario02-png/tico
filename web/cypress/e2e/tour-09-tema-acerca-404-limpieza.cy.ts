import { VIEWPORT, quickLogin, pause, goTo, slowType, api } from "../support/tour";

describe("Tour 09 - Tema, Acerca de, 404 y limpieza", VIEWPORT, () => {
  function softDelete(searchInput: string, nameTid: string, rowTid: string, viewTid: string, delTid: string, confirmTid: string, name: string) {
    slowType(searchInput, name);
    cy.contains(`[data-testid="${nameTid}"]`, name)
      .parents(`[data-testid="${rowTid}"]`)
      .find(`[data-testid="${viewTid}"]`)
      .click();
    pause(1500);
    cy.get(`[data-testid="${delTid}"]`).click();
    pause(1500);
    cy.get(`[data-testid="${confirmTid}"]`).click();
    pause(2000);
  }

  it("tema, acerca de, 404 y desactivar datos Demo Tour", () => {
    quickLogin();
    cy.get('[data-testid="theme-toggle"]').click();
    pause(3000);
    goTo("nav-recetas");
    pause(1500);
    cy.get('[data-testid="theme-toggle"]').click();
    pause(2500);

    cy.get('[data-testid="nav-about"]').click();
    cy.get('[data-testid="about-page"]').should("be.visible");
    pause(2500);
    cy.scrollTo("bottom", { duration: 1800, ensureScrollable: false });
    pause(1500);
    cy.scrollTo("top", { duration: 1500, ensureScrollable: false });
    pause(1000);

    cy.window().then((w) => {
      w.history.pushState({}, "", "/ruta-que-no-existe");
      w.dispatchEvent(new PopStateEvent("popstate"));
    });
    cy.get('[data-testid="not-found-page"]').should("be.visible");
    pause(3000);
    cy.get('[data-testid="not-found-home"]').click();
    pause(2000);

    // Producto de venta demo (scoped por nombre).
    api("GET", "/products").then((r) => {
      const list = (r.body.data ?? r.body.items ?? r.body) as { id: string; name: string }[];
      list.filter((p) => p.name.startsWith("Demo Tour")).forEach((p) => api("DELETE", `/products/${p.id}`));
    });

    // Limpieza por UI (borrado logico): recetas (final primero), luego ingrediente.
    goTo("nav-recetas");
    softDelete('[data-testid="recipe-search-input"]', "recipe-row-name", "recipe-row", "recipe-view-button", "recipe-delete-button", "recipe-delete-confirm", "Demo Tour Pan Especial");
    softDelete('[data-testid="recipe-search-input"]', "recipe-row-name", "recipe-row", "recipe-view-button", "recipe-delete-button", "recipe-delete-confirm", "Demo Tour Masa Base");
    goTo("nav-ingredientes");
    softDelete('[data-testid="ingredient-search-input"]', "ingredient-row-name", "ingredient-row", "ingredient-view-button", "ingredient-delete-button", "ingredient-delete-confirm", "Demo Tour Harina");
    pause(1500);
  });
});
