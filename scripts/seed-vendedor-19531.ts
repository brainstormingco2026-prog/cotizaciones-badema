/**
 * Crear cuenta de vendedor asociada al ID de Contabilium 19531.
 * Uso: npx tsx scripts/seed-vendedor-19531.ts
 * Variables: VENDEDOR_19531_EMAIL, VENDEDOR_19531_PASSWORD, VENDEDOR_19531_NAME (opcional)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CONTABILIUM_ID = "19531";

async function main() {
  const email = process.env.VENDEDOR_19531_EMAIL ?? "vendedor19531@badema.com";
  const password = process.env.VENDEDOR_19531_PASSWORD ?? "vendedor19531";
  const name = process.env.VENDEDOR_19531_NAME ?? "Vendedor 19531";

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, password: hash, role: "VENDEDOR", contabiliumId: CONTABILIUM_ID },
    create: {
      email,
      name,
      password: hash,
      role: "VENDEDOR",
      contabiliumId: CONTABILIUM_ID,
    },
  });
  console.log("Vendedor creado:", user.email, "| nombre:", user.name, "| role:", user.role);
  console.log("  (ID Contabilium de referencia:", CONTABILIUM_ID + ")");
  console.log("  Iniciar sesión con:", email, "/ contraseña por defecto:", password);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
