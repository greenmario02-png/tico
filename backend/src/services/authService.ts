import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { users } from "../db/schema/index";
import { ApiError } from "../lib/errors";
import { signAccessToken, verifyPassword } from "../lib/auth";

export async function login(db: Database, email: string, password: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));

  // Mensaje deliberadamente genérico (SDD-05 §2.1 / SDD-11): no revela cuál
  // de los dos campos falló ni si el usuario existe.
  const genericError = () => ApiError.unauthorized("Correo o contraseña incorrectos");

  if (!user || !user.isActive) {
    throw genericError();
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw genericError();
  }

  const { token, expiresIn } = signAccessToken(user.id, user.role);
  return {
    accessToken: token,
    expiresIn,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

export async function getMe(db: Database, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    throw ApiError.unauthorized();
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}
