"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("crm_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function getUser(): { role: string } | null {
  if (typeof window === "undefined") return null;
  const u = localStorage.getItem("crm_user");
  return u ? JSON.parse(u) : null;
}

type StateWidget = { state: string; count: number; totalNeto: string };

type FollowUp = {
  id: string;
  externalId: string;
  nextFollowUpAt: string;
  state: string;
  importeTotalNeto: string | null;
  client: { name: string };
  assignedTo: { name: string } | null;
};

type GoalProgress = {
  userId: string;
  name: string;
  monthlyTarget: number | null;
  current: number;
  currentFormatted: string;
  targetFormatted: string | null;
  percent: number | null;
  onTrack: boolean | null;
};

type VendorQuotation = {
  id: string;
  externalId: string;
  state: string;
  importeTotalNeto: string | null;
  client: { name: string };
};


const STATE_LABELS: Record<string, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aceptada: "Aprobada",
  rechazada: "Rechazada",
  facturada: "Facturada",
};

const STATE_ORDER = ["borrador", "enviada", "aceptada", "rechazada", "facturada"];

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

const MES_LABELS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function getMondayOfCurrentWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() + diff);
  return monday;
}


const STATE_LABELS_MODAL: Record<string, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aceptada: "Aprobada",
  rechazada: "Rechazada",
  facturada: "Facturada",
};

type DatePreset = "" | "today" | "week" | "month" | "quarter" | "custom";

function presetToRange(preset: DatePreset, customFrom: string, customTo: string): { from: string; to: string } | null {
  if (!preset) return null;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (preset === "today") {
    const t = fmt(now);
    return { from: t, to: t };
  }
  if (preset === "week") {
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(now); mon.setDate(now.getDate() + diff);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: fmt(mon), to: fmt(sun) };
  }
  if (preset === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: fmt(first), to: fmt(last) };
  }
  if (preset === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    const first = new Date(now.getFullYear(), q * 3, 1);
    const last = new Date(now.getFullYear(), q * 3 + 3, 0);
    return { from: fmt(first), to: fmt(last) };
  }
  if (preset === "custom") {
    if (!customFrom && !customTo) return null;
    return { from: customFrom, to: customTo };
  }
  return null;
}

