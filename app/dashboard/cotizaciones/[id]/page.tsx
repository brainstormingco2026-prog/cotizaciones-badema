"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

function getAuthHeader() {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("crm_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type QuotationDetail = {
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
  client: { name: string; email: string | null; phone: string | null; address: string | null };
  assignedTo: { name: string; email: string } | null;
};

const STATE_LABELS: Record<string, string> = {
  abierta: "Abierta", ganada: "Ganada", perdida: "Perdida", borrador: "Borrador", enviada: "Enviada",
};
const FREQ_OPTIONS = [{ value: "DAYS_3", label: "Cada 3 días" }, { value: "DAYS_7", label: "Cada 7 días" }, { value: "DAYS_15", label: "Cada 15 días" }, { value: "DAYS_30", label: "Cada 30 días" }];

export default function CotizacionDetallePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [q, setQ] = useState<QuotationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successPercent, setSuccessPercent] = useState(50);
  const [followUpFreq, setFollowUpFreq] = useState<string | "">("");

  useEffect(() => {
    fetch(`/api/quotations/${id}`, { headers: getAuthHeader() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setQ(data);
          setSuccessPercent(data.successPercent ?? 50);
          setFollowUpFreq(data.followUpFreq ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!q) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          successPercent,
          followUpFreq: followUpFreq || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setQ(updated);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Cargando…</p>;
  if (!q) return <p className="muted">Cotización no encontrada.</p>;

  return (
    <div className="cotizacion-detail">
      <Link href="/dashboard/cotizaciones" className="back-link">← Volver a Cotizaciones</Link>
      <div className="card">
        <div className="cotizacion-detail-header">
          <h2>Cotización #{q.externalId}</h2>
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
          <span className={`cotizacion-state state-${q.state}`}>{STATE_LABELS[q.state] ?? q.state}</span>
        </div>
        <div className="cotizacion-detail-section">
          <h3>Datos del comprobante (Contabilium)</h3>
          <dl className="info-list">
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
          </dl>
        </div>
        <div className="cotizacion-detail-section">
          <h3>Cliente</h3>
          <p><strong>{q.client.name}</strong></p>
          {q.client.phone && <p>Tel: {q.client.phone}</p>}
          {q.client.email && <p>Email: {q.client.email}</p>}
          {q.client.address && <p>Dirección: {q.client.address}</p>}
        </div>
        {q.assignedTo && (
          <div className="cotizacion-detail-section">
            <h3>Asignado a</h3>
            <p>{q.assignedTo.name} · {q.assignedTo.email}</p>
          </div>
        )}
        <div className="cotizacion-detail-section">
          <h3>Información del CRM</h3>
          <dl className="info-list">
            <dt>Última sincronización</dt>
            <dd>{new Date(q.lastSyncedAt).toLocaleString("es-AR")}</dd>
            <dt>Creada en CRM</dt>
            <dd>{new Date(q.createdAt).toLocaleString("es-AR")}</dd>
            <dt>Última actualización</dt>
            <dd>{new Date(q.updatedAt).toLocaleString("es-AR")}</dd>
          </dl>
        </div>
        <div className="cotizacion-detail-section">
          <h3>Seguimiento</h3>
          <label>
            Posibilidad de cierre (%)
            <input
              type="number"
              min={0}
              max={100}
              value={successPercent}
              onChange={(e) => setSuccessPercent(Number(e.target.value))}
              className="input-percent"
            />
          </label>
          <label>
            Frecuencia de seguimiento
            <select
              value={followUpFreq}
              onChange={(e) => setFollowUpFreq(e.target.value)}
              className="input-freq"
            >
              <option value="">Sin frecuencia</option>
              {FREQ_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          {q.nextFollowUpAt && (
            <p>Próximo seguimiento: {new Date(q.nextFollowUpAt).toLocaleDateString("es-AR")}</p>
          )}
          <button type="button" onClick={handleSave} disabled={saving} className="btn-save">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
