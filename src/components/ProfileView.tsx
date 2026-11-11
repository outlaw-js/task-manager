"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import { disablePush } from "./PwaPrompts";
import { api, errorMessage } from "@/lib/client";
import { prepareImage, uploadFile } from "@/lib/image";
import type { UserLite } from "@/lib/types";

interface OwnedBoard {
  id: string;
  name: string;
  newOwner: { id: string; name: string } | null;
}

export function ProfileView({ user }: { user: UserLite }) {
  const router = useRouter();
  const notify = useToast();

  // ---- photo
  const [photo, setPhoto] = useState(user.avatar ?? null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  async function changePhoto(file: File | undefined) {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const small = await prepareImage(file, { square: true, maxDim: 512, quality: 0.9 });
      const { user: updated } = await uploadFile<{ user: UserLite }>("/api/auth/avatar", small);
      setPhoto(updated.avatar ?? null);
      notify("عکس پروفایل ذخیره شد", "success");
      router.refresh();
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function removePhoto() {
    if (!confirm("عکس پروفایل حذف شود؟")) return;
    try {
      await api("/api/auth/avatar", { method: "DELETE" });
      setPhoto(null);
      router.refresh();
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  // ---- name
  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      await api("/api/auth/me", { method: "PATCH", body: { name } });
      notify("نام ذخیره شد", "success");
      router.refresh();
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setSavingName(false);
    }
  }

  // ---- password
  const [pw, setPw] = useState({ current: "", next: "", repeat: "" });
  const [savingPw, setSavingPw] = useState(false);
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.repeat) return notify("تکرار رمز جدید یکسان نیست");
    setSavingPw(true);
    try {
      await api("/api/auth/password", { body: { currentPassword: pw.current, newPassword: pw.next } });
      setPw({ current: "", next: "", repeat: "" });
      notify("رمز عبور تغییر کرد", "success");
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setSavingPw(false);
    }
  }

  // ---- delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [plan, setPlan] = useState<OwnedBoard[] | null>(null);
  const [deletePw, setDeletePw] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function openDelete() {
    setDeleteOpen(true);
    setPlan(null);
    try {
      const { ownedBoards } = await api<{ ownedBoards: OwnedBoard[] }>("/api/auth/me?deletePlan=1");
      setPlan(ownedBoards);
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleting(true);
    try {
      await disablePush().catch(() => {});
      await api("/api/auth/me", { method: "DELETE", body: { password: deletePw } });
      window.location.href = "/login";
    } catch (err) {
      notify(errorMessage(err));
      setDeleting(false);
    }
  }

  const transferred = plan?.filter((b) => b.newOwner) ?? [];
  const removed = plan?.filter((b) => !b.newOwner) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="group relative shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-brand-500"
          onClick={() => photoInput.current?.click()}
          disabled={uploadingPhoto}
          aria-label="تغییر عکس پروفایل"
          title="تغییر عکس پروفایل"
        >
          <Avatar user={{ ...user, name: name || user.name, avatar: photo }} size="xl" />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-900/45 text-white opacity-0 transition group-hover:opacity-100">
            {uploadingPhoto ? (
              <span className="text-xs">در حال آپلود…</span>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            )}
          </span>
        </button>
        <input ref={photoInput} type="file" accept="image/*" hidden onChange={(e) => (changePhoto(e.target.files?.[0]), (e.target.value = ""))} />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{user.name}</h1>
          <p className="truncate text-sm text-slate-500" dir="ltr">{user.email}</p>
          <div className="mt-1.5 flex gap-1">
            <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => photoInput.current?.click()} disabled={uploadingPhoto}>
              {photo ? "تغییر عکس" : "افزودن عکس"}
            </button>
            {photo && (
              <button type="button" className="btn-danger !px-2 !py-1 text-xs" onClick={removePhoto}>
                حذف عکس
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-bold">نام نمایشی</h2>
        <form onSubmit={saveName} className="flex flex-col gap-2 sm:flex-row">
          <input className="input" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} aria-label="نام" />
          <button className="btn-primary shrink-0" disabled={savingName || !name.trim() || name.trim() === user.name}>
            {savingName ? "در حال ذخیره…" : "ذخیره"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-bold">تغییر رمز عبور</h2>
        <form onSubmit={savePassword} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="pw-current">رمز فعلی</label>
            <input id="pw-current" type="password" dir="ltr" autoComplete="current-password" className="input text-left" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="pw-new">رمز جدید (حداقل ۶)</label>
            <input id="pw-new" type="password" dir="ltr" autoComplete="new-password" className="input text-left" required minLength={6} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="pw-repeat">تکرار رمز جدید</label>
            <input id="pw-repeat" type="password" dir="ltr" autoComplete="new-password" className="input text-left" required minLength={6} value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} />
          </div>
          {pw.repeat && pw.next !== pw.repeat && <p className="text-xs text-red-600 sm:col-span-2">تکرار رمز یکسان نیست</p>}
          <div className="sm:col-span-2">
            <button className="btn-primary" disabled={savingPw}>{savingPw ? "در حال ذخیره…" : "تغییر رمز"}</button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-red-700">حذف حساب کاربری</h2>
        <p className="mt-1 text-sm text-slate-500">حساب و عضویت‌هایتان برای همیشه حذف می‌شود. تسک‌هایی که ساخته‌اید در بردها باقی می‌مانند.</p>
        <button className="btn mt-4 border border-red-300 text-red-600 hover:bg-red-50" onClick={openDelete}>حذف حساب من</button>
      </section>

      <Modal open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} title="حذف حساب کاربری">
        <form onSubmit={deleteAccount} className="space-y-4 text-sm">
          {plan === null ? (
            <p className="text-slate-500">در حال بررسی بردهای شما…</p>
          ) : (
            <>
              {transferred.length > 0 && (
                <div className="rounded-lg bg-amber-50 p-3 text-amber-800">
                  <p className="font-medium">مالکیت این بردها منتقل می‌شود:</p>
                  <ul className="mt-1 list-inside list-disc">
                    {transferred.map((b) => (
                      <li key={b.id}>«{b.name}» ← {b.newOwner!.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {removed.length > 0 && (
                <div className="rounded-lg bg-red-50 p-3 text-red-700">
                  <p className="font-medium">این بردها عضو دیگری ندارند و با همه‌ی تسک‌هایشان حذف می‌شوند:</p>
                  <ul className="mt-1 list-inside list-disc">
                    {removed.map((b) => (
                      <li key={b.id}>«{b.name}»</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-slate-600">این کار قابل بازگشت نیست.</p>
            </>
          )}
          <div>
            <label className="label" htmlFor="del-pw">رمز عبور</label>
            <input id="del-pw" type="password" dir="ltr" autoComplete="current-password" className="input text-left" required value={deletePw} onChange={(e) => setDeletePw(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="del-confirm">برای تأیید، کلمه‌ی «حذف» را بنویسید</label>
            <input id="del-confirm" className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setDeleteOpen(false)} disabled={deleting}>انصراف</button>
            <button className="btn bg-red-600 text-white hover:bg-red-700" disabled={deleting || plan === null || confirmText.trim() !== "حذف" || !deletePw}>
              {deleting ? "در حال حذف…" : "حذف همیشگی حساب"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
