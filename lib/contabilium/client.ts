/**
 * Cliente API Contabilium
 * Documentación: https://ayuda.contabilium.com/hc/es/articles/360013444234
 * Endpoints: https://documenter.getpostman.com/view/17702437/2s93shz9yz
 *
 * Configurar CONTABILIUM_API_URL, CONTABILIUM_CLIENT_ID y CONTABILIUM_CLIENT_SECRET en .env
 */

const BASE_URL = process.env.CONTABILIUM_API_URL ?? "https://rest.contabilium.com";

export type ContabiliumConfig = {
  clientId: string;
  clientSecret: string;
};

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getAccessToken(config: ContabiliumConfig): Promise<string> {
  if (cachedToken && cachedToken.expires_at > Date.now() + 60_000) {
    return cachedToken.access_token;
  }
  const res = await fetch(`${BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Contabilium auth failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export async function createContabiliumClient(config: ContabiliumConfig) {
  const token = await getAccessToken(config);

  return {
    async get<T>(path: string): Promise<T> {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Contabilium API ${path}: ${res.status}`);
      return res.json();
    },

    /**
     * Obtiene todos los ítems paginados.
     * @param path - Ruta del endpoint (ej. /api/comprobantes)
     * @param params - Parámetros de query adicionales (ej. { Tipofc: "COT" } para cotizaciones)
     */
    async getPaginated<T>(path: string, params?: Record<string, string>): Promise<T[]> {
      const all: T[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const search = new URLSearchParams({ page: String(page), pageSize: "100" });
        if (params) {
          Object.entries(params).forEach(([k, v]) => search.set(k, v));
        }
        const sep = path.includes("?") ? "&" : "?";
        const data = (await this.get<{ Items?: T[]; Total?: number }>(
          `${path}${sep}${search.toString()}`
        )) as { Items?: T[]; Total?: number };
        const items = data.Items ?? [];
        all.push(...items);
        hasMore = items.length === 100 && (data.Total ?? 0) > all.length;
        page++;
      }
      return all;
    },
  };
}

/**
 * Obtener configuración desde env (para jobs/cron)
 */
export function getContabiliumConfigFromEnv(): ContabiliumConfig | null {
  const clientId = process.env.CONTABILIUM_CLIENT_ID;
  const clientSecret = process.env.CONTABILIUM_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
