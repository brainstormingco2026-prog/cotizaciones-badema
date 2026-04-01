"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("crm_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const MOTIVO_LABELS: Record<string, string> = {
  PRECIO: "Precio",
  PLAZO_EXCESIVO: "Plazo excesivo",
  BAJA: "Baja",
  COMPETENCIA: "Competencia",
};

type Quotation = {
  id: string;
  externalId: string;
  state: string;
  successPercent: number;
  followUpFreq: string | null;
  nextFollowUpAt: string | null;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
  fechaEmision: string | null;
  numero: string | null;
  importeTotalNeto: string | null;
  observaciones: string | null;
  idVendedor: string | null;
  vendedor: { name: string; email: string; phone: string | null } | null;
  motivoRechazo: string | null;
  client: { id: string; name: string; email: string | null; phone: string | null; address: string | null };
  assignedTo: { id: string; name: string; email: string } | null;
};

const FREQ_LABELS: Record<string, string> = {
  DAYS_3: "Cada 3 días",
  DAYS_7: "Cada 7 días",
  DAYS_15: "Cada 15 días",
  DAYS_30: "Cada 30 días",
};

const STATE_ORDER: Record<string, number> = {
  borrador: 0,
  enviada: 1,
  aceptada: 2,
  rechazada: 3,
  facturada: 4,
};

type EditingCell = { id: string; field: "successPercent" | "followUpFreq" | "motivoRechazo" };

