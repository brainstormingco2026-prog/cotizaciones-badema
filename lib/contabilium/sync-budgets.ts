/**
 * Sincronización de cotizaciones (budgets) desde internalapi.contabilium.com
 *
 * Usa el JWT de sesión del web app (CONTABILIUM_INTERNAL_TOKEN).
 * El token dura ~20 horas y se configura desde el panel admin.
 *
 * Endpoint: GET https://internalapi.contabilium.com/api/budgets?paginate=1&page=N&limit=50
 */

import { prisma } from "../db";
import { refreshContabiliumToken, saveToken } from "./auth";

const INTERNAL_BASE = "https://internalapi.contabilium.com";

/** Códigos de estado de Contabilium → estados del CRM */
const STATUS_MAP: Record<string, string> = {
  B: "borrador",
  E: "enviada",
  A: "aceptada",
  R: "rechazada",
  F: "facturada",
};

type BudgetItem = {
  budgetId: number;
  userId: number;
  personId: number;
  status: string;
  sellerId: string | null;
  createdAt: string;
  dateValidity: string | null;
  number: string;
  observations: string | null;
  totalNetAmount: number | null;
  grossTotalAmount: number | null;
  seller?: { email?: string } | null;
  person?: {
    socialReason?: string;
    identificacionNumber?: string;
    email?: string;
  } | null;
  [k: string]: unknown;
};

