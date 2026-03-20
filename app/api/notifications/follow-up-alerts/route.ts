import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const vendedorFilter =
    auth.user.role === "VENDEDOR" && auth.user.contabiliumId
      ? { idVendedor: auth.user.contabiliumId }
      : auth.user.role === "VENDEDOR"
      ? { assignedToId: auth.user.id }
      : {};

  const due = await prisma.quotation.findMany({
    where: {
      ...vendedorFilter,
      state: { notIn: ["aceptada", "rechazada"] },
      nextFollowUpAt: { gte: today, lt: tomorrow },
    },
    select: {
      id: true,
      externalId: true,
      client: { select: { name: true } },
    },
  });

  return Response.json({ count: due.length, alerts: due });
}
