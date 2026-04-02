export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const STATES = ["borrador", "enviada", "aceptada", "rechazada", "facturada"] as const;

function parseImporte(s: string | null): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Lunes de la semana de una fecha dada */
function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=dom, 1=lun...
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() + diff);
  return monday;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  // Filtro por vendedor si corresponde
  const vendedorFilter =
    auth.user.role === "VENDEDOR" && auth.user.contabiliumId
      ? { idVendedor: auth.user.contabiliumId }
      : auth.user.role === "VENDEDOR"
      ? { assignedToId: auth.user.id }
      : {};

  // Filtro de fecha (opcional) para los widgets de estado
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const dateFilter = (from || to)
    ? {
        fechaEmision: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to + "T23:59:59.999Z") } : {}),
        },
      }
    : {};

  // Widgets por estado
  const quotations = await prisma.quotation.findMany({
    where: { ...vendedorFilter, ...dateFilter },
    select: { state: true, importeTotalNeto: true },
  });

  const byState = STATES.map((state) => {
    const items = quotations.filter((q) => q.state === state);
    const total = items.reduce((sum, q) => sum + parseImporte(q.importeTotalNeto), 0);
    return { state, count: items.length, totalNeto: formatARS(total) };
  });

  // Calendario semanal: cotizaciones con nextFollowUpAt en la semana laboral actual (lun-vie)
  const monday = startOfWeek(new Date());
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 11); // 2 semanas (lun a vie x2)
  friday.setHours(23, 59, 59, 999);

  const weekFollowUps = await prisma.quotation.findMany({
    where: {
      ...vendedorFilter,
      nextFollowUpAt: { gte: monday, lte: friday },
    },
    select: {
      id: true,
      externalId: true,
      nextFollowUpAt: true,
      state: true,
      importeTotalNeto: true,
      client: { select: { name: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { nextFollowUpAt: "asc" },
  });

  return Response.json({ byState, weekFollowUps });
}
