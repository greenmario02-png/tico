import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { db, pool } from "../../db/client";
import { users } from "../../db/schema/index";
import { hashPassword } from "../../lib/auth";
import { ApiError } from "../../lib/errors";
import { authRoutes } from "../../routes/auth";
import { createLoginThrottle } from "../../services/loginThrottle";

describe("POST /api/auth/login — rate limiting progresivo", () => {
  let app: FastifyInstance;
  let t = 5_000_000;
  const email = `rl_${Date.now()}@test.local`;
  const login = (e: string, password: string) =>
    app.inject({ method: "POST", url: "/api/auth/login", payload: { email: e, password } });

  beforeAll(async () => {
    await db.insert(users).values({
      name: "RL TEST",
      email,
      passwordHash: await hashPassword("clave_correcta_1"),
      role: "admin",
    });
    app = Fastify();
    app.setErrorHandler((error, _req, reply) => {
      if (error instanceof ApiError) {
        if (error.retryAfterSeconds !== undefined) reply.header("Retry-After", String(error.retryAfterSeconds));
        reply.code(error.statusCode).send(error.toBody());
        return;
      }
      reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: String(error) } });
    });
    await app.register(authRoutes, {
      throttle: createLoginThrottle({ now: () => t, ipLimitPerMinute: 20 }),
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("fallos con backoff 5/10, 429 con Retry-After incluso con clave correcta, reset tras éxito", async () => {
    let r = await login(email, "mala");
    expect(r.statusCode).toBe(401);
    r = await login(email, "clave_correcta_1");
    expect(r.statusCode).toBe(429);
    expect(r.headers["retry-after"]).toBe("5");
    expect(r.json().error).toMatchObject({ code: "LOGIN_RATE_LIMITED", retryAfterSeconds: 5 });
    expect(r.json().error.message).toBe("Demasiados intentos. Espera 5 segundos e inténtalo de nuevo.");

    t += 5000;
    r = await login(email, "mala");
    expect(r.statusCode).toBe(401);
    r = await login(email, "mala");
    expect(r.statusCode).toBe(429);
    expect(r.headers["retry-after"]).toBe("10");

    t += 10_000;
    r = await login(email, "clave_correcta_1");
    expect(r.statusCode).toBe(200);
    // reset: un nuevo fallo vuelve a 5 s
    await login(email, "mala");
    r = await login(email, "mala");
    expect(r.headers["retry-after"]).toBe("5");
  });

  it("no enumera usuarios: email inexistente y contraseña errónea dan el mismo 401", async () => {
    t += 3600_000;
    const a = await login(`noexiste_${Date.now()}@test.local`, "x");
    const b = await login(email, "x");
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.json()).toEqual(b.json());
  });

  it("tope por IP: 20 intentos/minuto => 429", async () => {
    t += 3600_000;
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await login(`ip${i}_${Date.now()}@test.local`, "x")).statusCode;
    expect(last).toBe(429);
  });
});