export default function CotizacionesPage() {
  const searchParams = useSearchParams();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>(searchParams.get("estado") ?? "");
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; mock?: boolean } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleEmailCopy(email: string, externalId: string) {
    navigator.clipboard.writeText(email).catch(() => {});
    setCopiedId(externalId);
    setTimeout(() => setCopiedId((v) => (v === externalId ? null : v)), 2500);
  }
  const [syncError, setSyncError] = useState("");
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const inputRef = useRef<HTMLInputElement & HTMLSelectElement>(null);

  useEffect(() => {
    const u = localStorage.getItem("crm_user");
    if (u) setUser(JSON.parse(u));
  }, []);

  function loadQuotations() {
    setLoading(true);
    const params = filter ? `?state=${encodeURIComponent(filter)}` : "";
    fetch(`/api/quotations${params}`, { headers: getAuthHeader() })
      .then((res) => (res.ok ? res.json() : { quotations: [] }))
      .then((data) => setQuotations(data.quotations ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadQuotations(); }, [filter]);

  async function handleSync() {
    setSyncing(true);
    setSyncError("");
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      });
      const result = await res.json();
      if (!res.ok) { setSyncError(result.error ?? "Error al sincronizar"); return; }
      setSyncResult({ created: result.created, updated: result.updated, mock: result.mock });
      loadQuotations();
    } catch {
      setSyncError("Error de conexión");
    } finally {
      setSyncing(false);
    }
  }

  const CLOSED_STATES = ["aceptada", "rechazada", "facturada"];

  function startEdit(q: Quotation, field: EditingCell["field"]) {
    if (field !== "motivoRechazo" && CLOSED_STATES.includes(q.state)) return;
    if (field === "motivoRechazo" && q.state !== "rechazada") return;
    setEditing({ id: q.id, field });
    if (field === "successPercent") setEditValue(String(q.successPercent));
    else if (field === "followUpFreq") setEditValue(q.followUpFreq ?? "");
    else setEditValue(q.motivoRechazo ?? "");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function saveEdit(q: Quotation) {
    if (!editing) return;
    const body: Record<string, unknown> =
      editing.field === "successPercent"
        ? { successPercent: Math.min(100, Math.max(0, Number(editValue) || 0)) }
        : editing.field === "followUpFreq"
        ? { followUpFreq: editValue || null }
        : { motivoRechazo: editValue || null };

    setEditing(null);
    const res = await fetch(`/api/quotations/${q.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setQuotations((prev) => prev.map((x) => (x.id === q.id ? { ...x, ...updated } : x)));
    }
  }

  return (
    <div className="cotizaciones-page">
      <div className="cotizaciones-toolbar">
        <h2>Cotizaciones</h2>
        <div className="cotizaciones-toolbar-actions">
        </div>
      </div>

      <div className="cotizaciones-tabs">
        {[
          { value: "", label: "Todas" },
          { value: "borrador", label: "Borrador" },
          { value: "enviada", label: "Enviada" },
          { value: "aceptada", label: "Aprobada" },
          { value: "rechazada", label: "Rechazada" },
          { value: "facturada", label: "Facturada" },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`cotizaciones-tab${filter === tab.value ? " tab-active" : ""}${tab.value ? ` tab-${tab.value}` : ""}`}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && <p className="muted">Cargando cotizaciones…</p>}
      {!loading && quotations.length === 0 && (
        <p className="muted">No hay cotizaciones.</p>
      )}

      {!loading && quotations.length > 0 && (
        <div className="cotizaciones-table-wrap">
          <table className="cotizaciones-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Fecha emisión</th>
                <th>Número</th>
                <th>Importe neto</th>
                <th>Estado</th>
                <th>Motivo rechazo</th>
                <th>Vendedor</th>
                <th>Cliente</th>
                <th>% Cierre</th>
                <th>Frecuencia seguimiento</th>
                <th>Próximo seguimiento</th>
                <th>Contacto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...quotations].sort((a, b) => (STATE_ORDER[a.state] ?? 99) - (STATE_ORDER[b.state] ?? 99)).map((q) => (
                <tr key={q.id} className={`cotizacion-row row-state-${q.state}`}>
                  <td data-label="ID" className="col-id">#{q.externalId}</td>
                  <td data-label="Fecha emisión" className="col-hide-mobile">{q.fechaEmision ? new Date(q.fechaEmision).toLocaleDateString("es-AR") : "—"}</td>
                  <td data-label="Número" className="col-hide-mobile">{q.numero ?? "—"}</td>
                  <td data-label="Importe neto" className="col-importe">{q.importeTotalNeto ?? "—"}</td>
                  <td data-label="Estado">
                    <span className={`cotizacion-state state-${q.state}`}>
                      {q.state === "aceptada" ? "Aprobada" : q.state.charAt(0).toUpperCase() + q.state.slice(1)}
                    </span>
                  </td>
                  <td data-label="Motivo rechazo" className={q.state === "rechazada" ? "col-editable" : ""} onClick={() => q.state === "rechazada" ? startEdit(q, "motivoRechazo") : undefined}>
                    {q.state === "rechazada" ? (
                      editing?.id === q.id && editing.field === "motivoRechazo" ? (
                        <select
                          ref={inputRef as React.RefObject<HTMLSelectElement>}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(q)}
                          onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }}
                          className="inline-select"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="">Sin motivo</option>
                          <option value="PRECIO">Precio</option>
                          <option value="PLAZO_EXCESIVO">Plazo excesivo</option>
                          <option value="BAJA">Baja</option>
                          <option value="COMPETENCIA">Competencia</option>
                        </select>
                      ) : (
                        <span className={`motivo-rechazo-tag${q.motivoRechazo ? "" : " motivo-vacio"}`}>
                          {q.motivoRechazo ? MOTIVO_LABELS[q.motivoRechazo] ?? q.motivoRechazo : "Sin motivo"}
                        </span>
                      )
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td data-label="Vendedor" className="col-hide-mobile">
                    <div className="vendor-cell">
                      <span>{q.vendedor?.email ?? q.idVendedor ?? "—"}</span>
                      {q.vendedor?.phone && (
                        <a
                          href={`https://wa.me/${q.vendedor.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-contact-icon btn-whatsapp-icon"
                          title={`WhatsApp: ${q.vendedor.phone}`}
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.858L.057 23.077a.75.75 0 0 0 .916.964l5.453-1.43A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.723 9.723 0 0 1-4.964-1.355l-.356-.211-3.685.967.984-3.595-.232-.371A9.722 9.722 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
                        </a>
                      )}
                    </div>
                  </td>
                  <td data-label="Cliente">{q.client.name}</td>
                  <td data-label="% Cierre" className={`col-center col-editable${CLOSED_STATES.includes(q.state) ? " col-locked" : ""}`} onClick={() => startEdit(q, "successPercent")}>
                    {editing?.id === q.id && editing.field === "successPercent" ? (
                      <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="number"
                        min={0}
                        max={100}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(q)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(q); if (e.key === "Escape") setEditing(null); }}
                        className="inline-input"
                      />
                    ) : (
                      <span className="editable-value">{q.successPercent}%</span>
                    )}
                  </td>
                  <td data-label="Frecuencia" className={`col-editable${CLOSED_STATES.includes(q.state) ? " col-locked" : ""}`} onClick={() => startEdit(q, "followUpFreq")}>
                    {editing?.id === q.id && editing.field === "followUpFreq" ? (
                      <select
                        ref={inputRef as React.RefObject<HTMLSelectElement>}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(q)}
                        onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }}
                        className="inline-select"
                      >
                        <option value="">Sin frecuencia</option>
                        <option value="DAYS_3">Cada 3 días</option>
                        <option value="DAYS_7">Cada 7 días</option>
                        <option value="DAYS_15">Cada 15 días</option>
                        <option value="DAYS_30">Cada 30 días</option>
                      </select>
                    ) : (
                      <span className="editable-value">{q.followUpFreq ? (FREQ_LABELS[q.followUpFreq] ?? q.followUpFreq) : "—"}</span>
                    )}
                  </td>
                  <td data-label="Próximo seguimiento">{q.nextFollowUpAt ? new Date(q.nextFollowUpAt).toLocaleDateString("es-AR") : "—"}</td>
                  <td data-label="Contacto" className="col-contact">
                    {q.client.phone && (
                      <a
                        href={`https://wa.me/${q.client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${q.client.name}, te escribo por la cotización #${q.externalId} por $${q.importeTotalNeto ?? ""}. `)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-contact-icon btn-whatsapp-icon"
                        title={`WhatsApp: ${q.client.phone}`}
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.858L.057 23.077a.75.75 0 0 0 .916.964l5.453-1.43A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.723 9.723 0 0 1-4.964-1.355l-.356-.211-3.685.967.984-3.595-.232-.371A9.722 9.722 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
                      </a>
                    )}
                    {q.client.email && (
                      <a
                        href={`mailto:${q.client.email}?subject=${encodeURIComponent(`Seguimiento cotización #${q.externalId}`)}&body=${encodeURIComponent(`Estimado/a ${q.client.name},\n\nMe comunico en relación a la cotización #${q.externalId} por $${q.importeTotalNeto ?? ""}.\n\nQuedo a disposición ante cualquier consulta.\n\nSaludos,`)}`}
                        className={`btn-contact-icon btn-email-icon${copiedId === q.externalId ? " btn-copied" : ""}`}
                        title={copiedId === q.externalId ? "Email copiado ✓" : `Email: ${q.client.email}`}
                        onClick={() => handleEmailCopy(q.client.email!, q.externalId)}
                      >
                        {copiedId === q.externalId
                          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
                          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                        }
                      </a>
                    )}
                    {!q.client.phone && !q.client.email && <span className="muted">—</span>}
                  </td>
                  <td data-label="">
                    <Link href={`/dashboard/cotizaciones/${q.id}`} className="cotizacion-link">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
