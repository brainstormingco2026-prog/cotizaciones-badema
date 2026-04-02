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

function toContabiliumDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/**
 * Construye el payload exacto que la web de Contabilium envía en el PUT /api/budgets/{id}.
 * Formato capturado inspeccionando los requests del propio Contabilium:
 * - sellerId como número
 * - items con concept como string (descripción), code al nivel del item
 * - sin budgetId, userId, campos de solo lectura
 */
function buildPayload(fullBudget: Record<string, unknown>, newStatus: string, fechaEmision?: Date | null): Record<string, unknown> {
  const rawItems = Array.isArray(fullBudget.items)
    ? (fullBudget.items as Record<string, unknown>[])
    : [];

  const items = rawItems.map((item) => {
    const conceptObj = item.concept as Record<string, unknown> | null;
    return {
      code: conceptObj?.code ?? "",
      total: item.total,
      concept: item.description ?? "",   // "concept" en el PUT es la descripción (string)
      unitPrice: item.unitPrice,
      iva: item.iva,
      bonus: item.bonus,
      conceptId: item.conceptId,
      ivaRateId: item.ivaRateId,
    };
  });

  return {
    personId: fullBudget.personId,
    name: "",
    createdAt: fechaEmision
      ? toContabiliumDate(fechaEmision.toISOString())
      : toContabiliumDate(fullBudget.createdAt),
    dateValidity: toContabiliumDate(fullBudget.dateValidity),
    status: newStatus,
    currencyId: fullBudget.currencyId,
    exchangeRate: fullBudget.exchangeRate,
    items,
    observations: fullBudget.observations ?? "",
    saleConditionId: fullBudget.saleConditionId,
    sellerId: fullBudget.sellerId != null ? Number(fullBudget.sellerId) : null,
    type: fullBudget.type,
  };
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

/** Estados que NO se sincronizan con Contabilium porque tienen efectos secundarios
 *  (aceptada genera comprobante, facturada se maneja desde Contabilium directamente) */
const STATES_NO_SYNC = new Set(["aceptada", "facturada"]);

export async function updateBudgetStatus(
  externalId: string,
  _rawDataJson: string,
  newState: string,
  fechaEmision?: Date | null,
): Promise<UpdateBudgetResult> {
  if (STATES_NO_SYNC.has(newState)) {
    return { success: true }; // solo se actualiza en CRM
  }

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

  const payload = buildPayload(fullBudget, status, fechaEmision);

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
