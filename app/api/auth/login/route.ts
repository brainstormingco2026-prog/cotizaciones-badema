export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { signToken, type Role } from "@/lib/auth";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: "Email y contraseña requeridos" }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  console.log("[login] user found:", !!user, "email:", email);
  if (!user) {
    return Response.json({ error: "Credenciales incorrectas", debug: "user_not_found" }, { status: 401 });
  }
  const passwordMatch = await bcrypt.compare(password, user.password);
  console.log("[login] password match:", passwordMatch, "hash prefix:", user.password.slice(0, 10));
  if (!passwordMatch) {
    return Response.json({ error: "Credenciales incorrectas", debug: "wrong_password" }, { status: 401 });
  }
  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role as Role,
  });
  return Response.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}
