import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config";
import { ApiError } from "./errors";

// SDD-11 §3: bcrypt, cost factor 12.
const BCRYPT_COST_FACTOR = 12;

export type UserRole = "admin" | "operario" | "dueño";

export interface JwtPayload {
  sub: string;
  role: UserRole;
  iat: number;
  exp: number;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST_FACTOR);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(userId: string, role: UserRole): { token: string; expiresIn: number } {
  const token = jwt.sign({ sub: userId, role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
  const decoded = jwt.decode(token) as JwtPayload;
  const expiresIn = decoded.exp - decoded.iat;
  return { token, expiresIn };
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, "TOKEN_EXPIRED", "Tu sesión expiró. Vuelve a iniciar sesión para continuar.");
    }
    throw ApiError.unauthorized();
  }
}

declare module "fastify" {
  interface FastifyRequest {
    user?: { id: string; role: UserRole };
  }
}

export async function authenticate(request: FastifyRequest, _reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw ApiError.unauthorized();
  }
  const token = header.slice("Bearer ".length);
  const payload = verifyAccessToken(token);
  request.user = { id: payload.sub, role: payload.role };
}

export function requireRole(...roles: UserRole[]) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    if (!request.user) {
      throw ApiError.unauthorized();
    }
    if (!roles.includes(request.user.role)) {
      throw ApiError.forbidden();
    }
  };
}
