import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
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

export function getTokenFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookie = req.cookies.get("auth")?.value;
  if (cookie) return cookie;
  return null;
}

/**
 * Verifica JWT y devuelve el usuario; si roleRequired está definido, exige ese rol.
 */
export async function requireAuth(
  req: NextRequest,
  roleRequired?: Role
): Promise<{ user: { id: string; email: string; name: string; role: string; contabiliumId: string | null } } | { error: string; status: number }> {
  const token = getTokenFromRequest(req);
  if (!token) return { error: "No autorizado", status: 401 };
  const payload = verifyToken(token);
  if (!payload) return { error: "Token inválido o expirado", status: 401 };
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true, contabiliumId: true },
  });
  if (!user) return { error: "Usuario no encontrado", status: 401 };
  if (roleRequired && user.role !== roleRequired) return { error: "Sin permisos", status: 403 };
  return { user };
}

/**
 * Para vendedor: solo puede ver recursos asignados a él.
 */
export function canSeeQuotation(
  quotationAssignedToId: string | null,
  user: { id: string; role: string; contabiliumId?: string | null },
  quotationIdVendedor?: string | null
): boolean {
  if (user.role === "ADMIN") return true;
  if (quotationAssignedToId === user.id) return true;
  if (user.contabiliumId && quotationIdVendedor === user.contabiliumId) return true;
  return false;
}