type BudgetsResponse = {
  data: BudgetItem[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
};

export async function getInternalToken(): Promise<string | null> {
  // 1. Buscar en DB
  try {
    const setting = await prisma.setting.findUnique({ where: { key: "contabilium_token" } });
    if (setting?.value && !isInternalTokenExpired(setting.value)) return setting.value;
  } catch { /* Si falla la DB, continuar */ }

  // 2. Env var (fallback manual)
  const envToken = process.env.CONTABILIUM_INTERNAL_TOKEN ?? null;
  if (envToken && !isInternalTokenExpired(envToken)) return envToken;

  // 3. Auto-login: obtener token fresco
  const fresh = await refreshContabiliumToken();
  return fresh;
}

/** Verifica si el token ya expiró leyendo el campo `exp` del JWT */
export function isInternalTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return payload.exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

async function fetchPage(token: string, page: number): Promise<BudgetsResponse> {
  const url = `${INTERNAL_BASE}/api/budgets?paginate=1&page=${page}&limit=50`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (res.status === 401) throw new Error(`AUTH_EXPIRED`);
  if (!res.ok) throw new Error(`internalapi budgets page ${page}: ${res.status}`);
  return res.json() as Promise<BudgetsResponse>;
}

/** Formatea el monto numérico como string con separadores (ej: 20290.49 → "20.290,49") */
function formatAmount(n: number | null): string | null {
  if (n == null) return null;
  return n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function syncBudgetsFromContabilium(): Promise<{
  created: number;
  updated: number;
  errors: string[];
  tokenExpired: boolean;
}> {
  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  const token = await getInternalToken();
  if (!token) {
    return { created: 0, updated: 0, errors: ["No se pudo obtener token de Contabilium (login automático falló)"], tokenExpired: true };
  }

  // Obtener todas las páginas (con un reintento automático si el token expiró)
  let allItems: BudgetItem[] = [];
  let activeToken = token;
  try {
    const firstPage = await fetchPage(activeToken, 1);
    allItems = firstPage.data;
    const lastPage = firstPage.meta.last_page;
    for (let p = 2; p <= lastPage; p++) {
      const page = await fetchPage(activeToken, p);
      allItems.push(...page.data);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "AUTH_EXPIRED") {
      // Token rechazado por el servidor — forzar re-login y reintentar una vez
      const fresh = await refreshContabiliumToken();
      if (!fresh) {
        return { created: 0, updated: 0, errors: ["Token expirado y no se pudo renovar automáticamente"], tokenExpired: true };
      }
      activeToken = fresh;
      await saveToken(fresh);
      try {
        const firstPage = await fetchPage(activeToken, 1);
        allItems = firstPage.data;
        const lastPage = firstPage.meta.last_page;
        for (let p = 2; p <= lastPage; p++) {
          const page = await fetchPage(activeToken, p);
          allItems.push(...page.data);
        }
      } catch (e2) {
        errors.push(`Error al obtener budgets tras re-login: ${e2 instanceof Error ? e2.message : String(e2)}`);
        return { created, updated, errors, tokenExpired: true };
      }
    } else {
      errors.push(`Error al obtener budgets: ${msg}`);
      return { created, updated, errors, tokenExpired: false };
    }
  }

  const log = await prisma.syncLog.create({
    data: { status: "running", message: `Sync budgets: ${allItems.length} items` },
  });

  // Pre-fetch en bulk para evitar N+1 queries
  const [existingQuotations, existingClients] = await Promise.all([
    prisma.quotation.findMany({ select: { id: true, externalId: true, fechaEmision: true } }),
    prisma.client.findMany({ where: { externalId: { not: null } }, select: { id: true, externalId: true, name: true } }),
  ]);
  const quotationMap = new Map(existingQuotations.map((q) => [q.externalId, q]));
  const clientMap = new Map(existingClients.map((c) => [c.externalId!, c]));

  // Preparar clientes nuevos (crear primero, son pocos)
  const newClientExternalIds = [...new Set(
    allItems.map((i) => String(i.personId)).filter((id) => !clientMap.has(id))
  )];
  for (const extId of newClientExternalIds) {
    const item = allItems.find((i) => String(i.personId) === extId)!;
    try {
      const client = await prisma.client.create({
        data: {
          externalId: extId,
          name: item.person?.socialReason ?? "Sin nombre",
          email: item.person?.email ?? null,
        },
        select: { id: true, externalId: true, name: true },
      });
      clientMap.set(extId, client);
    } catch { /* ya existe por race condition — ignorar */ }
  }

  // Construir todas las operaciones de upsert de cotizaciones
  const now = new Date();
  const upsertOps = allItems.map((item) => {
    const externalId = String(item.budgetId);
    const state = STATUS_MAP[item.status] ?? "borrador";
    const clientExternalId = String(item.personId);
    const client = clientMap.get(clientExternalId);
    if (!client) return null;

    const fechaEmisionFromContabilium = item.createdAt ? new Date(item.createdAt) : null;
    const existing = quotationMap.get(externalId);
    const fechaEmision = existing?.fechaEmision ?? fechaEmisionFromContabilium;
    const idVendedor = item.sellerId ? String(item.sellerId) : null;
    const closedState = state === "aceptada" || state === "rechazada" || state === "facturada";

    const payload = {
      externalId,
      state,
      clientId: client.id,
      rawData: JSON.stringify(item),
      lastSyncedAt: now,
      fechaEmision,
      numero: item.number ?? null,
      importeTotalNeto: formatAmount(item.totalNetAmount),
      observaciones: item.observations ?? null,
      idVendedor,
      ...(closedState ? { followUpFreq: null, nextFollowUpAt: null } : {}),
    };

    const isNew = !existing;
    if (isNew) created++; else updated++;

    return prisma.quotation.upsert({
      where: { externalId },
      create: payload,
      update: payload,
    });
  }).filter(Boolean) as ReturnType<typeof prisma.quotation.upsert>[];

  // Ejecutar en batches de 50 dentro de transacciones
  const BATCH = 50;
  for (let i = 0; i < upsertOps.length; i += BATCH) {
    try {
      await prisma.$transaction(upsertOps.slice(i, i + BATCH));
    } catch (e) {
      errors.push(`Batch ${i}-${i + BATCH}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await prisma.syncLog.update({
    where: { id: log.id },
    data: {
      status: errors.length === 0 ? "success" : "partial",
      finishedAt: new Date(),
      message: errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
      stats: JSON.stringify({ created, updated, errors: errors.length }),
    },
  });

  return { created, updated, errors, tokenExpired: false };
}
