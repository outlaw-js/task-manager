import type { Prisma, Priority } from "@prisma/client";
import { prisma } from "./prisma";
import { publicUserSelect } from "./auth";
import { HttpError, str } from "./api";

export const attachmentSelect = {
  id: true,
  name: true,
  mimeType: true,
  size: true,
  uploaderId: true,
  createdAt: true,
} satisfies Prisma.AttachmentSelect;

export const taskInclude = {
  creator: { select: publicUserSelect },
  assignees: { select: publicUserSelect, orderBy: { name: "asc" } },
  labels: { select: { id: true, name: true, color: true }, orderBy: { name: "asc" } },
  // Task images only; files posted in comments belong to the discussion.
  attachments: { where: { commentId: null }, select: attachmentSelect, orderBy: { createdAt: "asc" } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

export async function loadBoard(boardId: string) {
  return prisma.board.findUnique({
    where: { id: boardId },
    include: {
      columns: { orderBy: { position: "asc" } },
      labels: { orderBy: { name: "asc" } },
      members: { include: { user: { select: publicUserSelect } }, orderBy: { joinedAt: "asc" } },
      tasks: { include: taskInclude, orderBy: { position: "asc" } },
    },
  });
}

const PRIORITY_VALUES: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const HEX = /^#[0-9a-fA-F]{6}$/;

export function color(value: unknown, fallback?: string) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !HEX.test(value)) throw new HttpError(400, "رنگ نامعتبر است");
  return value;
}

/**
 * Validates task fields from a request body against the board's own
 * columns, labels and members. Only keys present in the body are returned.
 */
export async function parseTaskInput(boardId: string, body: Record<string, unknown>, creating: boolean) {
  const data: {
    title?: string;
    description?: string | null;
    priority?: Priority;
    deadline?: Date | null;
    columnId?: string;
    assigneeIds?: string[];
    labelIds?: string[];
  } = {};

  if (creating || "title" in body) data.title = str(body.title, "عنوان", { required: true, max: 200 });
  if ("description" in body) data.description = str(body.description, "توضیحات", { max: 10000 }) ?? null;

  if ("priority" in body) {
    if (!PRIORITY_VALUES.includes(body.priority as Priority)) throw new HttpError(400, "اولویت نامعتبر است");
    data.priority = body.priority as Priority;
  }

  if ("deadline" in body) {
    if (body.deadline === null || body.deadline === "") data.deadline = null;
    else {
      const d = new Date(String(body.deadline));
      if (Number.isNaN(d.getTime())) throw new HttpError(400, "ددلاین نامعتبر است");
      data.deadline = d;
    }
  }

  if (creating || "columnId" in body) {
    const column = await prisma.column.findFirst({ where: { id: String(body.columnId), boardId } });
    if (!column) throw new HttpError(400, "ستون نامعتبر است");
    data.columnId = column.id;
  }

  if ("assigneeIds" in body) {
    const ids = idList(body.assigneeIds);
    const count = await prisma.boardMember.count({ where: { boardId, userId: { in: ids } } });
    if (count !== ids.length) throw new HttpError(400, "فقط اعضای برد را می‌توان مسئول تسک کرد");
    data.assigneeIds = ids;
  }

  if ("labelIds" in body) {
    const ids = idList(body.labelIds);
    const count = await prisma.label.count({ where: { boardId, id: { in: ids } } });
    if (count !== ids.length) throw new HttpError(400, "برچسب نامعتبر است");
    data.labelIds = ids;
  }

  return data;
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
    throw new HttpError(400, "لیست شناسه‌ها نامعتبر است");
  }
  return [...new Set(value as string[])];
}
