"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("crm_token");
}

async function registerPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });

    const token = localStorage.getItem("crm_token");
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(sub),
    });
  } catch {
    // Push no disponible en este dispositivo/navegador
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [alerts, setAlerts] = useState<{ id: string; externalId: string; client: { name: string } }[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    const u = localStorage.getItem("crm_user");
    if (!getToken() || !u) {
      router.replace("/login");
      return;
    }
    setUser(JSON.parse(u));
    registerPush();

    // Chequear seguimientos de hoy
    const token = localStorage.getItem("crm_token");
    fetch("/api/notifications/follow-up-alerts", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : { count: 0, alerts: [] })
      .then((d) => {
        if (d.count > 0) {
          setAlerts(d.alerts);
          setShowAlerts(true);
        }
      });
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("crm_token");
    localStorage.removeItem("crm_user");
    router.replace("/login");
    router.refresh();
  }

  if (!user) return null;

  const navItems = [
    { href: "/dashboard", label: "Panel de Control" },
    { href: "/dashboard/cotizaciones", label: "Cotizaciones" },
    ...(user.role === "ADMIN" ? [
      { href: "/dashboard/admin/vendedores", label: "Vendedores" },
      { href: "/dashboard/admin/token", label: "Token API" },
    ] : []),
  ];

  return (
    <main className="dashboard">
      {showAlerts && (
        <div className="followup-toast">
          <div className="followup-toast-content">
            <span className="followup-toast-icon">🔔</span>
            <div className="followup-toast-body">
              <strong>Seguimientos para hoy</strong>
              <ul className="followup-toast-list">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <Link href={`/dashboard/cotizaciones/${a.id}`} onClick={() => setShowAlerts(false)}>
                      #{a.externalId} — {a.client.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <button type="button" className="followup-toast-close" onClick={() => setShowAlerts(false)}>✕</button>
          </div>
        </div>
      )}
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <Image
            src="/logo-badema.png"
            alt="Badema"
            width={160}
            height={72}
            className="header-logo"
            priority
          />
          <p className="user">Hola, {user.name} · {user.role === "ADMIN" ? "Administrador" : "Vendedor"}</p>
        </div>
        <div className="dashboard-header-right">
          {alerts.length > 0 && (
            <button
              type="button"
              className="notif-bell"
              onClick={() => setShowAlerts((v) => !v)}
              title={`${alerts.length} seguimiento${alerts.length !== 1 ? "s" : ""} hoy`}
            >
              🔔
              <span className="notif-badge">{alerts.length}</span>
            </button>
          )}
          <button type="button" className="logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <nav className="dashboard-nav">
        {navItems.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`dashboard-nav-link ${pathname === href ? "active" : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <section className="dashboard-content">
        {children}
      </section>
    </main>
  );
}
