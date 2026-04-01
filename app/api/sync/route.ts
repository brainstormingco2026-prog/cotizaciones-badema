export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { syncBudgetsFromContabilium } from "@/lib/contabilium/sync-budgets";
import { syncVendorsFromContabilium } from "@/lib/contabilium/sync-vendors";

/**
 * POST /api/sync — sincroniza cotizaciones y vendedores desde Contabilium
 * Solo admin.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "ADMIN") {
    return Response.json({ error: "Solo administradores pueden ejecutar la sincronización" }, { status: 403 });
  }
  try {
    const [quotations, vendors] = await Promise.all([
      syncBudgetsFromContabilium(),
      syncVendorsFromContabilium(),
    ]);
    if (quotations.tokenExpired) {
      return Response.json({ error: "No se pudo obtener token de Contabilium (login automático falló).", tokenExpired: true }, { status: 401 });
    }
    return Response.json({ quotations, vendors });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Error en sincronización" },
      { status: 500 }
    );
  }
}
