"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function getAuthHeader() {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("crm_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

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
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  assignedTo: { id: string; name: string; email: string } | null;
};

const STATE_LABELS: Record<string, string> = {
  abierta: "Abierta",
  ganada: "Ganada",
  perdida: "Perdida",
  borrador: "Borrador",
  enviada: "Enviada",
};

const FREQ_LABELS: Record<string, string> = {
  DAYS_3: "Cada 3 días",
  DAYS_7: "Cada 7 días",
  DAYS_15: "Cada 15 días",
  DAYS_30: "Cada 30 días",
};

export default function CotizacionesPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; mock?: boolean } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    const u = localStorage.getItem("crm_user");
    if (u) setUser(JSON.parse(u));
  }, []);

  function loadQuotations() {
    setLoading(true);
    const params = filter ? `?state=${encodeURIComponent(filter)}` : "";
    fetch(`/api/quotations${params}`, { headers: getAuthHeader() })
      .then((res) => (res.ok ? res.json() : { quotations: [] }))
      .then((data) => {
        setQuotations(data.quotations ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadQuotations();
  }, [filter]);

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
      if (!res.ok) {
        setSyncError(result.error ?? "Error al sincronizar");
        return;
      }
      setSyncResult({ created: result.created, updated: result.updated, mock: result.mock });
      loadQuotations();
    } catch {
      setSyncError("Error de conexión");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="cotizaciones-page">
      <div className="cotizaciones-toolbar">
        <h2>Cotizaciones</h2>
        <div className="cotizaciones-toolbar-actions">
          {user?.role === "ADMIN" && (
            <div className="cotizaciones-sync">
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="btn-sync"
              >
                {syncing ? "Cargando…" : "Cargar cotizaciones"}
              </button>
              {syncResult && (
                <span className="sync-ok">
                  {syncResult.created} creadas, {syncResult.updated} actualizadas
                  {syncResult.mock && " (datos de prueba)"}
                </span>
              )}
              {syncError && <span className="sync-err">{syncError}</span>}
            </div>
          )}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="cotizaciones-filter"
            aria-label="Filtrar por estado"
          >
            <option value="">Todas</option>
            <option value="abierta">Abiertas</option>
            <option value="ganada">Ganadas</option>
            <option value="perdida">Perdidas</option>
            <option value="borrador">Borrador</option>
            <option value="enviada">Enviada</option>
          </select>
        </div>
      </div>

      {loading && <p className="muted">Cargando cotizaciones…</p>}
      {!loading && quotations.length === 0 && (
        <p className="muted">
          {user?.role === "ADMIN"
            ? "No hay cotizaciones. Usá «Cargar cotizaciones» para sincronizar o cargar datos de prueba."
            : "No hay cotizaciones."}
        </p>
      )}

      {!loading && quotations.length > 0 && (
        <div className="cotizaciones-list">
          {quotations.map((q) => (
            <div key={q.id} className="cotizacion-card">
              <div className="cotizacion-header">
                <span className="cotizacion-id">#{q.externalId}</span>
                {q.nextFollowUpAt ? (
                  <span className="cotizacion-next-follow-up">
                    Próximo seguimiento: {new Date(q.nextFollowUpAt).toLocaleDateString("es-AR")}
                  </span>
                ) : (
                  <span className="cotizacion-sin-seguimiento" title="Sin seguimiento configurado">
                    <svg className="cotizacion-warning-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Sin seguimiento
                  </span>
                )}
                <span className={`cotizacion-state state-${q.state}`}>
                  {STATE_LABELS[q.state] ?? q.state}
                </span>
              </div>
              <dl className="cotizacion-info">
                <dt>Fecha emisión</dt>
                <dd>{q.fechaEmision ? new Date(q.fechaEmision).toLocaleDateString("es-AR") : "—"}</dd>
                <dt>Número</dt>
                <dd>{q.numero ?? "—"}</dd>
                <dt>Importe neto</dt>
                <dd>{q.importeTotalNeto ?? "—"}</dd>
                <dt>Observaciones</dt>
                <dd>{q.observaciones && q.observaciones !== "" ? q.observaciones : "—"}</dd>
                <dt>IDVendedor</dt>
                <dd>{q.idVendedor && q.idVendedor !== "" ? q.idVendedor : "—"}</dd>
                <dt>Cliente</dt>
                <dd>
                  <strong>{q.client.name}</strong>
                  {q.client.email && <><br />Email: {q.client.email}</>}
                  {q.client.phone && <><br />Tel: {q.client.phone}</>}
                  {q.client.address && <><br />Dirección: {q.client.address}</>}
                </dd>
                <dt>Posibilidad de cierre</dt>
                <dd>{q.successPercent}%</dd>
                {q.followUpFreq && (
                  <>
                    <dt>Frecuencia seguimiento</dt>
                    <dd>{FREQ_LABELS[q.followUpFreq] ?? q.followUpFreq}</dd>
                  </>
                )}
                {q.nextFollowUpAt && (
                  <>
                    <dt>Próximo seguimiento</dt>
                    <dd>{new Date(q.nextFollowUpAt).toLocaleDateString("es-AR")}</dd>
                  </>
                )}
                {q.assignedTo && (
                  <>
                    <dt>Asignado a</dt>
                    <dd>{q.assignedTo.name} · {q.assignedTo.email}</dd>
                  </>
                )}
                <dt>Última sincronización</dt>
                <dd>{new Date(q.lastSyncedAt).toLocaleString("es-AR")}</dd>
                <dt>Creada en CRM</dt>
                <dd>{new Date(q.createdAt).toLocaleString("es-AR")}</dd>
              </dl>
              <Link href={`/dashboard/cotizaciones/${q.id}`} className="cotizacion-link">
                Ver detalle completo
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
