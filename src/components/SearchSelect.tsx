"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  /** Extra text that is searched and shown dimmed, e.g. an email. */
  hint?: string;
  icon?: React.ReactNode;
  /** Chip colour for the selected value. */
  color?: string;
}

/** Case- and Persian/Arabic-letter-insensitive match. */
export function matches(text: string, query: string) {
  const norm = (s: string) => s.toLowerCase().replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/‌/g, " ").trim();
  return norm(text).includes(norm(query));
}

interface Props {
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  /** Offers a "create" row for text that matches nothing; resolves to the new option's value. */
  onCreate?: (text: string) => Promise<string | undefined>;
  createLabel?: (text: string) => string;
  id?: string;
}

/** Multi-select with autocomplete search: chips for the selection, a filtered list while typing. */
export function SearchSelect({ options, value, onChange, placeholder = "جستجو…", emptyText = "موردی پیدا نشد", onCreate, createLabel, id }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = value.map((v) => options.find((o) => o.value === v)).filter(Boolean) as SelectOption[];
  const filtered = useMemo(
    () => (query.trim() ? options.filter((o) => matches(o.label, query) || (o.hint && matches(o.hint, query))) : options),
    [options, query],
  );
  const canCreate = !!onCreate && query.trim() !== "" && !options.some((o) => matches(o.label, query) && o.label.trim().length === query.trim().length);
  const rowCount = filtered.length + (canCreate ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  async function create() {
    if (!onCreate || creating) return;
    setCreating(true);
    try {
      const newValue = await onCreate(query.trim());
      if (newValue) onChange([...value, newValue]);
      setQuery("");
    } finally {
      setCreating(false);
    }
  }

  function choose(row: number) {
    if (row < filtered.length) {
      toggle(filtered[row].value);
      setQuery("");
    } else if (canCreate) create();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (rowCount) setActive((a) => (e.key === "ArrowDown" ? (a + 1) % rowCount : (a - 1 + rowCount) % rowCount));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && rowCount) choose(active);
      else setOpen(true);
    } else if (e.key === "Escape" && open) {
      // Close the list without closing a surrounding modal.
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      setOpen(false);
    } else if (e.key === "Backspace" && !query && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <div
        className={`flex min-h-10 cursor-text flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 transition ${
          open ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-300"
        }`}
        onMouseDown={(e) => {
          if (e.target === inputRef.current) return;
          e.preventDefault();
          inputRef.current?.focus();
          setOpen(true);
        }}
      >
        {selected.map((o) => (
          <span
            key={o.value}
            className="chip gap-1.5 border !py-0.5 ps-1 text-[13px]"
            style={o.color ? { backgroundColor: `${o.color}1f`, borderColor: `${o.color}55`, color: o.color } : { backgroundColor: "#eef2ff", borderColor: "#c7d2fe", color: "#4338ca" }}
          >
            {o.icon}
            {o.label}
            <button
              type="button"
              aria-label={`حذف ${o.label}`}
              className="rounded-full px-0.5 leading-none opacity-60 hover:opacity-100"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => toggle(o.value)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-slate-400"
          placeholder={selected.length ? "" : placeholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
      </div>

      {open && (
        <ul ref={listRef} role="listbox" className="scrollbar-thin absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          {filtered.map((o, i) => {
            const on = value.includes(o.value);
            return (
              <li
                key={o.value}
                data-row={i}
                role="option"
                aria-selected={on}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${i === active ? "bg-slate-100" : ""}`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"}`}>
                  {on && "✓"}
                </span>
                {o.icon}
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="ms-auto truncate text-xs text-slate-400" dir="ltr">{o.hint}</span>}
              </li>
            );
          })}
          {canCreate && (
            <li
              data-row={filtered.length}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(filtered.length)}
              onClick={create}
              className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-brand-700 ${active === filtered.length ? "bg-brand-50" : ""}`}
            >
              <span className="flex h-4 w-4 items-center justify-center text-base leading-none">+</span>
              {creating ? "در حال ساخت…" : createLabel ? createLabel(query.trim()) : `ساخت «${query.trim()}»`}
            </li>
          )}
          {rowCount === 0 && <li className="px-2 py-3 text-center text-xs text-slate-400">{emptyText}</li>}
        </ul>
      )}
    </div>
  );
}
