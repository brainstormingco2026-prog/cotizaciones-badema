import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAuth, canSeeQuotation } from "@/lib/auth";
import { computeNextFollowUp } from "@/lib/contabilium/sync-quotations";
import { enrichIdVendedorFromRawData } from "@/lib/quotations-enrich";

const followUpFreqEnum = ["DAYS_3", "DAYS_7", "DAYS_15", "DAYS_30"] as const;

const patchSchema = z.object({
  assignedToId: z.string().cuid().nullable().optional(),
  successPercent: z.number().min(0).max(100).optional(),
  followUpFreq: z.enum(followUpFreqEnum).nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(_req);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: { client: true, assignedTo: { select: { id: true, name: true, email: true } } },
  });
  if (!quotation) {
    return Response.json({ error: "Cotización no encontrada" }, { status: 404 });
  }
  if (!canSeeQuotation(quotation.assignedToId, auth.user)) {
    return Response.json({ error: "Sin permisos" }, { status: 403 });
  }
  return Response.json(enrichIdVendedorFromRawData(quotation));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await params;
  const quotation = await prisma.quotation.findUnique({ where: { id } });
  if (!quotation) {
    return Response.json({ error: "Cotización no encontrada" }, { status: 404 });
  }
  if (!canSeeQuotation(quotation.assignedToId, auth.user)) {
    return Response.json({ error: "Sin permisos" }, { status: 403 });
  }
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }
  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.followUpFreq !== undefined) {
    data.nextFollowUpAt = parsed.data.followUpFreq
      ? computeNextFollowUp(parsed.data.followUpFreq)
      : null;
  }
  if (auth.user.role === "VENDEDOR" && "assignedToId" in data) {
    delete data.assignedToId; // solo admin puede reasignar
  }
  const updated = await prisma.quotation.update({
    where: { id },
    data: data as Parameters<typeof prisma.quotation.update>[0]["data"],
    include: { client: true, assignedTo: { select: { id: true, name: true, email: true } } },
  });
  return Response.json(updated);
}
