"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("crm_token");
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    const u = localStorage.getItem("crm_user");
    if (!getToken() || !u) {
      router.replace("/login");
      return;
    }
    setUser(JSON.parse(u));
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
  ];

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-left">
          <h1>CRM Badema</h1>
          <p className="user">Hola, {user.name} · {user.role === "ADMIN" ? "Administrador" : "Vendedor"}</p>
        </div>
        <button type="button" className="logout" onClick={handleLogout}>
          Cerrar sesión
        </button>
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
