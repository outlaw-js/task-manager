"use client";

import { useState } from "react";
import { Modal } from "../Modal";
import { Avatar } from "../Avatar";
import { useToast } from "../Toast";
import { api, errorMessage } from "@/lib/client";
import type { BoardT, MemberT, UserLite } from "@/lib/types";

interface Props {
  board: BoardT;
  me: UserLite;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function MembersModal({ board, me, open, onClose, onChanged }: Props) {
  const notify = useToast();
  const isOwner = board.ownerId === me.id;
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [newAccount, setNewAccount] = useState(false);
  const [loading, setLoading] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const body = newAccount ? form : { email: form.email };
      const { created } = await api<{ member: MemberT; created: boolean }>(`/api/boards/${board.id}/members`, { body });
      notify(created ? "حساب کاربری ساخته شد و به برد اضافه شد" : "عضو به برد اضافه شد", "success");
      setForm({ email: "", name: "", password: "" });
      setNewAccount(false);
      onChanged();
    } catch (err) {
      const msg = errorMessage(err);
      // No account for that email: offer to create one right here.
      if (msg.includes("وجود ندارد")) setNewAccount(true);
      notify(msg);
    } finally {
      setLoading(false);
    }
  }

  async function remove(member: MemberT) {
    const self = member.user.id === me.id;
    if (!confirm(self ? "از این برد خارج می‌شوید؟" : `${member.user.name} از برد حذف شود؟`)) return;
    try {
      await api(`/api/boards/${board.id}/members/${member.user.id}`, { method: "DELETE" });
      if (self) window.location.href = "/";
      else onChanged();
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="اعضای برد">
      <ul className="mb-5 divide-y divide-slate-100">
        {board.members.map((m) => (
          <li key={m.user.id} className="flex items-center gap-3 py-2.5">
            <Avatar user={m.user} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.user.name} {m.user.id === me.id && <span className="text-slate-400">(شما)</span>}
              </p>
              <p className="truncate text-xs text-slate-400" dir="ltr">{m.user.email}</p>
            </div>
            {m.role === "OWNER" ? (
              <span className="chip bg-brand-50 text-brand-700">مالک</span>
            ) : (
              (isOwner || m.user.id === me.id) && (
                <button className="btn-danger !px-2 !py-1 text-xs" onClick={() => remove(m)}>
                  {m.user.id === me.id ? "خروج" : "حذف"}
                </button>
              )
            )}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <form onSubmit={add} className="space-y-3 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-bold">افزودن فرد جدید</p>
          <input type="email" dir="ltr" className="input text-left" placeholder="email@example.com" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" className="accent-brand-600" checked={newAccount} onChange={(e) => setNewAccount(e.target.checked)} />
            این شخص هنوز حساب ندارد؛ برایش حساب بساز
          </label>
          {newAccount && (
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="input" placeholder="نام" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input type="password" dir="ltr" className="input text-left" placeholder="رمز عبور (حداقل ۶)" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          )}
          <button className="btn-primary w-full" disabled={loading}>{loading ? "در حال افزودن…" : "افزودن به برد"}</button>
        </form>
      ) : (
        <p className="text-center text-xs text-slate-400">فقط مالک برد می‌تواند عضو جدید اضافه کند.</p>
      )}
    </Modal>
  );
}
