/**
 * Si la cotización tiene rawData pero algún campo del comprobante está vacío,
 * extrae FechaEmision, Numero, ImporteTotalNeto, Observaciones e IDVendedor del JSON
 * para mostrarlos en la UI (cotizaciones sincronizadas antes de tener esos campos).
 */

function getKeyIgnoreCase(raw: Record<string, unknown>, name: string): string | undefined {
  const lower = name.toLowerCase();
  return Object.keys(raw).find((k) => k.toLowerCase() === lower);
}

function getStringFromRaw(raw: Record<string, unknown>, keyName: string): string | null {
  const key = getKeyIgnoreCase(raw, keyName);
  if (key == null) return null;
  const value = raw[key];
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function getDateFromRaw(raw: Record<string, unknown>, keyName: string): string | null {
  const key = getKeyIgnoreCase(raw, keyName);
  if (key == null) return null;
  const value = raw[key];
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (s === "") return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseComprobanteFromRawData(rawData: string | null): {
  fechaEmision: string | null;
  numero: string | null;
  importeTotalNeto: string | null;
  observaciones: string | null;
  idVendedor: string | null;
} {
  if (!rawData || rawData.trim() === "") {
    return { fechaEmision: null, numero: null, importeTotalNeto: null, observaciones: null, idVendedor: null };
  }
  try {
    const raw = JSON.parse(rawData) as Record<string, unknown>;
    return {
      fechaEmision: getDateFromRaw(raw, "FechaEmision"),
      numero: getStringFromRaw(raw, "Numero"),
      importeTotalNeto: getStringFromRaw(raw, "ImporteTotalNeto"),
      observaciones: getStringFromRaw(raw, "Observaciones"),
      idVendedor: getStringFromRaw(raw, "IDVendedor"),
    };
  } catch {
    return { fechaEmision: null, numero: null, importeTotalNeto: null, observaciones: null, idVendedor: null };
  }
}

export type QuotationWithOptionalRaw = {
  fechaEmision?: string | Date | null;
  numero?: string | null;
  importeTotalNeto?: string | null;
  observaciones?: string | null;
  idVendedor?: string | null;
  rawData?: string | null;
  [k: string]: unknown;
};

/** Devuelve la cotización con los campos del comprobante rellenados desde rawData si estaban vacíos. */
export function enrichIdVendedorFromRawData<T extends QuotationWithOptionalRaw>(q: T): T {
  const fromRaw = parseComprobanteFromRawData(q.rawData ?? null);
  const hasAny = fromRaw.fechaEmision ?? fromRaw.numero ?? fromRaw.importeTotalNeto ?? fromRaw.observaciones ?? fromRaw.idVendedor;
  if (!hasAny) return q;

  const out = { ...q };
  if ((q.fechaEmision == null || (typeof q.fechaEmision === "string" && q.fechaEmision.trim() === "")) && fromRaw.fechaEmision) {
    (out as Record<string, unknown>).fechaEmision = fromRaw.fechaEmision;
  }
  if ((q.numero == null || q.numero === "") && fromRaw.numero) {
    (out as Record<string, unknown>).numero = fromRaw.numero;
  }
  if ((q.importeTotalNeto == null || q.importeTotalNeto === "") && fromRaw.importeTotalNeto) {
    (out as Record<string, unknown>).importeTotalNeto = fromRaw.importeTotalNeto;
  }
  if ((q.observaciones == null || q.observaciones === "") && fromRaw.observaciones) {
    (out as Record<string, unknown>).observaciones = fromRaw.observaciones;
  }
  if ((q.idVendedor == null || q.idVendedor === "") && fromRaw.idVendedor) {
    (out as Record<string, unknown>).idVendedor = fromRaw.idVendedor;
  }
  return out as T;
}
