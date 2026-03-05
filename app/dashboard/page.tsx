"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function getAuthHeader() {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("crm_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type DashboardVendor = {
  vendorId: string;
  vendorName: string;
  abiertas: number;
  ganadas: number;
  perdidas: number;
  porCierre: Array<{
    id: string;
    externalId: string;
    successPercent: number;
    nextFollowUpAt: string | null;
    client: { name: string };
  }>;
};

export default function PanelControlPage() {
  const [data, setData] = useState<{ byVendor: DashboardVendor[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ role: string; id: string } | null>(null);
  const [vendorFilter, setVendorFilter] = useState<string>(""); // "" = Todos, o vendorId

  useEffect(() => {
    const u = localStorage.getItem("crm_user");
    if (u) setUser(JSON.parse(u));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard", { headers: getAuthHeader() });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const byVendor = data?.byVendor ?? [];
  const selectedVendors = vendorFilter
    ? byVendor.filter((v) => v.vendorId === vendorFilter)
    : byVendor;

  const totals = {
    abiertas: selectedVendors.reduce((s, v) => s + v.abiertas, 0),
    ganadas: selectedVendors.reduce((s, v) => s + v.ganadas, 0),
    perdidas: selectedVendors.reduce((s, v) => s + v.perdidas, 0),
  };

  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="dashboard-cards">
      {loading && !data && <p className="muted">Cargando métricas…</p>}

      {data && (
        <>
          {isAdmin && byVendor.length > 1 && (
            <div className="card card-filter">
              <label>
                Filtrar por vendedor
                <select
                  value={vendorFilter}
                  onChange={(e) => setVendorFilter(e.target.value)}
                  className="vendor-select"
                  aria-label="Vendedor"
                >
                  <option value="">Todos</option>
                  {byVendor.map((v) => (
                    <option key={v.vendorId} value={v.vendorId}>
                      {v.vendorName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="card card-widgets">
            <h2>{vendorFilter ? selectedVendors[0]?.vendorName ?? "Vendedor" : "Totales"}</h2>
            <div className="metrics-grid">
              <div className="metric">
                <span className="metric-value">{totals.abiertas}</span>
                <span className="metric-label">Cotizaciones abiertas</span>
                <span className="metric-cantidad">{totals.abiertas} cotización{totals.abiertas !== 1 ? "es" : ""}</span>
              </div>
              <div className="metric">
                <span className="metric-value metric-ganadas">{totals.ganadas}</span>
                <span className="metric-label">Cotizaciones ganadas</span>
                <span className="metric-cantidad">{totals.ganadas} cotización{totals.ganadas !== 1 ? "es" : ""}</span>
              </div>
              <div className="metric">
                <span className="metric-value metric-perdidas">{totals.perdidas}</span>
                <span className="metric-label">Cotizaciones perdidas</span>
                <span className="metric-cantidad">{totals.perdidas} cotización{totals.perdidas !== 1 ? "es" : ""}</span>
              </div>
            </div>
          </div>

          {selectedVendors.flatMap((v) =>
            (v.porCierre ?? []).length > 0
              ? [
                  <div key={v.vendorId} className="card card-metrics">
                    <h2>Posibilidad de cierre{vendorFilter ? "" : ` · ${v.vendorName}`}</h2>
                    <ul className="por-cierre-list">
                      {v.porCierre.map((q) => (
                        <li key={q.id}>
                          <Link href={`/dashboard/cotizaciones/${q.id}`} className="q-client">
                            {q.client.name}
                          </Link>
                          <span className="q-percent">{q.successPercent}%</span>
                          {q.nextFollowUpAt && (
                            <span className="q-date">
                              Seguimiento: {new Date(q.nextFollowUpAt).toLocaleDateString("es-AR")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>,
                ]
              : []
          )}
        </>
      )}
    </div>
  );
}
