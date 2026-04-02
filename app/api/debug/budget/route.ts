export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getInternalToken } from "@/lib/contabilium/sync-budgets";

export async function GET(req: NextRequest) {

  const externalId = req.nextUrl.searchParams.get("id");
  if (!externalId) return Response.json({ error: "Falta ?id=" }, { status: 400 });

  const q = await prisma.quotation.findFirst({
    where: { externalId },
    select: { externalId: true, rawData: true, state: true },
  });
  if (!q) return Response.json({ error: "No encontrada" }, { status: 404 });

  const raw = JSON.parse(q.rawData ?? "{}");
  const item0 = Array.isArray(raw.items) ? raw.items[0] : null;

  return Response.json({
    externalId: q.externalId,
    state: q.state,
    createdAt: raw.createdAt,
    dateValidity: raw.dateValidity,
    status: raw.status,
    itemsCount: Array.isArray(raw.items) ? raw.items.length : 0,
    item0keys: item0 ? Object.keys(item0) : [],
    conceptKeys: item0?.concept ? Object.keys(item0.concept) : [],
    stockKeys: item0?.concept?.stock ? Object.keys(item0.concept.stock) : [],
    reserveValue: item0?.concept?.stock?.reserve,
    reserveType: typeof item0?.concept?.stock?.reserve,
    topLevelKeys: Object.keys(raw),
  });
}

// Obtiene el presupuesto completo desde Contabilium (para ver qué devuelve el GET /api/budgets/{id})
export async function POST(req: NextRequest) {

  const { externalId } = await req.json();
  if (!externalId) return Response.json({ error: "Falta externalId" }, { status: 400 });

  const token = await getInternalToken();
  if (!token) return Response.json({ error: "Sin token" }, { status: 500 });

  // Obtener el presupuesto completo con items
  const res = await fetch(`https://internalapi.contabilium.com/api/budgets/${externalId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", Origin: "https://app.contabilium.com", Referer: "https://app.contabilium.com/" },
  });

  let full: unknown;
  try { full = await res.json(); } catch { full = await res.text().catch(() => null); }

  // Agregar anotaciones de tipo para cada campo del primer item
  const fullObj = full as Record<string, unknown>;
  const item0 = Array.isArray(fullObj?.items) ? (fullObj.items as Record<string,unknown>[])[0] : null;
  const item0WithTypes = item0 ? Object.fromEntries(
    Object.entries(item0).map(([k, v]) => [k, { value: v, type: typeof v, isNull: v === null }])
  ) : null;
  const topWithTypes = Object.fromEntries(
    Object.entries(fullObj ?? {}).filter(([k]) => k !== "items").map(([k, v]) => [k, { value: v, type: typeof v, isNull: v === null }])
  );

  return Response.json({ status: res.status, topLevel: topWithTypes, item0WithTypes, itemsCount: Array.isArray(fullObj?.items) ? (fullObj.items as unknown[]).length : 0 });
}
