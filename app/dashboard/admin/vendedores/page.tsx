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
  callmebotApiKey: string | null;
  active: boolean;
  target: string;        // raw digits string, e.g. "150000"
  savedTarget: string;   // last persisted value — for dirty check
  targetFocused: boolean;
  saving: boolean;
  saved: boolean;
  goalError: string;
  phoneError: string;
  editingPhone: boolean;
  phoneInput: string;
  editingApiKey: boolean;
  apiKeyInput: string;
  deactivating: boolean;
  deactivateError: string;
};

const CURRENT_YEAR = new Date().getFullYear();

/** Normaliza un teléfono argentino a E.164 (+549XXXXXXXXXX) */
function formatArgentinePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("549") && digits.length === 13) return `+${digits}`;
  if (digits.startsWith("54") && digits.length === 12) return `+549${digits.slice(2)}`;
  if (digits.startsWith("9") && digits.length === 11) return `+54${digits}`;
  if (digits.startsWith("0")) return `+549${digits.slice(1)}`;
  if (digits.length === 10) return `+549${digits}`;
  return `+${digits}`;
}

/** Formatea un string de dígitos como moneda ARS sin decimales: "150000" → "150.000" */
function formatGoalARS(raw: string): string {
  const n = parseInt(raw, 10);
  if (isNaN(n)) return raw;
  return n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

export default function VendedoresAdminPage() {
  const router = useRouter();
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null); // id a desactivar

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
        (usersData.users ?? []).map((v: { id: string; name: string; email: string; contabiliumId: string | null; phone: string | null; callmebotApiKey: string | null; active: boolean }) => {
          const t = goalMap.has(v.id) && goalMap.get(v.id) != null ? String(Math.round(goalMap.get(v.id)!)) : "";
          return {
            id: v.id,
            name: v.name,
            email: v.email,
            contabiliumId: v.contabiliumId,
            phone: v.phone,
            callmebotApiKey: v.callmebotApiKey,
            active: v.active ?? true,
            target: t,
            savedTarget: t,
            targetFocused: false,
            saving: false,
            saved: false,
            goalError: "",
            phoneError: "",
            editingPhone: false,
            phoneInput: v.phone ?? "",
            editingApiKey: false,
            apiKeyInput: v.callmebotApiKey ?? "",
            deactivating: false,
            deactivateError: "",
          };
        })
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
    if (!row.target.trim() || row.target === row.savedTarget) return;
    const amount = parseInt(row.target, 10);
    if (isNaN(amount) || amount < 0) { updateRow(id, { goalError: "Monto inválido" }); return; }
    updateRow(id, { saving: true, goalError: "", saved: false });
    try {
      const res = await fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ userId: id, year: CURRENT_YEAR, monthlyTarget: amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        updateRow(id, { goalError: data.error ?? "Error al guardar" });
      } else {
        updateRow(id, { saved: true, savedTarget: row.target });
        setTimeout(() => updateRow(id, { saved: false }), 2000);
      }
    } finally {
      updateRow(id, { saving: false });
    }
  }

  async function saveApiKey(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    updateRow(id, { saving: true, phoneError: "" });
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ id, callmebotApiKey: row.apiKeyInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        updateRow(id, { phoneError: data.error ?? "Error al guardar" });
      } else {
        updateRow(id, { callmebotApiKey: data.user.callmebotApiKey, editingApiKey: false, saved: true });
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
    updateRow(id, { saving: true, phoneError: "", phoneInput: formattedPhone });
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ id, phone: formattedPhone }),
      });
      const data = await res.json();
      if (!res.ok) {
        updateRow(id, { phoneError: data.error ?? "Error al guardar" });
      } else {
        updateRow(id, { phone: data.user.phone, editingPhone: false, saved: true });
        setTimeout(() => updateRow(id, { saved: false }), 2000);
      }
    } finally {
      updateRow(id, { saving: false });
    }
  }

  async function toggleActive(id: string, activate: boolean) {
    updateRow(id, { deactivating: true, deactivateError: "" });
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ id, active: activate }),
      });
      const data = await res.json();
      if (!res.ok) {
        updateRow(id, { deactivateError: data.error ?? "Error al cambiar estado" });
      } else {
        updateRow(id, { active: data.user.active });
      }
    } finally {
      updateRow(id, { deactivating: false });
      setConfirmDeactivate(null);
    }
  }

  const activeRows = rows.filter((r) => r.active);
  const inactiveRows = rows.filter((r) => !r.active);

  function renderRow(row: VendorRow) {
    const isDirty = row.target.trim() !== "" && row.target !== row.savedTarget;
    return (
      <tr key={row.id} className={!row.active ? "vendor-row-inactive" : ""}>
        <td data-label="Nombre">
          {row.name}
          {!row.active && <span className="vendor-badge-inactive"> · Inactivo</span>}
        </td>
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
          {row.phoneError && <span className="goal-inline-error">{row.phoneError}</span>}
        </td>
        <td data-label="API Key CallMeBot" className="col-editable" onClick={() => !row.editingApiKey && updateRow(row.id, { editingApiKey: true, apiKeyInput: row.callmebotApiKey ?? "" })}>
          {row.editingApiKey ? (
            <div className="phone-edit-row">
              <input
                type="text"
                className="inline-input"
                value={row.apiKeyInput}
                placeholder="ej. 1234567"
                onChange={(e) => updateRow(row.id, { apiKeyInput: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveApiKey(row.id);
                  if (e.key === "Escape") updateRow(row.id, { editingApiKey: false });
                }}
                autoFocus
              />
              <button type="button" className="goal-save-btn" onClick={() => saveApiKey(row.id)} disabled={row.saving}>
                {row.saving ? "…" : "✓"}
              </button>
            </div>
          ) : (
            <span className="editable-value">
              {row.callmebotApiKey ? "••••••••" : <span className="muted">— click para agregar</span>}
            </span>
          )}
        </td>
        <td data-label="ID Contabilium">{row.contabiliumId ?? <span className="muted">—</span>}</td>
        <td data-label="Objetivo ($)">
          <input
            className="goal-input"
            type="text"
            inputMode="numeric"
            value={row.targetFocused ? row.target : (row.target ? formatGoalARS(row.target) : "")}
            placeholder="Sin objetivo"
            onFocus={() => updateRow(row.id, { targetFocused: true })}
            onBlur={() => updateRow(row.id, { targetFocused: false })}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              updateRow(row.id, { target: digits, goalError: "", saved: false });
            }}
            onKeyDown={(e) => e.key === "Enter" && saveGoal(row.id)}
          />
          {row.goalError && <span className="goal-inline-error">{row.goalError}</span>}
        </td>
        <td data-label="" className="vendor-actions-cell">
          <button
            type="button"
            className={`goal-save-btn ${row.saved ? "goal-save-btn-ok" : ""} ${!isDirty ? "goal-save-btn-disabled" : ""}`}
            onClick={() => saveGoal(row.id)}
            disabled={row.saving || !isDirty}
          >
            {row.saving ? "…" : row.saved ? "Guardado" : "Guardar"}
          </button>
          {row.active ? (
            <button
              type="button"
              className="vendor-deactivate-btn"
              onClick={() => setConfirmDeactivate(row.id)}
              disabled={row.deactivating}
            >
              Desactivar
            </button>
          ) : (
            <button
              type="button"
              className="vendor-activate-btn"
              onClick={() => toggleActive(row.id, true)}
              disabled={row.deactivating}
            >
              {row.deactivating ? "…" : "Reactivar"}
            </button>
          )}
          {row.deactivateError && <span className="goal-inline-error vendor-deactivate-error">{row.deactivateError}</span>}
        </td>
      </tr>
    );
  }

  return (
    <div className="admin-vendedores">
      {/* Modal de confirmación de desactivación */}
      {confirmDeactivate && (() => {
        const row = rows.find((r) => r.id === confirmDeactivate);
        if (!row) return null;
        return (
          <div className="confirm-modal-overlay" onClick={() => setConfirmDeactivate(null)}>
            <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Desactivar vendedor</h3>
              <p>¿Desactivar a <strong>{row.name}</strong>? No podrá iniciar sesión ni aparecer en la asignación de cotizaciones.</p>
              <p className="confirm-modal-hint">Solo es posible si no tiene cotizaciones asociadas.</p>
              <div className="confirm-modal-actions">
                <button type="button" className="vendor-deactivate-btn" onClick={() => toggleActive(confirmDeactivate, false)} disabled={row.deactivating}>
                  {row.deactivating ? "Verificando…" : "Sí, desactivar"}
                </button>
                <button type="button" className="admin-back-btn" onClick={() => setConfirmDeactivate(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="admin-vendedores-header">
        <h2>Gestión de vendedores</h2>
        <button type="button" className="admin-back-btn" onClick={() => router.push("/dashboard")}>
          ← Volver al panel
        </button>
      </div>

      <section className="admin-section">
        <h3>Vendedores — {CURRENT_YEAR}</h3>
        <p className="admin-hint">Hacé click en cada campo para editarlo. Para activar CallMeBot: hacé click en <a href={`https://wa.me/34684728023?text=${encodeURIComponent("I allow callmebot to send me messages")}`} target="_blank" rel="noopener noreferrer">+34 684 72 80 23</a> y enviá el mensaje que se pre-completa — recibirás tu API key por WhatsApp.</p>
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
                <th>API Key CallMeBot</th>
                <th>ID Contabilium</th>
                <th>Objetivo mensual ($)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activeRows.map(renderRow)}
              {inactiveRows.length > 0 && activeRows.length > 0 && (
                <tr className="vendor-section-divider">
                  <td colSpan={7}>Inactivos</td>
                </tr>
              )}
              {inactiveRows.map(renderRow)}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
