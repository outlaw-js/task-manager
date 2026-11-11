import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, readJson, requireBoard, str } from "@/lib/api";
import { color } from "@/lib/board";

type Ctx = { params: Promise<{ boardId: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { boardId } = await params;
  await requireBoard(boardId);
  const body = await readJson(req);
  const last = await prisma.column.findFirst({ where: { boardId }, orderBy: { position: "desc" } });
  const column = await prisma.column.create({
    data: {
      boardId,
      title: str(body.title, "عنوان ستون", { required: true, max: 60 })!,
      color: color(body.color, "#94a3b8")!,
      position: (last?.position ?? -1) + 1,
    },
  });
  return NextResponse.json({ column }, { status: 201 });
});
