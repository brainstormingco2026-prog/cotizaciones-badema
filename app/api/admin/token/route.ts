export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { isInternalTokenExpired } from "@/lib/contabilium/sync-budgets";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "ADMIN") return Response.json({ error: "Solo administradores" }, { status: 403 });

  const setting = await prisma.setting.findUnique({ where: { key: "contabilium_token" } });
  const token = setting?.value ?? process.env.CONTABILIUM_INTERNAL_TOKEN ?? null;

  if (!token) return Response.json({ status: "missing", updatedAt: null });

  const expired = isInternalTokenExpired(token);
  let expiresAt: string | null = null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    expiresAt = new Date(payload.exp * 1000).toISOString();
  } catch { /* ignore */ }

  return Response.json({
    status: expired ? "expired" : "ok",
    expiresAt,
    updatedAt: setting?.updatedAt ?? null,
    source: setting?.value ? "db" : "env",
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "ADMIN") return Response.json({ error: "Solo administradores" }, { status: 403 });

  const { token } = await req.json();
  if (!token || typeof token !== "string") return Response.json({ error: "Token requerido" }, { status: 400 });

  if (isInternalTokenExpired(token)) {
    return Response.json({ error: "El token ya está expirado. Copiá uno nuevo desde el navegador." }, { status: 400 });
  }

  await prisma.setting.upsert({
    where: { key: "contabilium_token" },
    create: { key: "contabilium_token", value: token },
    update: { key: "contabilium_token", value: token },
  });

  let expiresAt: string | null = null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    expiresAt = new Date(payload.exp * 1000).toISOString();
  } catch { /* ignore */ }

  return Response.json({ ok: true, expiresAt });
}
