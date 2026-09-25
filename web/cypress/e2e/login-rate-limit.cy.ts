/// <reference types="cypress" />
function setTheme(theme: string) {
  cy.window().then((w) => {
    w.localStorage.setItem("panaderia-theme", theme);
    w.document.documentElement.setAttribute("data-theme", theme);
  });
}

describe("Login 429 (LOGIN_RATE_LIMITED)", () => {
  beforeEach(() => cy.viewport(1280, 800));

  ["light", "dark"].forEach((theme) => {
    it(`cuenta regresiva y rehabilita el botón (${theme})`, () => {
      cy.intercept("GET", "**/exchange-rate", { statusCode: 500, body: {} });
      cy.intercept("POST", "**/auth/login", {
        statusCode: 429,
        headers: { "Retry-After": "4" },
        body: { error: { code: "LOGIN_RATE_LIMITED", message: "Demasiados intentos. Espera 4 segundos e inténtalo de nuevo.", retryAfterSeconds: 4 } },
      }).as("login");
      cy.visit("/login");
      setTheme(theme);
      cy.get('[data-testid="login-email"]').type("a@b.bo");
      cy.get('[data-testid="login-password"]').type("x");
      cy.get('[data-testid="login-submit"]').click();
      cy.wait("@login");
      cy.get('[data-testid="login-error"]').should("contain", "Demasiados intentos. Vuelve a intentar en");
      cy.get('[data-testid="login-submit"]').should("be.disabled");
      cy.wait(300);
      cy.screenshot(`rate-limit-${theme}`, { capture: "viewport" });
      cy.get('[data-testid="login-error"]', { timeout: 8000 }).should("not.exist");
      cy.get('[data-testid="login-submit"]').should("not.be.disabled");
    });
  });

  it("otros errores siguen igual (401)", () => {
    cy.intercept("POST", "**/auth/login", { statusCode: 401, body: { error: { code: "X", message: "Credenciales inválidas" } } });
    cy.visit("/login");
    cy.get('[data-testid="login-email"]').type("a@b.bo");
    cy.get('[data-testid="login-password"]').type("x");
    cy.get('[data-testid="login-submit"]').click();
    cy.get('[data-testid="login-error"]').should("contain", "Credenciales inválidas");
    cy.get('[data-testid="login-submit"]').should("not.be.disabled");
  });
});
