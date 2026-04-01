/**
 * Auto-login a Contabilium para obtener un JWT fresco.
 *
 * El endpoint POST /api/login devuelve el token en Set-Cookie.
 * Credenciales almacenadas en CONTABILIUM_LOGIN_EMAIL / CONTABILIUM_LOGIN_PASSWORD.
 */

import { prisma } from "../db";

const LOGIN_URL = "https://internalapi.contabilium.com/api/login";

/** Llama a Contabilium, extrae el JWT y lo persiste en DB. */
export async function refreshContabiliumToken(): Promise<string | null> {
  const email = process.env.CONTABILIUM_LOGIN_EMAIL;
  const password = process.env.CONTABILIUM_LOGIN_PASSWORD;
  if (!email || !password) return null;

  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://app.contabilium.com",
        "Referer": "https://app.contabilium.com/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
      body: JSON.stringify({ email, password, country: "ar" }),
    });

    if (!res.ok) return null;

    // 1. Intentar leer el body (puede venir como JSON o texto)
    let bodyText = "";
    try { bodyText = await res.text(); } catch { /* ignorar */ }

    // Si el body contiene un JWT directo
    if (bodyText.startsWith("eyJ")) {
      await saveToken(bodyText.trim());
      return bodyText.trim();
    }

    // Si el body es JSON con token
    try {
      const parsed = JSON.parse(bodyText);
      const bodyToken =
        parsed?.token ?? parsed?.access_token ?? parsed?.jwt ?? parsed?.data?.token ?? null;
      if (bodyToken && typeof bodyToken === "string" && bodyToken.startsWith("eyJ")) {
        await saveToken(bodyToken);
        return bodyToken;
      }
    } catch { /* no es JSON */ }

    // 2. Buscar en Set-Cookie — Node.js 18.14+ tiene getSetCookie() que retorna array
    const cookieHeaders: string[] = [];
    const headersAny = res.headers as unknown as { getSetCookie?: () => string[] };
    if (typeof headersAny.getSetCookie === "function") {
      cookieHeaders.push(...headersAny.getSetCookie());
    } else {
      const raw = res.headers.get("set-cookie");
      if (raw) cookieHeaders.push(...raw.split(/,(?=[^ ])/));
    }

    for (const cookieStr of cookieHeaders) {
      const value = cookieStr.split(";")[0].split("=").slice(1).join("=").trim();
      if (value.startsWith("eyJ")) {
        await saveToken(value);
        return value;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: "contabilium_token" },
    create: { key: "contabilium_token", value: token },
    update: { key: "contabilium_token", value: token },
  });
}
