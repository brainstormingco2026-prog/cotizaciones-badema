export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });

  const subscription = await req.json();
  if (!subscription?.endpoint) return Response.json({ error: "Suscripción inválida" }, { status: 400 });

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { pushSubscription: JSON.stringify(subscription) },
  });

  return Response.json({ ok: true });
}
