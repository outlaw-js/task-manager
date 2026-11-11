import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, readJson, requireBoard } from "@/lib/api";

type Ctx = { params: Promise<{ boardId: string }> };

interface Body {
  /** Full ordered task-id list for every column touched by a drag. */
  columns?: { id: string; taskIds: string[] }[];
  /** Full ordered column-id list, when columns themselves were reordered. */
  columnOrder?: string[];
}

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { boardId } = await params;
  await requireBoard(boardId);
  const body = await readJson<Body>(req);
  const columns = Array.isArray(body.columns) ? body.columns : [];
  const columnOrder = Array.isArray(body.columnOrder) ? body.columnOrder : [];

  const columnIds = [...new Set([...columns.map((c) => c.id), ...columnOrder])];
  const taskIds = columns.flatMap((c) => (Array.isArray(c.taskIds) ? c.taskIds : []));

  const [validColumns, validTasks] = await Promise.all([
    prisma.column.count({ where: { boardId, id: { in: columnIds } } }),
    prisma.task.count({ where: { boardId, id: { in: taskIds } } }),
  ]);
  if (validColumns !== columnIds.length || validTasks !== new Set(taskIds).size || validTasks !== taskIds.length) {
    throw new HttpError(400, "ترتیب ارسال‌شده نامعتبر است");
  }

  await prisma.$transaction([
    ...columns.flatMap((c) =>
      c.taskIds.map((taskId, position) =>
        prisma.task.update({ where: { id: taskId }, data: { columnId: c.id, position } }),
      ),
    ),
    ...columnOrder.map((id, position) => prisma.column.update({ where: { id }, data: { position } })),
  ]);
  return NextResponse.json({ ok: true });
});
