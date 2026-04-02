export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getContabiliumConfigFromEnv } from "@/lib/contabilium/client";

const BASE = process.env.CONTABILIUM_API_URL ?? "https://rest.contabilium.com";

/** GET /api/debug/contabilium — solo admin, prueba la conexión y muestra respuestas crudas */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "ADMIN") return Response.json({ error: "No autorizado" }, { status: 403 });

  const config = getContabiliumConfigFromEnv();
  if (!config) return Response.json({ error: "Sin credenciales configuradas" });

  // 1. Obtener token
  const tokenRes = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.email,
      client_secret: config.apiKey,
    }),
  });
  if (!tokenRes.ok) {
    return Response.json({ auth: "FAIL", status: tokenRes.status, body: await tokenRes.text() });
  }
  const { access_token: token } = await tokenRes.json() as { access_token: string };

  const hoy = new Date();
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const fechaDesde = encodeURIComponent("01/01/2024");
  const fechaHasta = encodeURIComponent(fmt(hoy));

  // Obtener ID real de la búsqueda
  async function getFirstId(): Promise<number | null> {
    const r = await fetch(`${BASE}/api/comprobantes/search?FechaDesde=${fechaDesde}&FechaHasta=${fechaHasta}&page=1&pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    try {
      const body = await r.json() as { Items?: { Id: number }[] };
      return body?.Items?.[0]?.Id ?? null;
    } catch { return null; }
  }

  void await getFirstId();

  // Probar base alternativa app.contabilium.com
  const internalToken = process.env.CONTABILIUM_INTERNAL_TOKEN;
  if (!internalToken) {
    return Response.json({ auth: "OK", error: "CONTABILIUM_INTERNAL_TOKEN no configurado" });
  }

  const br = await fetch(
    "https://internalapi.contabilium.com/api/budgets?paginate=1&page=1&limit=3&period=30",
    { headers: { Authorization: `Bearer ${internalToken}`, Accept: "application/json" } }
  );
  let budgetsBody: unknown;
  try { budgetsBody = await br.json(); }
  catch { budgetsBody = { raw: (await br.text().catch(() => "")).slice(0, 300) }; }

  return Response.json({ auth: "OK", budgets_status: br.status, budgets: budgetsBody });
}
