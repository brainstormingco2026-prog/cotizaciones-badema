/**
 * Cron: viernes 15:00 PM Argentina (18:00 UTC)
 * Envía a cada vendedor su porcentaje de objetivo mensual alcanzado.
 */
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sendWhatsApp } from "@/lib/whatsapp";

function authOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function parseImporte(s: string | null): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

function formatARS(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const MES_LABELS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const mesLabel = MES_LABELS[month];

  const [vendors, goals] = await Promise.all([
    prisma.user.findMany({
      where: { role: "VENDEDOR", phone: { not: null } },
      select: { id: true, name: true, phone: true, contabiliumId: true },
    }),
    prisma.salesGoal.findMany({
      where: { year },
      select: { userId: true, monthlyTarget: true },
    }),
  ]);

  const goalMap = new Map(goals.map((g) => [g.userId, g.monthlyTarget]));

  let sent = 0;
  const errors: string[] = [];

  for (const vendor of vendors) {
    if (!vendor.phone) continue;

    const monthlyTarget = goalMap.get(vendor.id) ?? null;
    const contabiliumId = vendor.contabiliumId;

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
    const pct = monthlyTarget && monthlyTarget > 0 ? Math.round((current / monthlyTarget) * 100) : null;

    let message: string;
    if (pct !== null && monthlyTarget) {
      const emoji = pct >= 100 ? "✅" : pct >= 75 ? "🟡" : "🔴";
      message =
        `${emoji} *Objetivo ${mesLabel} ${year}*\n\n` +
        `Llevas $${formatARS(current)} de $${formatARS(monthlyTarget)} — *${pct}%*\n\n` +
        (pct >= 100
          ? "¡Objetivo alcanzado! Buen trabajo."
          : `Te faltan $${formatARS(monthlyTarget - current)} para llegar al objetivo.`);
    } else {
      message =
        `📊 *Resumen ${mesLabel} ${year}*\n\n` +
        `Ventas aprobadas: $${formatARS(current)}\n` +
        `_(Sin objetivo configurado para este mes)_`;
    }

    try {
      await sendWhatsApp(vendor.phone, message);
      sent++;
    } catch (e) {
      errors.push(`${vendor.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return Response.json({ sent, errors: errors.length ? errors : undefined });
}
