/**
 * Cron: 9:00 AM Argentina (12:00 UTC) todos los días
 * Envía a cada vendedor sus cotizaciones con seguimiento vencido hoy.
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

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const followUps = await prisma.quotation.findMany({
    where: {
      nextFollowUpAt: { gte: startOfDay, lte: endOfDay },
      state: { notIn: ["aceptada", "rechazada", "facturada"] },
    },
    select: {
      externalId: true,
      importeTotalNeto: true,
      client: { select: { name: true } },
      assignedTo: { select: { id: true, name: true, phone: true, callmebotApiKey: true } },
    },
  });

  if (followUps.length === 0) {
    return Response.json({ sent: 0, message: "Sin seguimientos para hoy" });
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

  for (const [, vendor] of byVendor) {
    const lines = vendor.items.map(
      (f) => `• ${f.client.name} — Cot. #${f.externalId}${f.importeTotalNeto ? ` ($${f.importeTotalNeto})` : ""}`
    );
    const message =
      `*Seguimientos de hoy — ${now.toLocaleDateString("es-AR")}*\n\n` +
      lines.join("\n") +
      `\n\n_${vendor.items.length} cotización${vendor.items.length !== 1 ? "es" : ""} para contactar hoy._`;

    try {
      await sendWhatsApp(vendor.phone, message, vendor.apiKey);
      sent++;
    } catch (e) {
      errors.push(`${vendor.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return Response.json({ sent, errors: errors.length ? errors : undefined });
}
