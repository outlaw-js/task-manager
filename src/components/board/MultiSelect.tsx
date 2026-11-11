"use client";

import { useEffect, useRef, useState } from "react";
import { matches } from "../SearchSelect";

export interface Option {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export function MultiSelect({ label, options, value, onChange }: { label: string; options: Option[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const shown = query.trim() ? options.filter((o) => matches(o.label, query)) : options;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => {
    if (!open) setQuery("");
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
        <div className="absolute right-0 top-10 z-30 max-h-80 w-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {options.length > 4 && (
            <input
              autoFocus
              className="input sticky top-0 z-10 mb-1 !py-1.5 text-xs"
              placeholder="جستجو…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                // Enter toggles the only remaining match.
                if (e.key === "Enter" && shown.length === 1) {
                  const v = shown[0].value;
                  onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
                }
              }}
            />
          )}
          {shown.length === 0 && <p className="px-2 py-3 text-center text-xs text-slate-400">موردی پیدا نشد</p>}
          {shown.map((o) => {
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
