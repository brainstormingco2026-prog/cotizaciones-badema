/**
 * Limpia cotizaciones y clientes de la base de datos y carga solo las 14 cotizaciones mock.
 * Uso: npx tsx scripts/reset-cotizaciones.ts
 *
 * Requiere USE_MOCK_CONTABILIUM=true o sin credenciales Contabilium para cargar el set de 14.
 */
import { PrismaClient } from "@prisma/client";
import { syncQuotationsFromContabilium } from "../lib/contabilium/sync-quotations";

const prisma = new PrismaClient();

async function main() {
  process.env.USE_MOCK_CONTABILIUM = "true";

  console.log("Eliminando seguimientos (FollowUp)...");
  const deletedFollowUps = await prisma.followUp.deleteMany({});
  console.log("  ", deletedFollowUps.count, "eliminados");

  console.log("Eliminando cotizaciones...");
  const deletedQuotations = await prisma.quotation.deleteMany({});
  console.log("  ", deletedQuotations.count, "eliminadas");

  console.log("Eliminando clientes...");
  const deletedClients = await prisma.client.deleteMany({});
  console.log("  ", deletedClients.count, "eliminados");

  console.log("Cargando las 14 cotizaciones mock...");
  const result = await syncQuotationsFromContabilium();
  console.log("  Creadas:", result.created, "Actualizadas:", result.updated, "Mock:", result.mock);

  console.log("Listo. La base queda solo con las 14 cotizaciones del set de datos.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
