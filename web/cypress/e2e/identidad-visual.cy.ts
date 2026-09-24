/// <reference types="cypress" />
// Identidad visual: mascota del login, 404, estados vacíos, dashboard.
// Además de verificar, guarda capturas en cypress/screenshots (se copian a
// qa-evidence/web/identidad-visual/).

function setTheme(theme: "light" | "dark") {
  cy.window().then((w) => {
    w.localStorage.setItem("panaderia-theme", theme);
    w.document.documentElement.setAttribute("data-theme", theme);
  });
}

describe("Identidad visual", () => {
  before(() => {
    cy.viewport(1280, 800);
  });

  ["dark", "light"].forEach((theme) => {
    it(`login: mascota en idle / coverEyes / peek (${theme})`, () => {
      cy.viewport(1280, 800);
      cy.visit("/login");
      setTheme(theme as "light" | "dark");
      cy.get('[data-testid="baker-mascot"]').should("have.attr", "data-state", "idle");
      cy.wait(500);
      cy.screenshot(`01-login-idle-${theme}`, { capture: "viewport" });
      cy.get('[data-testid="login-password"]').focus();
      cy.get('[data-testid="baker-mascot"]').should("have.attr", "data-state", "coverEyes");
      cy.wait(600);
      cy.screenshot(`02-login-coverEyes-${theme}`, { capture: "viewport" });
      cy.get('[data-testid="login-password"]').type("secreto");
      cy.get('[data-testid="login-toggle-password"]').click();
      cy.get('[data-testid="login-password"]').should("have.attr", "type", "text");
      cy.get('[data-testid="baker-mascot"]').should("have.attr", "data-state", "peek");
      cy.wait(600);
      cy.screenshot(`03-login-peek-${theme}`, { capture: "viewport" });
      cy.contains("Storyset").should("not.exist");
    });
  });

  it("login móvil apila mascota y tarjeta", () => {
    cy.viewport(390, 844);
    cy.visit("/login");
    cy.wait(400);
    cy.screenshot("04-login-movil", { capture: "viewport" });
  });

  it("usuario no autenticado en URL desconocida va a login", () => {
    cy.visit("/no-existe-xyz");
    cy.location("pathname").should("eq", "/login");
  });

  it("404 visible y volver al inicio", () => {
    cy.viewport(1280, 800);
    cy.loginAsAdmin();
    cy.window().then((w) => {
      w.history.pushState({}, "", "/ruta/inexistente");
      w.dispatchEvent(new PopStateEvent("popstate"));
    });
    cy.get('[data-testid="not-found-page"]').should("be.visible");
    cy.get('[data-testid="app-sidebar"]').should("be.visible");
    cy.wait(600);
    cy.screenshot("05-404-dark", { capture: "viewport" });
    setTheme("light");
    cy.screenshot("06-404-light", { capture: "viewport" });
    cy.get('[data-testid="not-found-home"]').click();
    cy.get('[data-testid="dashboard-page"]').should("be.visible");
    cy.wait(700);
    cy.screenshot("09-dashboard-light", { capture: "viewport" });
    setTheme("dark");
    cy.screenshot("10-dashboard-dark", { capture: "viewport" });
  });

  it("estados vacíos: recetas sin resultados e inventario", () => {
    cy.viewport(1280, 800);
    cy.loginAsAdmin();
    cy.get('[data-testid="nav-recetas"]').click();
    cy.get('[data-testid="recipe-search-input"]').type("zzzz-no-existe-qqq");
    cy.get('[data-testid="recipes-empty"]').should("be.visible");
    cy.wait(600);
    cy.screenshot("07-empty-recetas-dark", { capture: "viewport" });
    setTheme("light");
    cy.screenshot("08-empty-recetas-light", { capture: "viewport" });
  });

  it("Acerca de: desarrollador y créditos (no hay crédito en login)", () => {
    cy.viewport(1280, 800);
    cy.loginAsAdmin();
    cy.get('[data-testid="nav-about"]').click();
    cy.location("pathname").should("eq", "/acerca-de");
    cy.get('[data-testid="about-page"]').should("be.visible");
    cy.get('[data-testid="about-developer"]').should("contain.text", "Alvaro Diaz Vallejos — Karma.py");
    cy.get('[data-testid="about-credit-storyset"]')
      .should("have.attr", "href", "https://storyset.com")
      .and("have.attr", "target", "_blank");
    cy.wait(600);
    setTheme("dark");
    cy.wait(300);
    cy.screenshot("14-acerca-de-dark", { capture: "viewport" });
    setTheme("light");
    cy.wait(300);
    cy.screenshot("15-acerca-de-light", { capture: "viewport" });
  });
});
