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
  phone: string | null;
  target: string;
  saving: boolean;
  saved: boolean;
  error: string;
  editingPhone: boolean;
  phoneInput: string;
};

const CURRENT_YEAR = new Date().getFullYear();

/** Normaliza un teléfono argentino a E.164 (+549XXXXXXXXXX) */
function formatArgentinePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  // Ya tiene código completo: 549XXXXXXXXXX (13 dígitos)
  if (digits.startsWith("549") && digits.length === 13) return `+${digits}`;
  // Tiene código país sin el 9 móvil: 54XXXXXXXXXX (12 dígitos)
  if (digits.startsWith("54") && digits.length === 12) return `+549${digits.slice(2)}`;
  // Empieza con 9: 9XXXXXXXXXX (11 dígitos)
  if (digits.startsWith("9") && digits.length === 11) return `+54${digits}`;
  // Formato local con 0: 0XXXXXXXXXX
  if (digits.startsWith("0")) return `+549${digits.slice(1)}`;
  // 10 dígitos (código de área + número)
  if (digits.length === 10) return `+549${digits}`;
  // Fallback
  return `+${digits}`;
}

export default function VendedoresAdminPage() {
  const router = useRouter();
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);

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
        (usersData.users ?? []).map((v: { id: string; name: string; email: string; contabiliumId: string | null; phone: string | null }) => ({
          id: v.id,
          name: v.name,
          email: v.email,
          contabiliumId: v.contabiliumId,
          phone: v.phone,
          target: goalMap.has(v.id) && goalMap.get(v.id) != null ? String(goalMap.get(v.id)) : "",
          saving: false,
          saved: false,
          error: "",
          editingPhone: false,
          phoneInput: v.phone ?? "",
        }))
      );
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

  async function savePhone(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const formattedPhone = formatArgentinePhone(row.phoneInput);
    updateRow(id, { saving: true, error: "", phoneInput: formattedPhone });
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ id, phone: formattedPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        updateRow(id, { error: data.error ?? "Error al guardar" });
      } else {
        updateRow(id, { phone: data.user.phone, editingPhone: false, saved: true });
        setTimeout(() => updateRow(id, { saved: false }), 2000);
      }
    } finally {
      updateRow(id, { saving: false });
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

      <section className="admin-section">
        <h3>Vendedores — {CURRENT_YEAR}</h3>
        <p className="admin-hint">Hacé click en el teléfono para editarlo. El objetivo mensual es el monto en pesos por mes.</p>
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
                <th>WhatsApp</th>
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
                  <td data-label="WhatsApp" className="col-editable" onClick={() => !row.editingPhone && updateRow(row.id, { editingPhone: true, phoneInput: formatArgentinePhone(row.phone ?? "") || "" })}>
                    {row.editingPhone ? (
                      <div className="phone-edit-row">
                        <input
                          type="tel"
                          className="inline-input"
                          value={row.phoneInput}
                          placeholder="ej. 3517604973"
                          onChange={(e) => {
                            const raw = e.target.value;
                            const digits = raw.replace(/\D/g, "");
                            const value = digits.length >= 10 ? formatArgentinePhone(raw) : raw;
                            updateRow(row.id, { phoneInput: value });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") savePhone(row.id);
                            if (e.key === "Escape") updateRow(row.id, { editingPhone: false });
                          }}
                          autoFocus
                        />
                        <button type="button" className="goal-save-btn" onClick={() => savePhone(row.id)} disabled={row.saving}>
                          {row.saving ? "…" : "✓"}
                        </button>
                      </div>
                    ) : (
                      <span className="editable-value">{row.phone ?? <span className="muted">— click para agregar</span>}</span>
                    )}
                    {row.error && <span className="goal-inline-error">{row.error}</span>}
                  </td>
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
    </div>
  );
}
