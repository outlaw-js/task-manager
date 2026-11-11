"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "./Toast";

// ---------------------------------------------------------------- push helpers

const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(() => navigator.serviceWorker.ready);
}

function keyBytes(base64url: string) {
  const raw = atob(base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "="));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

let cachedKey: Promise<string | null> | null = null;
const serverKey = () =>
  (cachedKey ??= fetch("/api/push/key")
    .then((r) => r.json())
    .then((d) => (d.publicKey as string | null) ?? null)
    .catch(() => null));

/** Subscribes this device (asking for permission if needed) and stores the subscription on the server. */
export async function enablePush(): Promise<"on" | "denied" | "unsupported"> {
  if (!pushSupported()) return "unsupported";
  const key = await serverKey();
  if (!key) return "unsupported";
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return "denied";
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with another server key can't receive our messages.
  if (sub && sub.options.applicationServerKey) {
    const current = new Uint8Array(sub.options.applicationServerKey);
    const wanted = keyBytes(key);
    if (current.length !== wanted.length || current.some((b, i) => b !== wanted[i])) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  if (!res.ok) throw new Error("ثبت اعلان ناموفق بود");
  return "on";
}

/** Stops notifications on this device (also used on logout, so the next person doesn't get them). */
export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

type PushState = "loading" | "unsupported" | "off" | "on" | "denied";

function usePushState() {
  const [state, setState] = useState<PushState>("loading");
  const refresh = useCallback(async () => {
    if (!pushSupported() || !(await serverKey())) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    setState(sub && Notification.permission === "granted" ? "on" : "off");
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return [state, setState, refresh] as const;
}

// ---------------------------------------------------------------- dismiss memory (per browser, best effort)

const DISMISS_DAYS = 14;
function dismissed(key: string) {
  try {
    const at = Number(localStorage.getItem(key));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
}
function dismiss(key: string) {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {}
}

// ---------------------------------------------------------------- UI

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/**
 * Bottom popups for signed-in pages: first "turn on notifications", then
 * "install the app" (Android/desktop install prompt, or Add-to-Home-Screen
 * steps on iOS, where notifications only work in the installed app).
 * Also keeps this device's subscription in sync when permission is already granted.
 */
export function PwaPrompts() {
  const notify = useToast();
  const [push, setPush] = usePushState();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    registration().catch(() => {});

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      notify("اپلیکیشن نصب شد", "success");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if (isIos() && !isStandalone()) setIosHint(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [notify]);

  // Permission already granted (e.g. a new login on this device): re-link the subscription silently.
  useEffect(() => {
    if (pushSupported() && Notification.permission === "granted") enablePush().then((s) => s === "on" && setPush("on")).catch(() => {});
  }, [setPush]);

  async function turnOn() {
    setBusy(true);
    try {
      const result = await enablePush();
      setPush(result === "on" ? "on" : result === "denied" ? "denied" : "unsupported");
      if (result === "on") notify("اعلان‌ها روشن شد", "success");
      if (result === "denied") notify("اجازه‌ی اعلان داده نشد؛ از تنظیمات مرورگر می‌توانید فعالش کنید");
    } catch (err) {
      notify(err instanceof Error ? err.message : "خطایی رخ داد");
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
  }

  const close = (key: string) => {
    dismiss(key);
    setHidden((h) => ({ ...h, [key]: true }));
  };

  let banner: React.ReactNode = null;
  if (push === "off" && !hidden["pwa:push"] && !dismissed("pwa:push")) {
    banner = (
      <Banner
        icon="🔔"
        title="اعلان تسک‌های جدید"
        text="وقتی تسکی به شما واگذار شد یا تسک جدیدی ساخته شد، حتی اگر اپ بسته باشد خبردار شوید."
        action={busy ? "…" : "روشن کردن"}
        onAction={turnOn}
        onClose={() => close("pwa:push")}
      />
    );
  } else if (installEvent && !hidden["pwa:install"] && !dismissed("pwa:install")) {
    banner = (
      <Banner icon="📲" title="نصب تسک منیجر" text="اپ را روی دستگاهتان نصب کنید تا سریع‌تر باز شود و مثل یک برنامه کار کند." action="نصب" onAction={install} onClose={() => close("pwa:install")} />
    );
  } else if (iosHint && !hidden["pwa:ios"] && !dismissed("pwa:ios")) {
    banner = (
      <Banner
        icon="📲"
        title="نصب روی آیفون"
        text={
          <>
            در Safari دکمه‌ی <b>Share</b> (مربع با فلش رو به بالا) را بزنید و <b>Add to Home Screen</b> را انتخاب کنید. اعلان‌ها در آیفون فقط در اپ نصب‌شده کار می‌کنند.
          </>
        }
        onClose={() => close("pwa:ios")}
      />
    );
  }
  return banner;
}

function Banner({
  icon,
  title,
  text,
  action,
  onAction,
  onClose,
}: {
  icon: string;
  title: string;
  text: React.ReactNode;
  action?: string;
  onAction?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-md animate-[pwa-in_.25s_ease-out] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-4" role="dialog" aria-label={title}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{text}</p>
          <div className="mt-3 flex gap-2">
            {action && (
              <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={onAction}>
                {action}
              </button>
            )}
            <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={onClose}>
              {action ? "بعداً" : "متوجه شدم"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Header bell: shows whether this device gets notifications and toggles it. */
export function NotificationBell() {
  const notify = useToast();
  const [state, setState] = usePushState();
  if (state === "loading" || state === "unsupported") return null;

  async function toggle() {
    try {
      if (state === "on") {
        await disablePush();
        setState("off");
        notify("اعلان‌ها روی این دستگاه خاموش شد", "success");
      } else if (state === "denied") {
        notify("اعلان‌ها در تنظیمات مرورگر مسدود شده‌اند؛ از آیکون قفل کنار آدرس سایت اجازه دهید");
      } else {
        const result = await enablePush();
        setState(result === "on" ? "on" : result === "denied" ? "denied" : "off");
        if (result === "on") notify("اعلان‌ها روشن شد", "success");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "خطایی رخ داد");
    }
  }

  const on = state === "on";
  return (
    <button
      onClick={toggle}
      className={`btn-ghost !p-1.5 ${on ? "text-brand-600" : "text-slate-400"}`}
      title={on ? "اعلان‌ها روشن است (کلیک برای خاموش کردن)" : "روشن کردن اعلان‌ها"}
      aria-label={on ? "خاموش کردن اعلان‌ها" : "روشن کردن اعلان‌ها"}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        {!on && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}
