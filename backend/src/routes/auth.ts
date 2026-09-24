import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client";
import { authenticate } from "../lib/auth";
import { ApiError } from "../lib/errors";
import { EMAIL_REGEX } from "../lib/email";
import { getMe, login } from "../services/authService";

const loginSchema = z.object({
  // No se usa z.string().email(): su regex por defecto es ASCII-only y
  // rechaza local-parts con "ñ"/tildes (p. ej. "dueño@panaderia.bo", un
  // correo real y válido). EMAIL_REGEX acepta Unicode mientras sigue
  // exigiendo la forma básica `algo@algo.algo`.
  email: z.string().regex(EMAIL_REGEX),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (request) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw ApiError.validation("Revisa los datos ingresados.", [
        { field: "email", message: "Correo o contraseña inválidos" },
      ]);
    }
    const result = await login(db, parsed.data.email, parsed.data.password);
    return result;
  });

  app.post("/api/auth/logout", { preHandler: [authenticate] }, async () => {
    return { message: "Sesión cerrada" };
  });

  app.get("/api/auth/me", { preHandler: [authenticate] }, async (request) => {
    return getMe(db, request.user!.id);
  });
}
