/**
 * Cron: lunes 9:15 AM Argentina (12:15 UTC)
 * Envía a cada vendedor los seguimientos que vencen esta semana (lun–vie).
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

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  friday.setUTCHours(23, 59, 59, 999);

  const followUps = await prisma.quotation.findMany({
    where: {
      nextFollowUpAt: { gte: monday, lte: friday },
      state: { notIn: ["aceptada", "rechazada", "facturada"] },
    },
    select: {
      externalId: true,
      importeTotalNeto: true,
      nextFollowUpAt: true,
      client: { select: { name: true } },
      assignedTo: { select: { id: true, name: true, phone: true, callmebotApiKey: true } },
    },
    orderBy: { nextFollowUpAt: "asc" },
  });

  if (followUps.length === 0) {
    return Response.json({ sent: 0, message: "Sin seguimientos esta semana" });
  }

  const byVendor = new Map<string, { name: string; phone: string; apiKey: string; items: typeof followUps }>();
  for (const f of followUps) {
    if (!f.assignedTo?.phone || !f.assignedTo?.callmebotApiKey) continue;
    const key = f.assignedTo.id;
    if (!byVendor.has(key)) {
      byVendor.set(key, { name: f.assignedTo.name, phone: f.assignedTo.phone, apiKey: f.assignedTo.callmebotApiKey, items: [] });
    }
    byVendor.get(key)!.items.push(f);
  }

  let sent = 0;
  const errors: string[] = [];
  const weekLabel = `${monday.toLocaleDateString("es-AR")} al ${friday.toLocaleDateString("es-AR")}`;

  for (const [, vendor] of byVendor) {
    const lines = vendor.items.map((f) => {
      const d = f.nextFollowUpAt ? new Date(f.nextFollowUpAt) : null;
      const dayLabel = d ? DAY_NAMES[d.getUTCDay()] : "";
      const dateLabel = d ? d.toLocaleDateString("es-AR") : "";
      return `• ${dayLabel} ${dateLabel} — ${f.client.name} #${f.externalId}${f.importeTotalNeto ? ` ($${f.importeTotalNeto})` : ""}`;
    });

    const message =
      `*Seguimientos de la semana — ${weekLabel}*\n\n` +
      lines.join("\n") +
      `\n\n_${vendor.items.length} cotización${vendor.items.length !== 1 ? "es" : ""} para esta semana._`;

    try {
      await sendWhatsApp(vendor.phone, message, vendor.apiKey);
      sent++;
    } catch (e) {
      errors.push(`${vendor.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return Response.json({ sent, errors: errors.length ? errors : undefined });
}
