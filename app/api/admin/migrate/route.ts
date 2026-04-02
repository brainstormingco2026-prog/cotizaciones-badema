export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

function authOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!authOk(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const results: string[] = [];
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT TRUE`
    );
    results.push('ALTER TABLE User ADD COLUMN active OK');
  } catch (e) {
    results.push(`Error: ${e instanceof Error ? e.message : String(e)}`);
  }

  return Response.json({ results });
}
