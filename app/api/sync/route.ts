export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { syncQuotationsFromContabilium } from "@/lib/contabilium/sync-quotations";

/**
 * Sincronizar cotizaciones desde Contabilium. Solo admin o bien llamado por cron con API key.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  if (auth.user.role !== "ADMIN") {
    return Response.json({ error: "Solo administradores pueden ejecutar la sincronización" }, { status: 403 });
  }
  try {
    const result = await syncQuotationsFromContabilium();
    return Response.json(result);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Error en sincronización" },
      { status: 500 }
    );
  }
}
