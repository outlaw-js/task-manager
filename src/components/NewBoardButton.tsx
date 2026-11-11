"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "./Modal";
import { api, errorMessage } from "@/lib/client";

export function NewBoardButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { board } = await api<{ board: { id: string } }>("/api/boards", { body: { name, description } });
      router.push(`/boards/${board.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <span className="text-lg leading-none">+</span> برد جدید
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="ساخت برد جدید">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="board-name">نام برد</label>
            <input id="board-name" className="input" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: پروژه وب‌سایت" />
          </div>
          <div>
            <label className="label" htmlFor="board-desc">توضیحات (اختیاری)</label>
            <textarea id="board-desc" className="input min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <p className="text-xs text-slate-500">ستون‌های پیش‌فرض و چند برچسب اولیه به‌صورت خودکار ساخته می‌شوند.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>انصراف</button>
            <button className="btn-primary" disabled={loading}>{loading ? "در حال ساخت…" : "ساخت برد"}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
