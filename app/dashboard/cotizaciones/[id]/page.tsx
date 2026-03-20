"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

function getAuthHeader(): Record<string, string> {
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
  const [copiedEmail, setCopiedEmail] = useState(false);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function handleEmailCopy(email: string) {
    navigator.clipboard.writeText(email).catch(() => {});
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
    setCopiedEmail(true);
    copyTimeout.current = setTimeout(() => setCopiedEmail(false), 2500);
  }

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
          {q.client.address && <p className="client-address">{q.client.address}</p>}
          <div className="client-contact-row">
            {q.client.phone && (
              <>
                <span className="client-contact-value">{q.client.phone}</span>
                <a
                  href={`https://wa.me/${q.client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${q.client.name}, te escribo por la cotización #${q.externalId} por $${q.importeTotalNeto ?? ""}. `)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-contact btn-whatsapp"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="contact-icon" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.858L.057 23.077a.75.75 0 0 0 .916.964l5.453-1.43A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.723 9.723 0 0 1-4.964-1.355l-.356-.211-3.685.967.984-3.595-.232-.371A9.722 9.722 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
                  WhatsApp
                </a>
              </>
            )}
            {q.client.email && (
              <>
                <span className="client-contact-value">{q.client.email}</span>
                <a
                  href={`mailto:${q.client.email}?subject=${encodeURIComponent(`Seguimiento cotización #${q.externalId}`)}&body=${encodeURIComponent(`Estimado/a ${q.client.name},\n\nMe comunico en relación a la cotización #${q.externalId} por $${q.importeTotalNeto ?? ""}.\n\nQuedo a disposición ante cualquier consulta.\n\nSaludos,`)}`}
                  className="btn-contact btn-email"
                  onClick={() => handleEmailCopy(q.client.email!)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="contact-icon" aria-hidden><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  {copiedEmail ? "Email copiado ✓" : "Email"}
                </a>
              </>
            )}
            {!q.client.phone && !q.client.email && (
              <span className="muted">Sin datos de contacto</span>
            )}
          </div>
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
