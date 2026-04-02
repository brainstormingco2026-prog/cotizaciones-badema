/**
 * Sincronización de cotizaciones desde Contabilium al CRM.
 *
 * Sin credenciales (o con USE_MOCK_CONTABILIUM=true) se usan datos simulados.
 * Con credenciales se llama a la API real.
 */

import { createContabiliumClient, getContabiliumConfigFromEnv } from "./client";
import { getMockQuotations } from "./mock";
import { prisma } from "../db";


export type FollowUpFrequency = "DAYS_3" | "DAYS_7" | "DAYS_15" | "DAYS_30";

const FREQUENCY_DAYS: Record<FollowUpFrequency, number> = {
  DAYS_3: 3,
  DAYS_7: 7,
  DAYS_15: 15,
  DAYS_30: 30,
};

/**
 * Formato API Contabilium /api/comprobantes/search.
 * Los campos del comprobante que mostramos en el CRM (Fecha emisión, Número, Importe neto,
 * Observaciones, Id. vendedor) se heredan siempre de este payload.
 */
type ExternalQuotation = {
  Id: number;
  IdCliente?: number;
  RazonSocial?: string;
  Estado?: string;
  /** Fecha de emisión → Quotation.fechaEmision */
  FechaEmision?: string;
  /** Número comprobante → Quotation.numero */
  Numero?: string;
  /** Importe total neto → Quotation.importeTotalNeto */
  ImporteTotalNeto?: string;
  /** Observaciones → Quotation.observaciones */
  Observaciones?: string;
  /** ID vendedor en Contabilium → Quotation.idVendedor */
  IDVendedor?: number;
  Cliente?: { Id: number; RazonSocial: string; Email?: string; Telefono?: string };
  Fecha?: string;
  FechaAlta?: string;
  [k: string]: unknown;
};

