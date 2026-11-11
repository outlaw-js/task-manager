import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, readJson, requireUser } from "@/lib/api";

/** Change your own password: needs the current one. */
export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  const body = await readJson(req);
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body.newPassword === "string" ? body.newPassword : "";
  if (next.length < 6) throw new HttpError(400, "رمز عبور جدید باید حداقل ۶ کاراکتر باشد");
  if (next.length > 200) throw new HttpError(400, "رمز عبور جدید بیش از حد طولانی است");

  const row = await prisma.user.findUnique({ where: { id: me.id }, select: { passwordHash: true } });
  if (!row || !(await bcrypt.compare(current, row.passwordHash))) throw new HttpError(400, "رمز عبور فعلی اشتباه است");
  if (await bcrypt.compare(next, row.passwordHash)) throw new HttpError(400, "رمز جدید با رمز فعلی یکی است");

  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return NextResponse.json({ ok: true });
});
