/**
 * Cron: sincronización automática con Contabilium
 * Recomendado: cada 30 minutos via cron-job.org
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest } from "next/server";
import { syncBudgetsFromContabilium } from "@/lib/contabilium/sync-budgets";
import { syncVendorsFromContabilium } from "@/lib/contabilium/sync-vendors";

function authOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [quotations, vendors] = await Promise.all([
      syncBudgetsFromContabilium(),
      syncVendorsFromContabilium(),
    ]);
    return Response.json({ quotations, vendors, syncedAt: new Date().toISOString() });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Error en sincronización" },
      { status: 500 }
    );
  }
}
