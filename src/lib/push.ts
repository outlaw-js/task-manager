import { prisma } from "./prisma";
import { sendWebPush, type VapidKeys } from "./webpush";

export interface PushPayload {
  title: string;
  body: string;
  /** Page to open when the notification is clicked. */
  url: string;
  /** Notifications with the same tag replace each other instead of stacking. */
  tag?: string;
}

export function vapidKeys(): VapidKeys | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return null;
  return { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT || "mailto:admin@localhost" };
}

/**
 * Sends a notification to every device of the given users. Never throws and
 * never delays the API response: callers fire it and move on. Dead
 * subscriptions (uninstalled app, revoked permission) are cleaned up.
 */
export function notifyUsers(userIds: string[], payload: PushPayload) {
  const keys = vapidKeys();
  const ids = [...new Set(userIds)];
  if (!keys || ids.length === 0) return;

  void (async () => {
    const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: ids } } });
    await Promise.all(
      subs.map(async (sub) => {
        try {
          const result = await sendWebPush(sub, payload, keys);
          if (!result.ok && result.gone) await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          else if (!result.ok) console.warn(`push failed (${result.status}) for ${new URL(sub.endpoint).host}: ${result.body.slice(0, 200)}`);
        } catch (err) {
          console.warn("push error:", err instanceof Error ? err.message : err);
        }
      }),
    );
  })().catch((err) => console.warn("push error:", err));
}
