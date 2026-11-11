import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, readJson, requireBoard, str } from "@/lib/api";
import { color } from "@/lib/board";

type Ctx = { params: Promise<{ columnId: string }> };

async function findColumn(columnId: string) {
  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (!column) throw new HttpError(404, "ستون پیدا نشد");
  await requireBoard(column.boardId, { manage: true });
  return column;
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { columnId } = await params;
  await findColumn(columnId);
  const body = await readJson(req);
  const column = await prisma.column.update({
    where: { id: columnId },
    data: {
      ...("title" in body && { title: str(body.title, "عنوان ستون", { required: true, max: 60 }) }),
      ...("color" in body && { color: color(body.color) }),
    },
  });
  return NextResponse.json({ column });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { columnId } = await params;
  const column = await findColumn(columnId);
  const taskCount = await prisma.task.count({ where: { columnId } });
  if (taskCount > 0) throw new HttpError(400, "ستون دارای تسک است؛ ابتدا تسک‌ها را جابجا یا حذف کنید");
  const columnCount = await prisma.column.count({ where: { boardId: column.boardId } });
  if (columnCount <= 1) throw new HttpError(400, "برد باید حداقل یک ستون داشته باشد");
  await prisma.column.delete({ where: { id: columnId } });
  return NextResponse.json({ ok: true });
});
