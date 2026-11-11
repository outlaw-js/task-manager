import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { publicUserSelect, randomColor, setSessionCookie } from "@/lib/auth";
import { HttpError, handle, readJson, str } from "@/lib/api";

export const POST = handle(async (req: Request) => {
  const body = await readJson(req);
  const name = str(body.name, "نام", { required: true, max: 80 })!;
  const email = str(body.email, "ایمیل", { required: true, max: 120 })!.toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "ایمیل نامعتبر است");
  if (password.length < 6) throw new HttpError(400, "رمز عبور باید حداقل ۶ کاراکتر باشد");

  if (await prisma.user.findUnique({ where: { email } })) {
    throw new HttpError(409, "این ایمیل قبلاً ثبت شده است");
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10), color: randomColor() },
    select: publicUserSelect,
  });
  const res = NextResponse.json({ user }, { status: 201 });
  await setSessionCookie(res, user.id);
  return res;
});
