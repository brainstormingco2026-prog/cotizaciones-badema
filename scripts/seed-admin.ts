/**
 * Crear usuario admin inicial.
 * Uso: npx tsx scripts/seed-admin.ts
 * Variables: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME (opcional)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@badema.com";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  const name = process.env.ADMIN_NAME ?? "Administrador";

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      password: hash,
      role: "ADMIN",
    },
  });
  console.log("Admin creado:", user.email, user.role);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
