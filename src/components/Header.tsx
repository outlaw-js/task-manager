"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { NotificationBell, PwaPrompts, disablePush } from "./PwaPrompts";
import { api } from "@/lib/client";
import type { UserLite } from "@/lib/types";

export function Header({ user, children }: { user: UserLite; children?: React.ReactNode }) {
  const router = useRouter();
  async function logout() {
    // Stop this device's notifications first so the next person on it doesn't get them.
    await disablePush().catch(() => {});
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <>
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-brand-700">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="7" height="18" rx="1.5" />
              <rect x="14" y="3" width="7" height="11" rx="1.5" />
            </svg>
          </span>
          <span className="hidden sm:inline">تسک منیجر</span>
        </Link>
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Avatar user={user} />
          <span className="hidden text-sm font-medium md:inline">{user.name}</span>
          <button onClick={logout} className="btn-ghost text-xs">
            خروج
          </button>
        </div>
      </div>
    </header>
    {/* Outside <header>: its backdrop-blur would make it the containing block for this fixed popup. */}
    <PwaPrompts />
    </>
  );
}
