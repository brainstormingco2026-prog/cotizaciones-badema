/**
 * Sincronización de vendedores desde Contabilium al CRM.
 *
 * Obtiene la lista de vendedores de Contabilium y actualiza los nombres
 * de los usuarios CRM que ya tienen contabiliumId vinculado.
 * Devuelve además el mapa completo de vendedores para el panel admin.
 */

import bcrypt from "bcryptjs";
import { createContabiliumClient, getContabiliumConfigFromEnv } from "./client";
import { prisma } from "../db";

export type ContabiliumVendor = {
  Id: number;
  Nombre?: string;
  Apellido?: string;
  Email?: string;
  [k: string]: unknown;
};

/** Nombre completo de un vendedor de Contabilium. */
export function getVendorDisplayName(v: ContabiliumVendor): string {
  const parts = [v.Nombre, v.Apellido].filter(Boolean).join(" ").trim();
  return parts || `Vendedor #${v.Id}`;
}

export async function syncVendorsFromContabilium(): Promise<{
  vendors: { id: string; name: string }[];
  created: number;
  updated: number;
  errors: string[];
  mock: boolean;
}> {
  const errors: string[] = [];
  let updated = 0;
  let created = 0;

  const config = getContabiliumConfigFromEnv();
  if (!config) {
    return { vendors: [], created: 0, updated: 0, errors: ["Sin credenciales de Contabilium"], mock: true };
  }

  let rawVendors: ContabiliumVendor[] = [];

  try {
    const client = await createContabiliumClient(config);
    const path =
      process.env.CONTABILIUM_VENDEDORES_PATH ?? "/api/vendedores/getall";
    rawVendors = await client.get<ContabiliumVendor[]>(path);
    if (!Array.isArray(rawVendors)) rawVendors = [];
  } catch (e) {
    // Si el endpoint no existe (404) o no está disponible, no es un error crítico
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("404")) errors.push(`Error al obtener vendedores: ${msg}`);
    return { vendors: [], created, updated, errors, mock: false };
  }

  // Mapa contabiliumId → usuario CRM existente
  const crmUsers = await prisma.user.findMany({
    where: { role: "VENDEDOR" },
    select: { id: true, contabiliumId: true },
  });
  const byContabiliumId = new Map(
    crmUsers.filter((u) => u.contabiliumId).map((u) => [u.contabiliumId!, u.id])
  );
  const existingEmails = new Set(
    (await prisma.user.findMany({ select: { email: true } })).map((u) => u.email)
  );

  const defaultPassword = await bcrypt.hash("Badema2026", 10);

  for (const v of rawVendors) {
    const contabiliumId = String(v.Id);
    const name = getVendorDisplayName(v);
    const existingUserId = byContabiliumId.get(contabiliumId);

    if (existingUserId) {
      // Actualizar nombre
      try {
        await prisma.user.update({ where: { id: existingUserId }, data: { name } });
        updated++;
      } catch (e) {
        errors.push(`Actualizar vendedor ${contabiliumId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      // Crear usuario nuevo
      const email = v.Email?.trim()
        ? v.Email.trim().toLowerCase()
        : `vendedor${contabiliumId}@badema.com.ar`;

      // Si el email ya existe, vincular al usuario existente en lugar de crear uno nuevo
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        try {
          await prisma.user.update({ where: { id: existing.id }, data: { contabiliumId, name } });
          updated++;
        } catch (e) {
          errors.push(`Vincular vendedor ${contabiliumId}: ${e instanceof Error ? e.message : String(e)}`);
        }
        continue;
      }

      try {
        await prisma.user.create({
          data: { name, email, password: defaultPassword, role: "VENDEDOR", contabiliumId },
        });
        created++;
        existingEmails.add(email);
      } catch (e) {
        errors.push(`Crear vendedor ${contabiliumId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  const vendors = rawVendors.map((v) => ({
    id: String(v.Id),
    name: getVendorDisplayName(v),
  }));

  return { vendors, created, updated, errors, mock: false };
}
