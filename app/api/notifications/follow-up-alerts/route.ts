import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Lista de cotizaciones que requieren seguimiento hoy (para enviar alertas al vendedor).
 * Un cron/job puede llamar a este endpoint o replicar esta lógica y luego enviar push/email/SMS.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const apiKey = req.headers.get("x-cron-secret");
    if (apiKey !== cronSecret) return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const due = await prisma.quotation.findMany({
    where: {
      state: { in: ["abierta", "activa"] },
      nextFollowUpAt: { gte: today, lt: tomorrow },
      assignedToId: { not: null },
    },
    include: {
      client: true,
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  return Response.json({
    date: today.toISOString(),
    count: due.length,
    alerts: due.map((q) => ({
      quotationId: q.id,
      externalId: q.externalId,
      clientName: q.client.name,
      clientPhone: q.client.phone,
      clientEmail: q.client.email,
      vendorId: q.assignedTo?.id,
      vendorName: q.assignedTo?.name,
      vendorEmail: q.assignedTo?.email,
      successPercent: q.successPercent,
    })),
  });
}
