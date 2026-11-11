"use client";

import { useEffect, useRef, useState } from "react";

export interface Option {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export function MultiSelect({ label, options, value, onChange }: { label: string; options: Option[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const active = value.length > 0;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`btn !py-1.5 border text-xs ${active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
      >
        {label}
        {active && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] text-white">{value.length.toLocaleString("fa-IR")}</span>}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 max-h-72 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {options.map((o) => {
            const checked = value.includes(o.value);
            return (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="accent-brand-600"
                  checked={checked}
                  onChange={() => onChange(checked ? value.filter((v) => v !== o.value) : [...value, o.value])}
                />
                {o.icon}
                <span className="truncate">{o.label}</span>
              </label>
            );
          })}
          {active && (
            <button className="mt-1 w-full rounded-lg px-2 py-1.5 text-right text-xs text-slate-500 hover:bg-slate-50" onClick={() => onChange([])}>
              پاک کردن انتخاب
            </button>
          )}
        </div>
      )}
    </div>
  );
}
