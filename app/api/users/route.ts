export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import bcrypt from "bcryptjs";

/** GET /api/users — solo admin, devuelve vendedores + IDs de Contabilium sin usuario */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 403 });

  const [users, rawIds] = await Promise.all([
    prisma.user.findMany({
      where: { role: "VENDEDOR" },
      select: { id: true, name: true, email: true, contabiliumId: true },
      orderBy: { name: "asc" },
    }),
    prisma.quotation.findMany({
      where: { idVendedor: { not: null } },
      select: { idVendedor: true },
      distinct: ["idVendedor"],
    }),
  ]);

  const usedIds = new Set(users.map((u) => u.contabiliumId).filter(Boolean));
  const unlinkedIds = rawIds
    .map((q) => q.idVendedor!)
    .filter((id) => id !== "0" && !usedIds.has(id));

  return Response.json({ users, unlinkedIds });
}

/** POST /api/users — solo admin, crea un vendedor */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 403 });

  const { name, email, password, contabiliumId } = await req.json() as {
    name: string; email: string; password: string; contabiliumId?: string;
  };

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return Response.json({ error: "Nombre, email y contraseña son obligatorios" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return Response.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name: name.trim(), email: email.trim(), password: hashed, role: "VENDEDOR", contabiliumId: contabiliumId?.trim() || null },
    select: { id: true, name: true, email: true, contabiliumId: true },
  });

  return Response.json({ user }, { status: 201 });
}
