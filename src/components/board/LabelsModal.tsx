"use client";

import { useState } from "react";
import { Modal } from "../Modal";
import { useToast } from "../Toast";
import { api, errorMessage } from "@/lib/client";
import type { BoardT, LabelT } from "@/lib/types";

export function LabelsModal({ board, open, onClose, onChanged }: { board: BoardT; open: boolean; onClose: () => void; onChanged: () => void }) {
  const notify = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      onChanged();
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  const usage = (l: LabelT) => board.tasks.filter((t) => t.labels.some((x) => x.id === l.id)).length;

  return (
    <Modal open={open} onClose={onClose} title="مدیریت برچسب‌ها">
      <ul className="mb-5 space-y-2">
        {board.labels.map((l) => (
          <li key={l.id} className="flex items-center gap-2">
            <input
              type="color"
              defaultValue={l.color}
              className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
              onBlur={(e) => e.target.value !== l.color && run(() => api(`/api/labels/${l.id}`, { method: "PATCH", body: { color: e.target.value } }))}
              aria-label="رنگ برچسب"
            />
            <input
              className="input !py-1.5"
              defaultValue={l.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== l.name) run(() => api(`/api/labels/${l.id}`, { method: "PATCH", body: { name: v } }));
              }}
            />
            <span className="w-14 shrink-0 text-center text-xs text-slate-400">{usage(l).toLocaleString("fa-IR")} تسک</span>
            <button
              className="btn-danger !px-2 !py-1 text-xs"
              onClick={() => confirm(`برچسب «${l.name}» حذف شود؟`) && run(() => api(`/api/labels/${l.id}`, { method: "DELETE" }))}
            >
              حذف
            </button>
          </li>
        ))}
        {board.labels.length === 0 && <li className="text-center text-sm text-slate-400">برچسبی وجود ندارد</li>}
      </ul>
      <form
        className="flex items-center gap-2 rounded-xl bg-slate-50 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          run(async () => {
            await api(`/api/boards/${board.id}/labels`, { body: { name, color } });
            setName("");
          });
        }}
      >
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="رنگ" />
        <input className="input !py-1.5" placeholder="نام برچسب جدید" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary !py-1.5 shrink-0">افزودن</button>
      </form>
    </Modal>
  );
}
