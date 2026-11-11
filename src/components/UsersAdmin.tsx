"use client";

import { useCallback, useEffect, useState } from "react";
import { Avatar } from "./Avatar";
import { useToast } from "./Toast";
import { useContextMenu, MenuButton, type MenuEntry } from "./ContextMenu";
import { api, errorMessage } from "@/lib/client";
import { faNum } from "@/lib/date";

const joined = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" });

interface AdminUser {
  id: string;
  name: string;
  email: string;
  color: string;
  avatar: string | null;
  createdAt: string;
  superAdmin: boolean;
  _count: { memberships: number; ownedBoards: number; assigned: number };
}

/** Super admin: every account, searchable, with inline rename (double-click, ✎ or right-click). */
export function UsersAdmin({ meId }: { meId: string }) {
  const notify = useToast();
  const openMenu = useContextMenu();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async (query: string) => {
    try {
      const { users } = await api<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`);
      setUsers(users);
    } catch (err) {
      notify(errorMessage(err));
    }
  }, [notify]);

  useEffect(() => {
    const t = setTimeout(() => load(q), 200);
    return () => clearTimeout(t);
  }, [q, load]);

  function startEdit(u: AdminUser) {
    setEditing(u.id);
    setDraft(u.name);
  }

  async function saveName(u: AdminUser) {
    const name = draft.trim();
    setEditing(null);
    if (!name || name === u.name) return;
    setUsers((list) => list?.map((x) => (x.id === u.id ? { ...x, name } : x)) ?? null);
    try {
      await api(`/api/admin/users/${u.id}`, { method: "PATCH", body: { name } });
      notify(`نام به «${name}» تغییر کرد`, "success");
    } catch (err) {
      notify(errorMessage(err));
      load(q);
    }
  }

  const menu = (u: AdminUser): MenuEntry[] => [
    { label: "ویرایش نام", onClick: () => startEdit(u) },
    { label: "کپی ایمیل", onClick: () => navigator.clipboard?.writeText(u.email).then(() => notify("ایمیل کپی شد", "success")) },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">مدیریت کاربران</h1>
          <p className="mt-1 text-sm text-slate-500">{users ? `${faNum(users.length)} کاربر` : "…"} · برای ویرایش نام دوبار کلیک یا کلیک راست کنید</p>
        </div>
        <input className="input !w-64" placeholder="جستجوی نام یا ایمیل…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {users === null ? (
          <p className="p-8 text-center text-sm text-slate-400">در حال بارگذاری…</p>
        ) : users.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">کاربری پیدا نشد</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3" onContextMenu={(e) => openMenu(e, menu(u))}>
                <Avatar user={{ ...u, name: editing === u.id ? draft || u.name : u.name }} />
                <div className="min-w-0 flex-1">
                  {editing === u.id ? (
                    <input
                      autoFocus
                      className="input !py-1"
                      maxLength={80}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => saveName(u)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") setEditing(null);
                      }}
                      aria-label={`نام ${u.name}`}
                    />
                  ) : (
                    <p className="flex items-center gap-2 truncate text-sm font-medium" onDoubleClick={() => startEdit(u)}>
                      {u.name}
                      {u.id === meId && <span className="text-slate-400">(شما)</span>}
                      {u.superAdmin && <span className="chip bg-brand-50 text-brand-700">ادمین کل</span>}
                    </p>
                  )}
                  <p className="truncate text-xs text-slate-400" dir="ltr">{u.email}</p>
                </div>
                <div className="hidden text-left text-xs text-slate-500 sm:block">
                  <p>{faNum(u._count.memberships)} برد · {faNum(u._count.assigned)} تسک</p>
                  <p className="text-slate-400">عضویت: {joined.format(new Date(u.createdAt))}</p>
                </div>
                {editing !== u.id && (
                  <button className="btn-ghost !p-1.5" onClick={() => startEdit(u)} aria-label={`ویرایش نام ${u.name}`} title="ویرایش نام">
                    ✎
                  </button>
                )}
                <MenuButton items={() => menu(u)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