export default function PanelControlPage() {
  const router = useRouter();
  const [byState, setByState] = useState<StateWidget[]>([]);
  const [weekFollowUps, setWeekFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [goalProgress, setGoalProgress] = useState<GoalProgress[]>([]);
  const [goalMonth, setGoalMonth] = useState(0);
  const [goalYear, setGoalYear] = useState(new Date().getFullYear());
  const [isAdmin, setIsAdmin] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [vendorModal, setVendorModal] = useState<{ userId: string; name: string } | null>(null);
  const [vendorQuotations, setVendorQuotations] = useState<VendorQuotation[]>([]);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST", headers: getAuthHeader() });
      const data = await res.json();
      if (!res.ok) {
        setSyncResult(`Error: ${data.error}`);
      } else {
        const q = data.quotations;
        const v = data.vendors;
        const parts = [`Cotizaciones: ${q.created} nuevas, ${q.updated} actualizadas`];
        if (v?.created > 0 || v?.updated > 0) {
          const vParts = [];
          if (v.created > 0) vParts.push(`${v.created} creados`);
          if (v.updated > 0) vParts.push(`${v.updated} actualizados`);
          parts.push(`Vendedores: ${vParts.join(", ")}`);
        }
        if (q.errors?.length) parts.push(`⚠ ${q.errors[0]}`);
        if (q.mock) parts.push("(datos simulados)");
        setSyncResult(parts.join(" · "));
        // Recargar datos del dashboard
        loadDashboard(datePreset, customFrom, customTo);
        loadGoals();
      }
    } catch {
      setSyncResult("Error de red al sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  function loadGoals() {
    fetch("/api/goals", { headers: getAuthHeader() })
      .then((r) => (r.ok ? r.json() : { progress: [] }))
      .then((d) => {
        setGoalProgress(d.progress ?? []);
        setGoalMonth(d.month ?? 0);
        setGoalYear(d.year ?? new Date().getFullYear());
      });
  }

  function openVendorModal(userId: string, name: string) {
    setVendorModal({ userId, name });
    setVendorQuotations([]);
    setVendorLoading(true);
    fetch(`/api/quotations?userId=${encodeURIComponent(userId)}`, { headers: getAuthHeader() })
      .then((r) => (r.ok ? r.json() : { quotations: [] }))
      .then((d) => setVendorQuotations(d.quotations ?? []))
      .finally(() => setVendorLoading(false));
  }

  function loadDashboard(preset: DatePreset, cFrom: string, cTo: string) {
    setLoading(true);
    const range = presetToRange(preset, cFrom, cTo);
    const params = new URLSearchParams();
    if (range?.from) params.set("from", range.from);
    if (range?.to) params.set("to", range.to);
    const qs = params.toString() ? `?${params.toString()}` : "";
    fetch(`/api/dashboard${qs}`, { headers: getAuthHeader() })
      .then((r) => (r.ok ? r.json() : { byState: [], weekFollowUps: [] }))
      .then((d) => {
        setByState(d.byState ?? []);
        setWeekFollowUps(d.weekFollowUps ?? []);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const user = getUser();
    const admin = user?.role === "ADMIN";
    setIsAdmin(admin);
    loadDashboard("", "", "");
    loadGoals();
  }, []);

  const monday = getMondayOfCurrentWeek();

  function weekdayOffset(slot: number): number {
    return Math.floor(slot / 5) * 7 + (slot % 5);
  }

  const byDay: FollowUp[][] = Array.from({ length: 10 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + weekdayOffset(i));
    return weekFollowUps.filter((f) => {
      const d = new Date(f.nextFollowUpAt);
      return (
        d.getFullYear() === day.getFullYear() &&
        d.getMonth() === day.getMonth() &&
        d.getDate() === day.getDate()
      );
    });
  });

  const today = new Date();

  const vendorStateCounts = STATE_ORDER.reduce((acc, state) => {
    acc[state] = vendorQuotations.filter((q) => q.state === state).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="dashboard-cards">
      {/* Modal resumen vendedor */}
      {vendorModal && (
        <div className="vendor-modal-overlay" onClick={() => setVendorModal(null)}>
          <div className="vendor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="vendor-modal-header">
              <h3>{vendorModal.name}</h3>
              <button type="button" className="vendor-modal-close" onClick={() => setVendorModal(null)}>✕</button>
            </div>
            {vendorLoading ? (
              <p className="muted vendor-modal-loading">Cargando…</p>
            ) : (
              <div className="vendor-modal-body">
                <div className="vendor-modal-states">
                  {STATE_ORDER.map((state) => (
                    <button
                      key={state}
                      type="button"
                      className="vendor-modal-state-chip"
                      onClick={() => { setVendorModal(null); router.push(`/dashboard/cotizaciones?estado=${state}`); }}
                    >
                      <span className={`cotizacion-state state-${state}`}>{STATE_LABELS_MODAL[state]}</span>
                      <span className="vendor-modal-state-count">{vendorStateCounts[state] ?? 0}</span>
                    </button>
                  ))}
                </div>
                {vendorQuotations.length === 0 ? (
                  <p className="muted">Sin cotizaciones.</p>
                ) : (
                  <ul className="vendor-modal-list">
                    {vendorQuotations.slice(0, 10).map((q) => (
                      <li key={q.id}>
                        <Link href={`/dashboard/cotizaciones/${q.id}`} onClick={() => setVendorModal(null)} className="vendor-modal-item">
                          <span className={`cotizacion-state state-${q.state}`}>{STATE_LABELS_MODAL[q.state] ?? q.state}</span>
                          <span className="vendor-modal-item-client">{q.client.name}</span>
                          {q.importeTotalNeto && <span className="vendor-modal-item-amount">${q.importeTotalNeto}</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="sync-bar">
          <span className="sync-result">↻ Sincronización automática cada 30 minutos</span>
        </div>
      )}

      {loading && <p className="muted">Cargando métricas…</p>}
      {/* Filtro de fecha */}
      <div className="date-filter-bar">
        <div className="date-filter-presets">
          {([
            { key: "" as DatePreset, label: "Todo" },
            { key: "today" as DatePreset, label: "Hoy" },
            { key: "week" as DatePreset, label: "Esta semana" },
            { key: "month" as DatePreset, label: "Este mes" },
            { key: "quarter" as DatePreset, label: "Este trimestre" },
            { key: "custom" as DatePreset, label: "Personalizado" },
          ] as { key: DatePreset; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`date-filter-btn${datePreset === key ? " date-filter-btn-active" : ""}`}
              onClick={() => {
                setDatePreset(key);
                if (key !== "custom") loadDashboard(key, customFrom, customTo);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {datePreset === "custom" && (
          <div className="date-filter-custom">
            <input
              type="date"
              className="date-filter-input"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span className="date-filter-sep">—</span>
            <input
              type="date"
              className="date-filter-input"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
            <button
              type="button"
              className="date-filter-apply"
              onClick={() => loadDashboard("custom", customFrom, customTo)}
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      {!loading && (
        <>
          {/* Widgets por estado */}
          <div className="estado-widgets">
            {[...byState].sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state)).map((w) => (
              <Link key={w.state} href={`/dashboard/cotizaciones?estado=${w.state}`} className={`estado-widget estado-widget-${w.state}`}>
                <span className={`estado-widget-label cotizacion-state state-${w.state}`}>
                  {STATE_LABELS[w.state] ?? w.state}
                </span>
                <span className="estado-widget-count">{w.count}</span>
                <span className="estado-widget-count-label">
                  cotización{w.count !== 1 ? "es" : ""}
                </span>
                <span className="estado-widget-total">$ {w.totalNeto}</span>
                <span className="estado-widget-total-label">importe neto total</span>
              </Link>
            ))}
          </div>

          {/* Objetivos mensuales */}
          {(goalProgress.length > 0 || isAdmin) && (
            <div className="objetivos-section">
              <div className="objetivos-header">
                <h3 className="objetivos-titulo">
                  Objetivo mensual — {goalMonth > 0 ? MES_LABELS[goalMonth - 1] : ""} {goalYear}
                </h3>
              </div>
              <div className="objetivos-grid">
                {goalProgress.map((g) => (
                  <button
                    key={g.userId}
                    type="button"
                    className={`objetivo-card objetivo-card-btn ${
                      g.onTrack === null ? "objetivo-sin-meta" :
                      g.onTrack ? "objetivo-verde" : "objetivo-rojo"
                    }`}
                    onClick={() => openVendorModal(g.userId, g.name)}
                  >
                    <div className="objetivo-nombre">{g.name}</div>
                    {g.percent !== null ? (
                      <>
                        <div className="objetivo-pct">{g.percent}%</div>
                        <div className="objetivo-montos">
                          ${g.currentFormatted} / ${g.targetFormatted}
                        </div>
                        <div className="objetivo-barra-bg">
                          <div
                            className="objetivo-barra-fill"
                            style={{ width: `${Math.min(g.percent, 100)}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="objetivo-sin-objetivo">Sin objetivo configurado</div>
                    )}
                  </button>
                ))}
                {goalProgress.length === 0 && isAdmin && (
                  <p className="objetivo-empty">Sin objetivos configurados para este año.</p>
                )}
              </div>
            </div>
          )}

          {/* Calendario semanal */}
          <div className="semana-calendario">
            <h3 className="semana-titulo">Seguimientos — próximas 2 semanas</h3>
            <div className="semana-grid">
              {DAYS.map((dayName, i) => {
                const dayDate = new Date(monday);
                dayDate.setDate(monday.getDate() + weekdayOffset(i));
                const isToday =
                  dayDate.getDate() === today.getDate() &&
                  dayDate.getMonth() === today.getMonth() &&
                  dayDate.getFullYear() === today.getFullYear();
                const items = byDay[i];
                return (
                  <div key={i} className={`semana-dia${isToday ? " semana-dia-hoy" : ""}`}>
                    <div className="semana-dia-header">
                      <span className="semana-dia-nombre">{dayName}</span>
                      <span className="semana-dia-fecha">
                        {dayDate.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <div className="semana-dia-items">
                      {items.length === 0 ? (
                        <span className="semana-vacio">—</span>
                      ) : (
                        items.map((f) => (
                          <Link key={f.id} href={`/dashboard/cotizaciones/${f.id}`} className="semana-item">
                            <span className={`semana-item-state state-dot-${f.state}`} />
                            <span className="semana-item-cliente">{f.client.name}</span>
                            {f.importeTotalNeto && (
                              <span className="semana-item-importe">${f.importeTotalNeto}</span>
                            )}
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
