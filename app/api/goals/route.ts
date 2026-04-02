export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

function parseImporte(s: string | null): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * GET /api/goals
 * Devuelve el progreso del mes actual por vendedor.
 * Admin: todos los vendedores con objetivo configurado.
 * Vendedor: solo el propio.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  if (auth.user.role === "ADMIN") {
    // Admin: todos los vendedores (con o sin objetivo configurado)
    const [allVendors, goals] = await Promise.all([
      prisma.user.findMany({
        where: { role: "VENDEDOR", active: true },
        select: { id: true, name: true, contabiliumId: true },
        orderBy: { name: "asc" },
      }),
      prisma.salesGoal.findMany({
        where: { year },
        select: { userId: true, monthlyTarget: true },
      }),
    ]);

    const goalMap = new Map(goals.map((g) => [g.userId, g.monthlyTarget]));

    const progress = await Promise.all(
      allVendors.map(async (vendor) => {
        const contabiliumId = vendor.contabiliumId;
        const monthlyTarget = goalMap.get(vendor.id) ?? null;

        const quotations = await prisma.quotation.findMany({
          where: {
            state: "aceptada",
            ...(contabiliumId
              ? { OR: [{ assignedToId: vendor.id }, { idVendedor: contabiliumId }] }
              : { assignedToId: vendor.id }),
          },
          select: { importeTotalNeto: true },
        });

        const current = quotations.reduce((sum, q) => sum + parseImporte(q.importeTotalNeto), 0);
        const pct = monthlyTarget && monthlyTarget > 0 ? (current / monthlyTarget) * 100 : null;

        return {
          userId: vendor.id,
          name: vendor.name,
          monthlyTarget,
          current,
          currentFormatted: formatARS(current),
          targetFormatted: monthlyTarget ? formatARS(monthlyTarget) : null,
          percent: pct !== null ? Math.round(pct) : null,
          onTrack: pct !== null ? pct >= 100 : null,
        };
      })
    );

    return Response.json({ progress, year, month: month + 1 });
  }

  // Vendedor: solo el propio
  const goal = await prisma.salesGoal.findUnique({
    where: { userId_year: { userId: auth.user.id, year } },
  });

  const contabiliumId = auth.user.contabiliumId;
  const quotations = await prisma.quotation.findMany({
    where: {
      state: "aceptada",
      ...(contabiliumId
        ? { OR: [{ assignedToId: auth.user.id }, { idVendedor: contabiliumId }] }
        : { assignedToId: auth.user.id }),
    },
    select: { importeTotalNeto: true },
  });

  const current = quotations.reduce((sum, q) => sum + parseImporte(q.importeTotalNeto), 0);
  const monthlyTarget = goal?.monthlyTarget ?? null;
  const pct = monthlyTarget && monthlyTarget > 0 ? (current / monthlyTarget) * 100 : null;

  const progress = goal ? [{
    userId: auth.user.id,
    name: auth.user.name ?? "",
    monthlyTarget,
    current,
    currentFormatted: formatARS(current),
    targetFormatted: monthlyTarget ? formatARS(monthlyTarget) : null,
    percent: pct !== null ? Math.round(pct) : null,
    onTrack: pct !== null ? pct >= 100 : null,
  }] : [];

  return Response.json({ progress, year, month: month + 1 });
}

/**
 * PUT /api/goals
 * Crea o actualiza el objetivo mensual de un vendedor para el año dado.
 * Solo admin.
 * Body: { userId, year, monthlyTarget }
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  if (auth.user.role !== "ADMIN") {
    return Response.json({ error: "Solo administradores pueden configurar objetivos" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, year, monthlyTarget } = body as { userId: string; year: number; monthlyTarget: number };

  if (!userId || !year || monthlyTarget == null || isNaN(monthlyTarget)) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const goal = await prisma.salesGoal.upsert({
    where: { userId_year: { userId, year } },
    update: { monthlyTarget },
    create: { userId, year, monthlyTarget },
  });

  return Response.json({ goal });
}
