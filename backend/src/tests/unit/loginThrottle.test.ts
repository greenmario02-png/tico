import { describe, expect, it } from "vitest";
import { createLoginThrottle } from "../../services/loginThrottle";

function setup(o: Parameters<typeof createLoginThrottle>[0] = {}) {
  let t = 1_000_000;
  const th = createLoginThrottle({ ...o, now: () => t });
  return { th, adv: (s: number) => (t += s * 1000) };
}

describe("loginThrottle", () => {
  it("backoff 5/10/20/40 tras fallos consecutivos y tope 900", () => {
    const { th, adv } = setup();
    const waits: number[] = [];
    for (let i = 0; i < 12; i++) {
      expect(th.check("1.1.1.1", "a@b.co")).toBe(0);
      th.recordFailure("1.1.1.1", "a@b.co");
      const w = th.check("1.1.1.1", "a@b.co");
      waits.push(w);
      adv(w);
    }
    expect(waits.slice(0, 4)).toEqual([5, 10, 20, 40]);
    expect(waits.slice(4, 9)).toEqual([80, 160, 320, 640, 900]);
    expect(waits[11]).toBe(900);
  });

  it("bloquea incluso con contraseña correcta (cualquier intento) y normaliza email", () => {
    const { th, adv } = setup();
    th.recordFailure("1.1.1.1", "Ana@Mail.com ");
    expect(th.check("1.1.1.1", " ana@mail.com")).toBe(5);
    adv(2);
    expect(th.check("1.1.1.1", "ana@mail.com")).toBe(3);
    adv(3);
    expect(th.check("1.1.1.1", "ana@mail.com")).toBe(0);
    // otra IP / otro email no afectados
    th.recordFailure("1.1.1.1", "ana@mail.com");
    expect(th.check("2.2.2.2", "ana@mail.com")).toBe(0);
    expect(th.check("1.1.1.1", "otro@mail.com")).toBe(0);
  });

  it("login correcto resetea el contador", () => {
    const { th, adv } = setup();
    th.recordFailure("ip", "a@b.co");
    adv(5);
    th.recordFailure("ip", "a@b.co"); // n=2 => 10s
    adv(10);
    th.recordSuccess("ip", "a@b.co");
    th.recordFailure("ip", "a@b.co");
    expect(th.check("ip", "a@b.co")).toBe(5);
  });

  it("olvida el contador tras 30 min sin fallos", () => {
    const { th, adv } = setup();
    for (let i = 0; i < 4; i++) {
      th.recordFailure("ip", "a@b.co");
      adv(900);
    }
    adv(30 * 60);
    expect(th.check("ip", "a@b.co")).toBe(0);
    th.recordFailure("ip", "a@b.co");
    expect(th.check("ip", "a@b.co")).toBe(5);
  });

  it("tope por IP: 20 intentos/minuto, ventana deslizante", () => {
    const { th, adv } = setup();
    for (let i = 0; i < 20; i++) expect(th.check("ip", `u${i}@x.co`)).toBe(0);
    const w = th.check("ip", "nuevo@x.co");
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(60);
    expect(th.check("otra", "nuevo@x.co")).toBe(0);
    adv(61);
    expect(th.check("ip", "nuevo@x.co")).toBe(0);
  });

  it("limita el tamaño del mapa y limpia entradas viejas", () => {
    const { th, adv } = setup({ maxEntries: 5 });
    for (let i = 0; i < 20; i++) th.recordFailure("ip", `u${i}@x.co`);
    expect(th.size()).toBeLessThanOrEqual(5);
    adv(31 * 60);
    th.cleanup();
    expect(th.size()).toBe(0);
  });
});
