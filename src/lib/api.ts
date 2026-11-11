import { NextResponse } from "next/server";
import type { BoardRole } from "@prisma/client";
import { getCurrentUser, isSuperAdmin } from "./auth";
import { prisma } from "./prisma";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/** Wraps a route handler so thrown HttpErrors become JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message);
      console.error(err);
      return fail(500, "خطای داخلی سرور");
    }
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "ابتدا وارد شوید");
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (!isSuperAdmin(user.email)) throw new HttpError(403, "فقط ادمین کل این دسترسی را دارد");
  return user;
}

/** Owner and admins manage the board (members, columns, name); plain members work on tasks. */
export const canManage = (role: BoardRole) => role === "OWNER" || role === "ADMIN";

/**
 * Ensures the current user is a member of the board; returns user + role.
 * `owner` limits the call to the board owner, `manage` to the owner or an admin.
 */
export async function requireBoard(boardId: string, opts: { owner?: boolean; manage?: boolean } = {}) {
  const user = await requireUser();
  const membership = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId: user.id } },
  });
  if (!membership) throw new HttpError(404, "برد پیدا نشد");
  if (opts.owner && membership.role !== "OWNER") {
    throw new HttpError(403, "فقط مالک برد این دسترسی را دارد");
  }
  if (opts.manage && !canManage(membership.role)) {
    throw new HttpError(403, "فقط مالک یا ادمین برد این دسترسی را دارد");
  }
  return { user, role: membership.role, superAdmin: isSuperAdmin(user.email) };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "درخواست نامعتبر است");
  }
}

export function str(value: unknown, field: string, { required = false, max = 500 } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new HttpError(400, `${field} الزامی است`);
    return undefined;
  }
  if (typeof value !== "string") throw new HttpError(400, `${field} نامعتبر است`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new HttpError(400, `${field} الزامی است`);
  if (trimmed.length > max) throw new HttpError(400, `${field} بیش از حد طولانی است`);
  return trimmed;
}
