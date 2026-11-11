"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "../Modal";
import { Avatar } from "../Avatar";
import { useToast } from "../Toast";
import { useContextMenu, MenuButton, type MenuEntry } from "../ContextMenu";
import { api, errorMessage } from "@/lib/client";
import { ROLE_LABELS, canManage, type BoardT, type MemberT, type Role, type UserLite } from "@/lib/types";

interface Props {
  board: BoardT;
  me: UserLite;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const ROLE_STYLES: Record<Role, string> = {
  OWNER: "bg-brand-50 text-brand-700",
  ADMIN: "bg-amber-50 text-amber-700",
  MEMBER: "bg-slate-100 text-slate-600",
};

const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s.trim());

export function MembersModal({ board, me, open, onClose, onChanged }: Props) {
  const notify = useToast();
  const openMenu = useContextMenu();
  const myRole = board.members.find((m) => m.user.id === me.id)?.role;
  const isOwner = myRole === "OWNER";
  const manager = canManage(myRole);

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

  async function setRole(member: MemberT, role: Role) {
    if (member.role === role) return;
    try {
      await api(`/api/boards/${board.id}/members/${member.user.id}`, { method: "PATCH", body: { role } });
      notify(`${member.user.name} حالا ${ROLE_LABELS[role]} است`, "success");
      onChanged();
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  function memberMenu(m: MemberT): MenuEntry[] {
    if (m.role === "OWNER") return [];
    const self = m.user.id === me.id;
    const canRemove = self || isOwner || (myRole === "ADMIN" && m.role === "MEMBER");
    const items: MenuEntry[] = [];
    if (isOwner) {
      items.push({
        label: "نقش",
        children: (["ADMIN", "MEMBER"] as Role[]).map((r) => ({ label: ROLE_LABELS[r], checked: m.role === r, onClick: () => setRole(m, r) })),
      });
    }
    if (canRemove) {
      if (items.length) items.push("separator");
      items.push({ label: self ? "خروج از برد" : "حذف از برد", danger: true, onClick: () => remove(m) });
    }
    return items;
  }

  return (
    <Modal open={open} onClose={onClose} title="اعضای برد">
      <ul className="mb-5 divide-y divide-slate-100">
        {board.members.map((m) => {
          const items = memberMenu(m);
          return (
            <li
              key={m.user.id}
              className="flex items-center gap-3 py-2.5"
              onContextMenu={(e) => items.length && openMenu(e, items)}
            >
              <Avatar user={m.user} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.user.name} {m.user.id === me.id && <span className="text-slate-400">(شما)</span>}
                </p>
                <p className="truncate text-xs text-slate-400" dir="ltr">{m.user.email}</p>
              </div>
              {isOwner && m.role !== "OWNER" ? (
                <select
                  className="input !w-auto !py-1 text-xs"
                  value={m.role}
                  onChange={(e) => setRole(m, e.target.value as Role)}
                  aria-label={`نقش ${m.user.name}`}
                >
                  <option value="MEMBER">{ROLE_LABELS.MEMBER}</option>
                  <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                </select>
              ) : (
                <span className={`chip ${ROLE_STYLES[m.role]}`}>{ROLE_LABELS[m.role]}</span>
              )}
              {items.length > 0 && <MenuButton items={() => memberMenu(m)} />}
            </li>
          );
        })}
      </ul>

      {manager ? (
        <AddMember board={board} isOwner={isOwner} onAdded={onChanged} />
      ) : (
        <p className="text-center text-xs text-slate-400">فقط مالک یا ادمین برد می‌تواند عضو جدید اضافه کند.</p>
      )}
      <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">
        ادمین: مدیریت اعضا، ستون‌ها و نام برد · کاربر: کار با تسک‌ها · روی هر عضو کلیک راست کنید
      </p>
    </Modal>
  );
}

/** Autocomplete over existing accounts; typing a new email offers to create the account. */
function AddMember({ board, isOwner, onAdded }: { board: BoardT; isOwner: boolean; onAdded: () => void }) {
  const notify = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserLite[]>([]);
  const [searching, setSearching] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<UserLite | { newEmail: string } | null>(null);
  const [account, setAccount] = useState({ name: "", password: "" });
  const [role, setRole] = useState<Role>("MEMBER");
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search; the latest request wins.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { users } = await api<{ users: UserLite[] }>(`/api/boards/${board.id}/candidates?q=${encodeURIComponent(q)}`);
        if (!cancelled) setResults(users);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, board.id]);

  useEffect(() => {
    if (!listOpen) return;
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setListOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [listOpen]);

  useEffect(() => setActive(0), [results]);

  const q = query.trim().toLowerCase();
  const offerNew = isEmail(q) && !results.some((u) => u.email === q) && !board.members.some((m) => m.user.email === q);
  const rows = results.length + (offerNew ? 1 : 0);

  function choose(i: number) {
    if (i < results.length) setPicked(results[i]);
    else if (offerNew) setPicked({ newEmail: q });
    setListOpen(false);
    setQuery("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setLoading(true);
    try {
      const body =
        "newEmail" in picked
          ? { email: picked.newEmail, name: account.name, password: account.password, role }
          : { email: picked.email, role };
      const { created } = await api<{ member: MemberT; created: boolean }>(`/api/boards/${board.id}/members`, { body });
      notify(created ? "حساب کاربری ساخته شد و به برد اضافه شد" : "عضو به برد اضافه شد", "success");
      setPicked(null);
      setAccount({ name: "", password: "" });
      setRole("MEMBER");
      onAdded();
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-slate-50 p-4">
      <p className="text-sm font-bold">افزودن فرد جدید</p>

      {picked ? (
        <div className="flex items-center gap-3 rounded-lg border border-brand-500/40 bg-white px-3 py-2">
          {"newEmail" in picked ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm">+</span>
          ) : (
            <Avatar user={picked} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{"newEmail" in picked ? "حساب جدید" : picked.name}</p>
            <p className="truncate text-xs text-slate-400" dir="ltr">{"newEmail" in picked ? picked.newEmail : picked.email}</p>
          </div>
          <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setPicked(null)}>تغییر</button>
        </div>
      ) : (
        <div className="relative" ref={boxRef}>
          <input
            role="combobox"
            aria-expanded={listOpen}
            className="input"
            placeholder="جستجوی نام یا ایمیل…"
            value={query}
            autoComplete="off"
            onFocus={() => setListOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setListOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                if (rows) setActive((a) => (e.key === "ArrowDown" ? (a + 1) % rows : (a - 1 + rows) % rows));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (rows) choose(active);
              } else if (e.key === "Escape" && listOpen) {
                e.stopPropagation();
                setListOpen(false);
              }
            }}
          />
          {listOpen && q && (
            <ul role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              {results.map((u, i) => (
                <li
                  key={u.id}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 ${i === active ? "bg-slate-100" : ""}`}
                >
                  <Avatar user={u} size="sm" />
                  <span className="truncate text-sm">{u.name}</span>
                  <span className="ms-auto truncate text-xs text-slate-400" dir="ltr">{u.email}</span>
                </li>
              ))}
              {offerNew && (
                <li
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(results.length)}
                  onClick={() => choose(results.length)}
                  className={`cursor-pointer rounded-lg px-2 py-2 text-sm text-brand-700 ${active === results.length ? "bg-brand-50" : ""}`}
                >
                  + ساخت حساب جدید برای <span dir="ltr">{q}</span>
                </li>
              )}
              {rows === 0 && (
                <li className="px-2 py-3 text-center text-xs text-slate-400">
                  {searching ? "در حال جستجو…" : "کاربری پیدا نشد؛ برای ساخت حساب جدید، ایمیل کامل را وارد کنید"}
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {picked && "newEmail" in picked && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input" placeholder="نام" required value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} />
          <input type="password" dir="ltr" className="input text-left" placeholder="رمز عبور (حداقل ۶)" required minLength={6} value={account.password} onChange={(e) => setAccount({ ...account, password: e.target.value })} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-600" htmlFor="new-member-role">نقش:</label>
        <select id="new-member-role" className="input !w-auto !py-1.5 text-xs" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="MEMBER">{ROLE_LABELS.MEMBER}</option>
          {isOwner && <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>}
        </select>
        <button className="btn-primary flex-1" disabled={loading || !picked}>{loading ? "در حال افزودن…" : "افزودن به برد"}</button>
      </div>
    </form>
  );
}
