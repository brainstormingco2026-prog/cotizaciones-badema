import jwt from "jsonwebtoken";
import { prisma } from "./db";

const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production";

export type Role = "ADMIN" | "VENDEDOR";

export type JwtPayload = {
  userId: string;
  email: string;
  role: Role;
  iat?: number;
  exp?: number;
};

export function signToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(
    { userId: payload.userId, email: payload.email, role: payload.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: {
  headers?: Headers | { get?(name: string): string | null; authorization?: string };
  cookies?: { get?(name: string): string | undefined } | Record<string, string>;
}): string | null {
  const headers = req.headers;
  if (headers) {
    const auth = typeof headers.get === "function" ? headers.get("authorization") : (headers as { authorization?: string }).authorization;
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
  }
  const cookies = req.cookies;
  if (cookies) {
    const cookie = typeof cookies.get === "function" ? cookies.get("auth") : (cookies as Record<string, string>).auth;
    if (cookie) return cookie;
  }
  return null;
}

/**
 * Verifica JWT y devuelve el usuario; si roleRequired está definido, exige ese rol.
 */
export async function requireAuth(
  req: { headers?: { authorization?: string }; cookies?: Record<string, string> },
  roleRequired?: Role
): Promise<{ user: { id: string; email: string; name: string; role: string } } | { error: string; status: number }> {
  const token = getTokenFromRequest(req);
  if (!token) return { error: "No autorizado", status: 401 };
  const payload = verifyToken(token);
  if (!payload) return { error: "Token inválido o expirado", status: 401 };
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) return { error: "Usuario no encontrado", status: 401 };
  if (roleRequired && user.role !== roleRequired) return { error: "Sin permisos", status: 403 };
  return { user };
}

/**
 * Para vendedor: solo puede ver recursos asignados a él.
 */
export function canSeeQuotation(quotationAssignedToId: string | null, user: { id: string; role: string }): boolean {
  if (user.role === "ADMIN") return true;
  return quotationAssignedToId === user.id;
}
