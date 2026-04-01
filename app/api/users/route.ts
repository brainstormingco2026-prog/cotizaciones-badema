export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { createContabiliumClient, getContabiliumConfigFromEnv } from "@/lib/contabilium/client";
import { type ContabiliumVendor, getVendorDisplayName } from "@/lib/contabilium/sync-vendors";

/** GET /api/users — solo admin, devuelve vendedores + IDs de Contabilium sin usuario */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 403 });

  const [users, rawIds] = await Promise.all([
    prisma.user.findMany({
      where: { role: "VENDEDOR" },
      select: { id: true, name: true, email: true, contabiliumId: true, phone: true },
      orderBy: { name: "asc" },
    }),
    prisma.quotation.findMany({
      where: { idVendedor: { not: null } },
      select: { idVendedor: true },
      distinct: ["idVendedor"],
    }),
  ]);

  const usedIds = new Set(users.map((u) => u.contabiliumId).filter(Boolean));
  const unlinkedIdStrings = rawIds
    .map((q) => q.idVendedor!)
    .filter((id) => id !== "0" && !usedIds.has(id));

  // Intentar enriquecer IDs sin vínculo con nombres de Contabilium
  let unlinkedVendors: { id: string; name: string }[] = unlinkedIdStrings.map((id) => ({ id, name: id }));
  const config = getContabiliumConfigFromEnv();
  if (config && unlinkedIdStrings.length > 0) {
    try {
      const client = await createContabiliumClient(config);
      const path = process.env.CONTABILIUM_VENDEDORES_PATH ?? "/api/vendedores/getall";
      const all = await client.get<ContabiliumVendor[]>(path);
      if (Array.isArray(all)) {
        const byId = new Map(all.map((v) => [String(v.Id), v]));
        unlinkedVendors = unlinkedIdStrings.map((id) => {
          const v = byId.get(id);
          return { id, name: v ? getVendorDisplayName(v) : id };
        });
      }
    } catch {
      // Si falla, igual devolvemos los IDs sin nombre
    }
  }

  return Response.json({ users, unlinkedVendors });
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

/** PATCH /api/users — solo admin, actualiza teléfono (y nombre/contabiliumId) */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 403 });

  const { id, phone, name, contabiliumId } = await req.json() as {
    id: string; phone?: string; name?: string; contabiliumId?: string;
  };
  if (!id) return Response.json({ error: "id requerido" }, { status: 400 });

  const data: Record<string, string | null> = {};
  if (phone !== undefined) data.phone = phone?.trim() || null;
  if (name !== undefined) data.name = name.trim();
  if (contabiliumId !== undefined) data.contabiliumId = contabiliumId?.trim() || null;

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, contabiliumId: true, phone: true },
  });
  return Response.json({ user });
}
