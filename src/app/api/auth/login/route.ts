import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth";
import { HttpError, handle, readJson, str } from "@/lib/api";

export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  const email = str(body.email, "ایمیل", { required: true })!.toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, "ایمیل یا رمز عبور اشتباه است");
  }
  const res = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, color: user.color },
  });
  await setSessionCookie(res, user.id);
  return res;
});
