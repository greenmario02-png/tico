import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { authenticate } from "../lib/auth";
import { ApiError } from "../lib/errors";
import { EMAIL_REGEX } from "../lib/email";
import { config } from "../lib/config";
import { getMe, login } from "../services/authService";
import { createLoginThrottle, type LoginThrottle } from "../services/loginThrottle";

const loginSchema = z.object({
  // No se usa z.string().email(): su regex por defecto es ASCII-only y
  // rechaza local-parts con "ñ"/tildes (p. ej. "dueño@panaderia.bo", un
  // correo real y válido). EMAIL_REGEX acepta Unicode mientras sigue
  // exigiendo la forma básica `algo@algo.algo`.
  email: z.string().regex(EMAIL_REGEX),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance, opts: { throttle?: LoginThrottle } = {}) {
  const throttle =
    opts.throttle ??
    createLoginThrottle({
      baseSeconds: config.loginThrottleBaseSeconds,
      maxSeconds: config.loginThrottleMaxSeconds,
      ipLimitPerMinute: config.loginIpLimitPerMinute,
    });
  throttle.startCleanup();
  app.addHook("onClose", async () => throttle.stopCleanup());

  app.post("/api/auth/login", async (request) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw ApiError.validation("Revisa los datos ingresados.", [
        { field: "email", message: "Correo o contraseña inválidos" },
      ]);
    }
    const { email, password } = parsed.data;
    const wait = throttle.check(request.ip, email);
    if (wait > 0) throw ApiError.loginRateLimited(wait);
    try {
      const result = await login(db, email, password);
      throttle.recordSuccess(request.ip, email);
      return result;
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) throttle.recordFailure(request.ip, email);
      throw err;
    }
  });

  app.post("/api/auth/logout", { preHandler: [authenticate] }, async () => {
    return { message: "Sesión cerrada" };
  });

  app.get("/api/auth/me", { preHandler: [authenticate] }, async (request) => {
    return getMe(db, request.user!.id);
  });
}
