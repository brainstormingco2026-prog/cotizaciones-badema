"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("crm_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type VendorRow = {
  id: string;
  name: string;
  email: string;
  contabiliumId: string | null;
  target: string;
  saving: boolean;
  saved: boolean;
  error: string;
};

const CURRENT_YEAR = new Date().getFullYear();

export default function VendedoresAdminPage() {
  const router = useRouter();
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [unlinkedIds, setUnlinkedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario nuevo vendedor
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contabiliumId, setContabiliumId] = useState("");
  const [newTarget, setNewTarget] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/users", { headers: getAuthHeader() }).then((r) => {
        if (r.status === 403) { router.replace("/dashboard"); return null; }
        return r.ok ? r.json() : null;
      }),
      fetch("/api/goals", { headers: getAuthHeader() }).then((r) => r.ok ? r.json() : { progress: [] }),
    ]).then(([usersData, goalsData]) => {
      if (!usersData) return;
      const goalMap = new Map<string, number | null>(
        (goalsData.progress ?? []).map((g: { userId: string; monthlyTarget: number | null }) => [g.userId, g.monthlyTarget])
      );
      setRows(
        (usersData.users ?? []).map((v: { id: string; name: string; email: string; contabiliumId: string | null }) => ({
          id: v.id,
          name: v.name,
          email: v.email,
          contabiliumId: v.contabiliumId,
          target: goalMap.has(v.id) && goalMap.get(v.id) != null ? String(goalMap.get(v.id)) : "",
          saving: false,
          saved: false,
          error: "",
        }))
      );
      setUnlinkedIds(usersData.unlinkedIds ?? []);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function updateRow(id: string, patch: Partial<VendorRow>) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }

  async function saveGoal(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const amount = parseFloat(row.target.replace(/\./g, "").replace(",", "."));
    if (isNaN(amount) || amount < 0) { updateRow(id, { error: "Monto inválido" }); return; }
    updateRow(id, { saving: true, error: "", saved: false });
    try {
      const res = await fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ userId: id, year: CURRENT_YEAR, monthlyTarget: amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        updateRow(id, { error: data.error ?? "Error al guardar" });
      } else {
        updateRow(id, { saved: true });
        setTimeout(() => updateRow(id, { saved: false }), 2000);
      }
    } finally {
      updateRow(id, { saving: false });
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ name, email, password, contabiliumId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al crear vendedor"); return; }

      const amount = parseFloat(newTarget.replace(/\./g, "").replace(",", "."));
      if (!isNaN(amount) && amount > 0) {
        await fetch("/api/goals", {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ userId: data.user.id, year: CURRENT_YEAR, monthlyTarget: amount }),
        });
      }

      setSuccess(`Vendedor "${data.user.name}" creado correctamente`);
      setName(""); setEmail(""); setPassword(""); setContabiliumId(""); setNewTarget("");
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-vendedores">
      <div className="admin-vendedores-header">
        <h2>Gestión de vendedores</h2>
        <button type="button" className="admin-back-btn" onClick={() => router.push("/dashboard")}>
          ← Volver al panel
        </button>
      </div>

      {/* Tabla unificada */}
      <section className="admin-section">
        <h3>Vendedores — {CURRENT_YEAR}</h3>
        <p className="admin-hint">El objetivo mensual es el monto en pesos que cada vendedor debe alcanzar por mes.</p>
        {loading ? (
          <p className="muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="muted">No hay vendedores registrados.</p>
        ) : (
          <table className="admin-table goals-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>ID Contabilium</th>
                <th>Objetivo mensual ($)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td data-label="Nombre">{row.name}</td>
                  <td data-label="Email">{row.email}</td>
                  <td data-label="ID Contabilium">{row.contabiliumId ?? <span className="muted">—</span>}</td>
                  <td data-label="Objetivo ($)">
                    <input
                      className="goal-input"
                      type="number"
                      min="0"
                      step="1000"
                      value={row.target}
                      placeholder="Sin objetivo"
                      onChange={(e) => updateRow(row.id, { target: e.target.value, error: "", saved: false })}
                      onKeyDown={(e) => e.key === "Enter" && saveGoal(row.id)}
                    />
                    {row.error && <span className="goal-inline-error">{row.error}</span>}
                  </td>
                  <td data-label="">
                    <button
                      type="button"
                      className={`goal-save-btn ${row.saved ? "goal-save-btn-ok" : ""}`}
                      onClick={() => saveGoal(row.id)}
                      disabled={row.saving}
                    >
                      {row.saving ? "…" : row.saved ? "Guardado" : "Guardar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* IDs sin usuario */}
      {unlinkedIds.length > 0 && (
        <section className="admin-section">
          <h3>IDs de Contabilium sin usuario CRM</h3>
          <p className="admin-hint">
            Estos IDs aparecen en cotizaciones pero no tienen un usuario asignado. Hacé click para autocompletar el formulario.
          </p>
          <div className="unlinked-ids">
            {unlinkedIds.map((id) => (
              <button key={id} type="button" className="unlinked-id-chip" onClick={() => setContabiliumId(id)}>
                {id}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Formulario nuevo vendedor */}
      <section className="admin-section">
        <h3>Agregar vendedor</h3>
        <form className="admin-form" onSubmit={handleCreate}>
          <div className="admin-form-row">
            <label>
              Nombre
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Pérez" required />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="juan@badema.com" required />
            </label>
          </div>
          <div className="admin-form-row">
            <label>
              Contraseña inicial
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="contraseña temporal" required />
            </label>
            <label>
              ID Contabilium
              <input type="text" value={contabiliumId} onChange={(e) => setContabiliumId(e.target.value)} placeholder="ej. 19532" />
            </label>
          </div>
          <div className="admin-form-row">
            <label>
              Objetivo mensual {CURRENT_YEAR} ($)
              <input type="number" min="0" step="1000" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} placeholder="Opcional" />
            </label>
          </div>
          {error && <p className="admin-error">{error}</p>}
          {success && <p className="admin-success">{success}</p>}
          <button type="submit" className="admin-submit" disabled={saving}>
            {saving ? "Creando…" : "Crear vendedor"}
          </button>
        </form>
      </section>
    </div>
  );
}
