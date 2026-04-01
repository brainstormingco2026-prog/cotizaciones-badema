"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const t = localStorage.getItem("crm_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type TokenStatus = {
  status: "ok" | "expired" | "missing";
  expiresAt: string | null;
  updatedAt: string | null;
  source: "db" | "env" | null;
};

export default function TokenAdminPage() {
  const router = useRouter();
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string; expiresAt?: string } | null>(null);

  useEffect(() => {
    const u = localStorage.getItem("crm_user");
    if (!u || JSON.parse(u).role !== "ADMIN") { router.replace("/dashboard"); return; }
    loadStatus();
  }, [router]);

  function loadStatus() {
    fetch("/api/admin/token", { headers: getAuthHeader() })
      .then((r) => r.json())
      .then(setStatus);
  }

  async function handleSave() {
    if (!token.trim()) return;
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/token", {
        method: "POST",
        headers: { ...getAuthHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      setResult(data);
      if (data.ok) { setToken(""); loadStatus(); }
    } finally {
      setSaving(false);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  }

  return (
    <div className="admin-token-page">
      <h2>Token de Contabilium</h2>
      <p className="muted">
        El token JWT se obtiene desde el navegador cuando iniciás sesión en{" "}
        <strong>app.contabilium.com</strong>. Dura ~20 horas.
      </p>

      {status && (
        <div className={`token-status token-status-${status.status}`}>
          <span className="token-status-dot" />
          <span>
            {status.status === "ok" && `Activo — vence ${formatDate(status.expiresAt)}`}
            {status.status === "expired" && `Expirado — venció ${formatDate(status.expiresAt)}`}
            {status.status === "missing" && "No configurado"}
          </span>
          {status.updatedAt && (
            <span className="token-status-updated">Actualizado: {formatDate(status.updatedAt)}</span>
          )}
        </div>
      )}

      <div className="token-form">
        <label htmlFor="token-input" className="token-label">
          Pegá el token nuevo (Bearer JWT):
        </label>
        <textarea
          id="token-input"
          className="token-textarea"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."
          rows={5}
          spellCheck={false}
        />
        <button
          type="button"
          className="sync-btn"
          onClick={handleSave}
          disabled={saving || !token.trim()}
        >
          {saving ? "Guardando…" : "Guardar token"}
        </button>
      </div>

      {result?.ok && (
        <p className="token-result-ok">
          Token guardado. Vence: {formatDate(result.expiresAt ?? null)}
        </p>
      )}
      {result?.error && <p className="token-result-error">{result.error}</p>}

      <div className="token-instructions">
        <h4>Cómo obtener el token</h4>
        <ol>
          <li>Abrí <strong>app.contabilium.com</strong> en el navegador</li>
          <li>Abrí DevTools → pestaña <strong>Network</strong></li>
          <li>Buscá cualquier request a <strong>internalapi.contabilium.com</strong></li>
          <li>En los headers del request, copiá el valor de <strong>Authorization</strong> (sin el prefijo &quot;Bearer &quot;)</li>
          <li>Pegalo arriba y guardá</li>
        </ol>
      </div>
    </div>
  );
}
