import { NextResponse } from "next/server";
import { vapidKeys } from "@/lib/push";

/** Public VAPID key for PushManager.subscribe(); null when push isn't configured on this server. */
export async function GET() {
  return NextResponse.json({ publicKey: vapidKeys()?.publicKey ?? null });
}
