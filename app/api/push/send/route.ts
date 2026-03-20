import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL ?? "mailto:admin@badema.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? ""
);

/**
 * Envía push notifications a los vendedores con seguimientos para hoy.
 * Llamar desde un cron diario (ej. 8:00 AM) o manualmente.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (req.headers.get("x-cron-secret") !== cronSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // Cotizaciones con seguimiento hoy (activas)
  const quotations = await prisma.quotation.findMany({
    where: {
      nextFollowUpAt: { gte: today, lt: tomorrow },
      state: { notIn: ["aceptada", "rechazada"] },
    },
    select: {
      externalId: true,
      idVendedor: true,
      client: { select: { name: true } },
    },
  });

  if (quotations.length === 0) return Response.json({ sent: 0 });

  // Agrupar por idVendedor
  const byVendor: Record<string, typeof quotations> = {};
  for (const q of quotations) {
    const key = q.idVendedor ?? "__none__";
    if (!byVendor[key]) byVendor[key] = [];
    byVendor[key].push(q);
  }

  // Buscar usuarios con pushSubscription y su contabiliumId
  const users = await prisma.user.findMany({
    where: { pushSubscription: { not: null } },
    select: { id: true, contabiliumId: true, pushSubscription: true },
  });

  let sent = 0;
  const errors: string[] = [];

  for (const user of users) {
    const key = user.contabiliumId ?? "__none__";
    const pending = byVendor[key];
    if (!pending?.length) continue;

    const body =
      pending.length === 1
        ? `Seguimiento: ${pending[0].client.name}`
        : `${pending.length} seguimientos pendientes hoy`;

    try {
      await webpush.sendNotification(
        JSON.parse(user.pushSubscription!),
        JSON.stringify({
          title: "CRM Badema · Seguimiento",
          body,
          url: "/dashboard",
        })
      );
      sent++;
    } catch (e) {
      errors.push(String(e));
      // Si la suscripción expiró, la limpiamos
      await prisma.user.update({
        where: { id: user.id },
        data: { pushSubscription: null },
      });
    }
  }

  return Response.json({ sent, errors });
}
