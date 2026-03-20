"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("crm_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
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

const STATE_LABELS: Record<string, string> = {
  borrador: "Borrador",
  pendiente: "Pendiente",
  enviada: "Enviada",
  aceptada: "Aprobada",
  rechazada: "Rechazada",
};

const STATE_ORDER = ["borrador", "pendiente", "enviada", "aceptada", "rechazada"];

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

function getMondayOfCurrentWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() + diff);
  return monday;
}

export default function PanelControlPage() {
  const [byState, setByState] = useState<StateWidget[]>([]);
  const [weekFollowUps, setWeekFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard", { headers: getAuthHeader() })
      .then((r) => (r.ok ? r.json() : { byState: [], weekFollowUps: [] }))
      .then((d) => {
        setByState(d.byState ?? []);
        setWeekFollowUps(d.weekFollowUps ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const monday = getMondayOfCurrentWeek();

  // Cada slot es un día hábil: semana 1 = offset 0-4, semana 2 = offset 7-11
  function weekdayOffset(slot: number): number {
    return Math.floor(slot / 5) * 7 + (slot % 5);
  }

  // Agrupar follow-ups por día hábil (0=lun … 9=vie semana 2)
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

  return (
    <div className="dashboard-cards">
      {loading && <p className="muted">Cargando métricas…</p>}
      {!loading && (
        <>
          {/* Widgets por estado */}
          <div className="estado-widgets">
            {[...byState].sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state)).map((w) => (
              <div key={w.state} className={`estado-widget estado-widget-${w.state}`}>
                <span className={`estado-widget-label cotizacion-state state-${w.state}`}>
                  {STATE_LABELS[w.state] ?? w.state}
                </span>
                <span className="estado-widget-count">{w.count}</span>
                <span className="estado-widget-count-label">
                  cotización{w.count !== 1 ? "es" : ""}
                </span>
                <span className="estado-widget-total">$ {w.totalNeto}</span>
                <span className="estado-widget-total-label">importe neto total</span>
              </div>
            ))}
          </div>

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
