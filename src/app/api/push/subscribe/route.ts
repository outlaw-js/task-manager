import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, readJson, requireUser } from "@/lib/api";

interface Body {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

/** Saves this device's push subscription for the signed-in user (re-subscribing is idempotent). */
export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson<Body>(req);
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    throw new HttpError(400, "اشتراک اعلان نامعتبر است");
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.id, p256dh, auth },
    create: { userId: user.id, endpoint, p256dh, auth },
  });
  return NextResponse.json({ ok: true });
});

/** Removes this device's subscription (notifications turned off, or logging out). */
export const DELETE = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson<Body>(req);
  if (typeof body.endpoint === "string") {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: user.id } });
  }
  return NextResponse.json({ ok: true });
});
