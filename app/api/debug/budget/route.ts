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

// Hace el PUT real a Contabilium y devuelve el payload enviado + respuesta completa
export async function POST(req: NextRequest) {
  const { externalId, newStatus } = await req.json();
  if (!externalId || !newStatus) return Response.json({ error: "Falta externalId o newStatus" }, { status: 400 });

  const token = await getInternalToken();
  if (!token) return Response.json({ error: "Sin token" }, { status: 500 });

  // GET completo del presupuesto
  const getRes = await fetch(`https://internalapi.contabilium.com/api/budgets/${externalId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", Origin: "https://app.contabilium.com", Referer: "https://app.contabilium.com/" },
  });
  const full = await getRes.json() as Record<string, unknown>;

  // Mismo formato que la web de Contabilium
  function toDate(v: unknown) {
    if (typeof v !== "string" || !v) return "";
    if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(v)) return v;
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
  }

  const rawItems = Array.isArray(full.items) ? (full.items as Record<string,unknown>[]) : [];
  const items = rawItems.map(item => {
    const conceptObj = item.concept as Record<string,unknown> | null;
    return { code: conceptObj?.code ?? "", total: item.total, concept: item.description ?? "", unitPrice: item.unitPrice, iva: item.iva, bonus: item.bonus, conceptId: item.conceptId, ivaRateId: item.ivaRateId };
  });

  const payload = {
    personId: full.personId, name: "", createdAt: toDate(full.createdAt), dateValidity: toDate(full.dateValidity),
    status: newStatus, currencyId: full.currencyId, exchangeRate: full.exchangeRate, items,
    observations: full.observations ?? "", saleConditionId: full.saleConditionId,
    sellerId: full.sellerId != null ? Number(full.sellerId) : null, type: full.type,
  };

  const putRes = await fetch(`https://internalapi.contabilium.com/api/budgets/${externalId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json", Origin: "https://app.contabilium.com", Referer: "https://app.contabilium.com/" },
    body: JSON.stringify(payload),
  });

  let putBody: unknown;
  try { putBody = await putRes.json(); } catch { putBody = await putRes.text().catch(() => null); }

  return Response.json({ putStatus: putRes.status, putBody, payloadSent: payload });
}
