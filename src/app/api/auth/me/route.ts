import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { clearSessionCookie, getCurrentUser, publicUserSelect } from "@/lib/auth";
import { HttpError, handle, readJson, requireUser, str } from "@/lib/api";
import { deleteAccount, ownedBoardsPlan } from "@/lib/account";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ابتدا وارد شوید" }, { status: 401 });
  // ?deletePlan=1 previews what deleting the account would do to owned boards.
  if (new URL(req.url).searchParams.get("deletePlan")) {
    return NextResponse.json({ user, ownedBoards: await ownedBoardsPlan(user.id) });
  }
  return NextResponse.json({ user });
}

/** Rename yourself. */
export const PATCH = handle(async (req: Request) => {
  const me = await requireUser();
  const body = await readJson(req);
  const name = str(body.name, "نام", { required: true, max: 80 })!;
  const user = await prisma.user.update({ where: { id: me.id }, data: { name }, select: publicUserSelect });
  return NextResponse.json({ user });
});

/** Delete your own account; requires the current password. */
export const DELETE = handle(async (req: Request) => {
  const me = await requireUser();
  const body = await readJson(req);
  const password = typeof body.password === "string" ? body.password : "";
  const row = await prisma.user.findUnique({ where: { id: me.id }, select: { passwordHash: true } });
  if (!row || !(await bcrypt.compare(password, row.passwordHash))) throw new HttpError(400, "رمز عبور اشتباه است");

  const boards = await deleteAccount(me.id);
  const res = NextResponse.json({ ok: true, boards });
  clearSessionCookie(res);
  return res;
});
