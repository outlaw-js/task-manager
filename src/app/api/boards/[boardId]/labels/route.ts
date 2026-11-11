import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, readJson, requireBoard, str } from "@/lib/api";
import { color } from "@/lib/board";

type Ctx = { params: Promise<{ boardId: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { boardId } = await params;
  await requireBoard(boardId);
  const body = await readJson(req);
  const name = str(body.name, "نام برچسب", { required: true, max: 40 })!;
  if (await prisma.label.findUnique({ where: { boardId_name: { boardId, name } } })) {
    throw new HttpError(409, "برچسبی با این نام وجود دارد");
  }
  const label = await prisma.label.create({
    data: { boardId, name, color: color(body.color, "#6366f1")! },
    select: { id: true, name: true, color: true },
  });
  return NextResponse.json({ label }, { status: 201 });
});
