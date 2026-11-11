import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { publicUserSelect, randomColor } from "@/lib/auth";
import { HttpError, handle, readJson, requireBoard, str } from "@/lib/api";

type Ctx = { params: Promise<{ boardId: string }> };

/**
 * Adds a person to the board by email. If no account exists for that email
 * yet, `name` and `password` are required and a new account is created.
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { boardId } = await params;
  await requireBoard(boardId, { owner: true });
  const body = await readJson(req);
  const email = str(body.email, "ایمیل", { required: true, max: 120 })!.toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "ایمیل نامعتبر است");

  let user = await prisma.user.findUnique({ where: { email }, select: publicUserSelect });
  let created = false;
  if (!user) {
    const name = str(body.name, "نام", { max: 80 });
    const password = typeof body.password === "string" ? body.password : "";
    if (!name || !password) {
      throw new HttpError(404, "کاربری با این ایمیل وجود ندارد؛ برای ساخت حساب جدید نام و رمز عبور را وارد کنید");
    }
    if (password.length < 6) throw new HttpError(400, "رمز عبور باید حداقل ۶ کاراکتر باشد");
    user = await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 10), color: randomColor() },
      select: publicUserSelect,
    });
    created = true;
  }

  const existing = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId: user.id } },
  });
  if (existing) throw new HttpError(409, "این شخص از قبل عضو برد است");

  const member = await prisma.boardMember.create({
    data: { boardId, userId: user.id },
    include: { user: { select: publicUserSelect } },
  });
  return NextResponse.json({ member, created }, { status: 201 });
});
