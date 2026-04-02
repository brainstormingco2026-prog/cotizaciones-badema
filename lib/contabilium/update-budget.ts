/**
 * Actualiza el estado de un presupuesto en Contabilium vía PUT /api/budgets/{id}
 *
 * El endpoint de lista (GET /api/budgets?paginate=1) no devuelve los items de cada
 * presupuesto. Por eso, antes de hacer el PUT fetching el presupuesto completo
 * (GET /api/budgets/{id}) para obtener los items y todos los campos requeridos.
 */

import { getInternalToken, isInternalTokenExpired } from "./sync-budgets";
import { refreshContabiliumToken, saveToken } from "./auth";

const INTERNAL_BASE = "https://internalapi.contabilium.com";

/** Mapeo de estado CRM → código Contabilium */
const STATE_TO_STATUS: Record<string, string> = {
  borrador: "B",
  enviada: "E",
  aceptada: "A",
  rechazada: "R",
  facturada: "F",
};

/** Campos de solo lectura que Contabilium no acepta en el PUT */
const TOP_LEVEL_READONLY = [
  "seller",
  "person",
  "saleCondition",
  "userRegister",
  "userModifies",
  "currencyCode",
  "currencyDescription",
  "receiptInSecondaryCurrency",
  "iva",
  "totalNetAmount",
  "grossTotalAmount",
  "netoGravado",
  "noGravado",
  "total",
  "number",
  "meta",
];

/** Campos a eliminar de cada item antes del PUT.
 *  - concept: viene parcial del GET (solo code+stock), causa TYPE_ERROR. conceptId es suficiente.
 *  - subtotal/netoGravado/noGravado: campos computados no aceptados.
 *  - total e iva SÍ son requeridos por Contabilium.
 */
const ITEM_READONLY = ["concept", "subtotal", "netoGravado", "noGravado"];

/**
 * Convierte una fecha al formato d/m/Y que requiere el PUT de Contabilium.
 * Si ya está en ese formato, la devuelve tal cual.
 */
function toContabiliumDate(value: unknown): unknown {
  if (typeof value !== "string" || !value) return value;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function buildPayload(fullBudget: Record<string, unknown>, newStatus: string): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...fullBudget, status: newStatus };

  for (const field of TOP_LEVEL_READONLY) {
    delete payload[field];
  }

  if (payload.createdAt != null) payload.createdAt = toContabiliumDate(payload.createdAt);
  if (payload.dateValidity != null) payload.dateValidity = toContabiliumDate(payload.dateValidity);

  if (Array.isArray(payload.items)) {
    payload.items = (payload.items as Record<string, unknown>[]).map((item) => {
      const clean = { ...item };
      for (const f of ITEM_READONLY) delete clean[f];
      return clean;
    });
  }

  return payload;
}

async function fetchFullBudget(token: string, budgetId: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${INTERNAL_BASE}/api/budgets/${budgetId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      Origin: "https://app.contabilium.com",
      Referer: "https://app.contabilium.com/",
    },
  });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

async function doPut(token: string, budgetId: string, payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${INTERNAL_BASE}/api/budgets/${budgetId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: "https://app.contabilium.com",
      Referer: "https://app.contabilium.com/",
    },
    body: JSON.stringify(payload),
  });
  let body: unknown;
  try { body = await res.json(); } catch { body = null; }
  return { ok: res.ok, status: res.status, body };
}

export type UpdateBudgetResult =
  | { success: true }
  | { success: false; error: string; detail?: unknown };

export async function updateBudgetStatus(
  externalId: string,
  _rawDataJson: string,
  newState: string
): Promise<UpdateBudgetResult> {
  const status = STATE_TO_STATUS[newState];
  if (!status) {
    return { success: false, error: `Estado inválido: ${newState}` };
  }

  let token = await getInternalToken();
  if (!token) {
    return { success: false, error: "No se pudo obtener token de Contabilium" };
  }

  // Obtener el presupuesto completo (con items) desde Contabilium
  let fullBudget = await fetchFullBudget(token, externalId);

  // Si el GET devuelve 401, renovar token y reintentar
  if (!fullBudget) {
    if (isInternalTokenExpired(token)) {
      const fresh = await refreshContabiliumToken();
      if (!fresh) return { success: false, error: "Token expirado y no se pudo renovar" };
      await saveToken(fresh);
      token = fresh;
      fullBudget = await fetchFullBudget(token, externalId);
    }
    if (!fullBudget) {
      return { success: false, error: "No se pudo obtener el presupuesto completo desde Contabilium" };
    }
  }

  const payload = buildPayload(fullBudget, status);

  let result = await doPut(token, externalId, payload);

  if (result.status === 401) {
    const fresh = await refreshContabiliumToken();
    if (!fresh) return { success: false, error: "Token expirado y no se pudo renovar" };
    await saveToken(fresh);
    token = fresh;
    result = await doPut(token, externalId, payload);
  }

  if (result.ok) {
    return { success: true };
  }

  const detail = result.body ? JSON.stringify(result.body) : "";
  return {
    success: false,
    error: `Contabilium respondió ${result.status}${detail ? `: ${detail}` : ""}`,
    detail: result.body,
  };
}
