/**
 * Ejecutar sincronización con Contabilium desde línea de comandos.
 * Uso: npm run sync:contabilium
 */
import { syncQuotationsFromContabilium } from "../lib/contabilium/sync-quotations";

syncQuotationsFromContabilium()
  .then((r) => {
    console.log("Sync OK:", r);
    process.exit(0);
  })
  .catch((e) => {
    console.error("Sync error:", e);
    process.exit(1);
  });
