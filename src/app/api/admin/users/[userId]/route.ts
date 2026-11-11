import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicUserSelect } from "@/lib/auth";
import { HttpError, handle, readJson, requireSuperAdmin, str } from "@/lib/api";

type Ctx = { params: Promise<{ userId: string }> };

/** Super admin: rename any user. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  await requireSuperAdmin();
  const { userId } = await params;
  const body = await readJson(req);
  const name = str(body.name, "نام", { required: true, max: 80 })!;
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) throw new HttpError(404, "کاربر پیدا نشد");
  const user = await prisma.user.update({ where: { id: userId }, data: { name }, select: publicUserSelect });
  return NextResponse.json({ user });
});
