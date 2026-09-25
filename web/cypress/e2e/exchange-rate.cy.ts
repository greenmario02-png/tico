/// <reference types="cypress" />
const rate = {
  currency: "USD",
  parallel: { buy: "9.20", sell: "9.35", source: "Binance P2P (USDT/BOB)" },
  updatedAt: "2026-09-25T14:30:00.000Z",
  stale: false,
};
const url = "**/exchange-rate";

function setTheme(theme: string) {
  cy.window().then((w) => {
    w.localStorage.setItem("panaderia-theme", theme);
    w.document.documentElement.setAttribute("data-theme", theme);
  });
}

describe("Tarjeta de dólar", () => {
  beforeEach(() => cy.viewport(1280, 800));

  ["light", "dark"].forEach((theme) => {
    it(`login y dashboard (${theme})`, () => {
      cy.intercept("GET", url, { body: rate }).as("rate");
      cy.visit("/login");
      setTheme(theme);
      cy.wait("@rate");
      cy.get('[data-testid="exchange-rate-parallel"]').should("contain", "9.20").and("contain", "9.35");
      cy.get('[data-testid="exchange-rate-card"]').should("not.contain", "Oficial");
      cy.get('[data-testid="exchange-rate-updated"]').should("contain", "10:30");
      cy.get('[data-testid="exchange-rate-stale"]').should("not.exist");
      cy.wait(300);
      cy.screenshot(`dolar-login-${theme}`, { capture: "viewport" });
      cy.loginAsAdmin();
      setTheme(theme);
      cy.get('[data-testid="exchange-rate-card"]').should("contain", "Binance P2P (USDT/BOB)");
      cy.wait(300);
      cy.screenshot(`dolar-dashboard-${theme}`, { capture: "viewport" });
    });
  });

  it("stale y parallel null: no disponible", () => {
    cy.intercept("GET", url, { body: { ...rate, parallel: null, stale: true } });
    cy.visit("/login");
    cy.get('[data-testid="exchange-rate-stale"]').should("be.visible");
    cy.get('[data-testid="exchange-rate-parallel"]').should("not.exist");
    cy.get('[data-testid="exchange-rate-error"]').should("contain", "Cotización no disponible por ahora.");
    cy.screenshot("dolar-login-stale-sin-paralelo", { capture: "viewport" });
  });

  it("falla la petición sin romper el login", () => {
    cy.intercept("GET", url, { statusCode: 500, body: {} });
    cy.visit("/login");
    cy.get('[data-testid="exchange-rate-error"]').should("be.visible");
    cy.get('[data-testid="login-form"]').should("be.visible");
  });

  it("refresca en un intervalo aleatorio de 5 a 10 minutos", () => {
    cy.clock();
    let n = 0;
    cy.intercept("GET", url, (req) => {
      n += 1;
      req.reply({ body: rate });
    });
    cy.visit("/login");
    cy.get('[data-testid="exchange-rate-parallel"]').should("be.visible");
    let before = 0;
    cy.then(() => {
      before = n; // en dev StrictMode puede montar dos veces
      cy.tick(4 * 60 * 1000 + 50 * 1000); // < 5 min: no debe refrescar
    });
    cy.wait(300);
    cy.then(() => expect(n, "sin petición antes de 5 min").to.eq(before));
    cy.then(() => cy.tick(5 * 60 * 1000 + 15 * 1000)); // total > 10 min
    cy.wrap(null).should(() => expect(n).to.be.greaterThan(before));
  });

  it("aviso de servidor dormido tras 4 s", () => {
    cy.intercept("GET", url, { body: rate });
    cy.intercept("POST", "**/auth/login", {
      delay: 5000,
      statusCode: 401,
      body: { error: { code: "X", message: "Credenciales inválidas" } },
    });
    cy.visit("/login");
    cy.get('[data-testid="login-email"]').type("a@b.bo");
    cy.get('[data-testid="login-password"]').type("x");
    cy.get('[data-testid="login-submit"]').click().should("be.disabled");
    cy.get('[data-testid="login-waking"]', { timeout: 6000 }).should("contain", "Despertando el servidor");
    cy.screenshot("dolar-login-despertando", { capture: "viewport" });
    cy.get('[data-testid="login-error"]', { timeout: 6000 }).should("be.visible");
    cy.get('[data-testid="login-waking"]').should("not.exist");
  });
});
