import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

/**
 * Panel de control: cotizaciones abiertas, ganadas, perdidas, posibilidad de cierre; agrupado por vendedor.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { user } = auth;

  if (user.role === "VENDEDOR") {
    const [abiertas, ganadas, perdidas] = await Promise.all([
      prisma.quotation.count({ where: { assignedToId: user.id, state: { in: ["abierta", "activa"] } } }),
      prisma.quotation.count({ where: { assignedToId: user.id, state: "ganada" } }),
      prisma.quotation.count({ where: { assignedToId: user.id, state: "perdida" } }),
    ]);
    const porCierre = await prisma.quotation.findMany({
      where: { assignedToId: user.id, state: { in: ["abierta", "activa"] } },
      select: { id: true, externalId: true, successPercent: true, nextFollowUpAt: true, client: { select: { name: true } } },
      orderBy: { successPercent: "desc" },
      take: 10,
    });
    return Response.json({
      byVendor: [
        {
          vendorId: user.id,
          vendorName: user.name,
          abiertas,
          ganadas,
          perdidas,
          porCierre,
        },
      ],
    });
  }

  const vendors = await prisma.user.findMany({
    where: { role: "VENDEDOR" },
    select: { id: true, name: true },
  });

  const byVendor = await Promise.all(
    vendors.map(async (v) => {
      const [abiertas, ganadas, perdidas] = await Promise.all([
        prisma.quotation.count({ where: { assignedToId: v.id, state: { in: ["abierta", "activa"] } } }),
        prisma.quotation.count({ where: { assignedToId: v.id, state: "ganada" } }),
        prisma.quotation.count({ where: { assignedToId: v.id, state: "perdida" } }),
      ]);
      const porCierre = await prisma.quotation.findMany({
        where: { assignedToId: v.id, state: { in: ["abierta", "activa"] } },
        select: { id: true, externalId: true, successPercent: true, nextFollowUpAt: true, client: { select: { name: true } } },
        orderBy: { successPercent: "desc" },
        take: 5,
      });
      return {
        vendorId: v.id,
        vendorName: v.name,
        abiertas,
        ganadas,
        perdidas,
        porCierre,
      };
    })
  );

  return Response.json({ byVendor });
}
