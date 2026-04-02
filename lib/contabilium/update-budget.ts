/**
 * Actualiza el estado de un presupuesto en Contabilium vía PUT /api/budgets/{id}
 *
 * Estrategia: tomamos el rawData original del presupuesto (que vino del GET de Contabilium),
 * cambiamos solo el campo `status`, eliminamos los campos de solo lectura y hacemos PUT.
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

/** Campos de solo lectura a nivel de item */
const ITEM_READONLY = ["total", "iva", "subtotal", "netoGravado", "noGravado"];

function buildPayload(rawData: Record<string, unknown>, newStatus: string): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...rawData, status: newStatus };

  // Eliminar campos de solo lectura del nivel raíz
  for (const field of TOP_LEVEL_READONLY) {
    delete payload[field];
  }

  // Limpiar items: eliminar campos computados en cada item
  if (Array.isArray(payload.items)) {
    payload.items = (payload.items as Record<string, unknown>[]).map((item) => {
      const clean = { ...item };
      for (const f of ITEM_READONLY) {
        delete clean[f];
      }
      return clean;
    });
  }

  return payload;
}

async function doPut(token: string, budgetId: string, payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${INTERNAL_BASE}/api/budgets/${budgetId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "Origin": "https://app.contabilium.com",
      "Referer": "https://app.contabilium.com/",
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

/**
 * Actualiza el estado de un presupuesto en Contabilium.
 * @param externalId - El budgetId de Contabilium (string numérico)
 * @param rawDataJson - El rawData almacenado en la DB (JSON string)
 * @param newState - El nuevo estado en formato CRM (ej: "enviada")
 */
export async function updateBudgetStatus(
  externalId: string,
  rawDataJson: string,
  newState: string
): Promise<UpdateBudgetResult> {
  const status = STATE_TO_STATUS[newState];
  if (!status) {
    return { success: false, error: `Estado inválido: ${newState}` };
  }

  let rawData: Record<string, unknown>;
  try {
    rawData = JSON.parse(rawDataJson);
  } catch {
    return { success: false, error: "rawData inválido — no se puede parsear" };
  }

  const payload = buildPayload(rawData, status);

  let token = await getInternalToken();
  if (!token) {
    return { success: false, error: "No se pudo obtener token de Contabilium" };
  }

  let result = await doPut(token, externalId, payload);

  // Si el token expiró, renovar y reintentar una vez
  if (result.status === 401 || (result.status === 403 && isInternalTokenExpired(token))) {
    const fresh = await refreshContabiliumToken();
    if (!fresh) {
      return { success: false, error: "Token expirado y no se pudo renovar" };
    }
    await saveToken(fresh);
    token = fresh;
    result = await doPut(token, externalId, payload);
  }

  if (result.ok) {
    return { success: true };
  }

  return {
    success: false,
    error: `Contabilium respondió ${result.status}`,
    detail: result.body,
  };
}