/** Valor de IDVendedor del payload (cualquier variante de nombre: IDVendedor, IdVendedor, idVendedor, etc.). */
function getIdVendedorFromPayload(ext: ExternalQuotation): string | null {
  const raw = ext as Record<string, unknown>;
  let value: unknown =
    raw.IDVendedor ?? raw.IdVendedor ?? raw.idVendedor;
  if (value === undefined || value === null) {
    const key = Object.keys(raw).find((k) => k.toLowerCase() === "idvendedor");
    value = key != null ? raw[key] : undefined;
  }
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/** Extrae del payload de Contabilium los 5 campos del comprobante que heredamos en cada cotización. */
function getComprobanteFromPayload(ext: ExternalQuotation) {
  const raw = ext as Record<string, unknown>;
  return {
    fechaEmision: (ext.FechaEmision ?? raw.FechaEmision ?? raw.fechaEmision) != null
      ? (() => {
          const d = new Date(String(ext.FechaEmision ?? raw.FechaEmision ?? raw.fechaEmision));
          return Number.isNaN(d.getTime()) ? null : d;
        })()
      : null,
    numero: (ext.Numero ?? raw.Numero ?? raw.numero) != null
      ? String(ext.Numero ?? raw.Numero ?? raw.numero)
      : null,
    importeTotalNeto: (ext.ImporteTotalNeto ?? raw.ImporteTotalNeto ?? raw.importeTotalNeto) != null
      ? String(ext.ImporteTotalNeto ?? raw.ImporteTotalNeto ?? raw.importeTotalNeto)
      : null,
    observaciones: (ext.Observaciones ?? raw.Observaciones ?? raw.observaciones) != null
      ? String(ext.Observaciones ?? raw.Observaciones ?? raw.observaciones)
      : null,
    idVendedor: getIdVendedorFromPayload(ext),
  };
}

function useMockContabilium(): boolean {
  if (process.env.USE_MOCK_CONTABILIUM === "true") return true;
  const config = getContabiliumConfigFromEnv();
  return !config;
}

export async function syncQuotationsFromContabilium(): Promise<{
  created: number;
  updated: number;
  errors: string[];
  mock: boolean;
}> {
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  const mock = useMockContabilium();

  const log = await prisma.syncLog.create({
    data: { status: "running", message: mock ? "Sync con datos simulados" : "Started" },
  });

  let items: ExternalQuotation[];

  try {
    if (mock) {
      items = getMockQuotations();
    } else {
      const config = getContabiliumConfigFromEnv();
      if (!config) throw new Error("Contabilium credentials not configured");
      const client = await createContabiliumClient(config);
      // Endpoint: https://rest.contabilium.com/api/comprobantes/search?TipoFc="COT"&FechaDesde=DD/MM/AAAA
      const path = process.env.CONTABILIUM_COTIZACIONES_PATH ?? "/api/comprobantes/search";
      // FechaDesde y FechaHasta requeridas (formato DD/MM/YYYY)
      // Por defecto: desde 2 años atrás hasta hoy. Configurable via CONTABILIUM_FECHA_DESDE / CONTABILIUM_FECHA_HASTA
      const fmt = (d: Date) =>
        `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      const today = new Date();
      const twoYearsAgo = new Date(today);
      twoYearsAgo.setFullYear(today.getFullYear() - 2);
      const fechaDesde = process.env.CONTABILIUM_FECHA_DESDE ?? fmt(twoYearsAgo);
      const fechaHasta = process.env.CONTABILIUM_FECHA_HASTA ?? fmt(today);
      items = await client.getPaginated<ExternalQuotation>(path, { TipoFc: "COT", FechaDesde: fechaDesde, FechaHasta: fechaHasta }).catch((e) => {
        errors.push(String(e.message));
        return [];
      });
    }

    for (const ext of items) {
      try {
        // API real usa IdCliente/RazonSocial en raíz; legacy usa Cliente anidado
        const clientId = ext.IdCliente ?? ext.Cliente?.Id ?? ext.Id;
        const clientName = ext.RazonSocial ?? ext.Cliente?.RazonSocial ?? "Sin nombre";
        const raw2 = ext as Record<string, unknown>;
        const clientEmail = ext.Cliente?.Email ?? (raw2.Email as string | undefined) ?? undefined;
        const clientPhone = ext.Cliente?.Telefono ?? (raw2.Telefono as string | undefined) ?? (raw2.Celular as string | undefined) ?? undefined;
        const state = (ext.Estado ?? "pendiente").toLowerCase();

        let client = await prisma.client.findFirst({
          where: { externalId: String(clientId) },
        });
        if (!client) {
          client = await prisma.client.create({
            data: {
              externalId: String(clientId),
              name: clientName,
              email: clientEmail ?? null,
              phone: clientPhone ?? null,
            },
          });
        } else if (clientEmail || clientPhone) {
          client = await prisma.client.update({
            where: { id: client.id },
            data: {
              ...(clientEmail ? { email: clientEmail } : {}),
              ...(clientPhone ? { phone: clientPhone } : {}),
            },
          });
        }

        const existing = await prisma.quotation.findUnique({
          where: { externalId: String(ext.Id) },
        });

        // Fecha emisión, Número, Importe neto, Observaciones e Id. vendedor se heredan del payload de Contabilium
        const comprobante = getComprobanteFromPayload(ext);

        const closedState = state === "aceptada" || state === "rechazada";
        const payload = {
          externalId: String(ext.Id),
          state,
          clientId: client.id,
          rawData: JSON.stringify(ext),
          lastSyncedAt: new Date(),
          fechaEmision: comprobante.fechaEmision,
          numero: comprobante.numero,
          importeTotalNeto: comprobante.importeTotalNeto,
          observaciones: comprobante.observaciones,
          idVendedor: comprobante.idVendedor,
          ...(closedState ? { followUpFreq: null, nextFollowUpAt: null } : {}),
        };

        if (existing) {
          await prisma.quotation.update({
            where: { id: existing.id },
            data: payload,
          });
          updated++;
        } else {
          await prisma.quotation.create({
            data: payload,
          });
          created++;
        }
      } catch (e) {
        errors.push(`Quotation ${ext.Id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: errors.length === 0 ? "success" : "partial",
        finishedAt: new Date(),
        message: errors.length > 0 ? errors.join("; ") : (mock ? "Datos simulados" : null),
        stats: JSON.stringify({ created, updated, errors: errors.length, mock }),
      },
    });

    return { created, updated, errors, mock };
  } catch (e) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        message: e instanceof Error ? e.message : String(e),
      },
    });
    throw e;
  }
}

/**
 * Agrega N días hábiles (lunes a viernes) a partir de una fecha.
 */
function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) remaining--; // saltar sábado (6) y domingo (0)
  }
  return result;
}

/**
 * Calcula la próxima fecha de seguimiento según la frecuencia elegida,
 * contando solo días hábiles (lunes a viernes).
 */
export function computeNextFollowUp(frequency: FollowUpFrequency): Date {
  return addBusinessDays(new Date(), FREQUENCY_DAYS[frequency]);
}
