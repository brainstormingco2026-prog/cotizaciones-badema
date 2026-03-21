export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAuth, canSeeQuotation } from "@/lib/auth";
import { enrichIdVendedorFromRawData } from "@/lib/quotations-enrich";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { user } = auth;
  const state = req.nextUrl.searchParams.get("state");
  const assignedToMe = req.nextUrl.searchParams.get("mine") === "true";

  const where: Prisma.QuotationWhereInput = {};
  if (user.role === "VENDEDOR") {
    if (user.contabiliumId) {
      where.idVendedor = user.contabiliumId;
    } else {
      where.assignedToId = user.id;
    }
  } else if (assignedToMe) {
    where.assignedToId = user.id;
  }
  if (state) where.state = state;

  const quotations = await prisma.quotation.findMany({
    where,
    include: {
      client: true,
      assignedTo: { select: { id: true, name: true, email: true } },
    },
    orderBy: { nextFollowUpAt: "asc" },
  });

  const filtered =
    user.role === "ADMIN" || (user.role === "VENDEDOR" && !!user.contabiliumId)
      ? quotations
      : quotations.filter((q) => canSeeQuotation(q.assignedToId, user));

  const enriched = filtered.map((q) => enrichIdVendedorFromRawData(q));
  return Response.json({ quotations: enriched });
}
