"use client";

import { Avatar } from "../Avatar";
import { MultiSelect } from "./MultiSelect";
import { RangePicker } from "./JalaliDatePicker";
import { DEADLINE_OPTIONS, NO_ASSIGNEE, SORT_OPTIONS, activeFilterCount, EMPTY_FILTERS, type DeadlineFilter, type Filters, type SortMode } from "@/lib/filters";
import { faNum } from "@/lib/date";
import { PRIORITIES, type BoardT, type Priority, type UserLite } from "@/lib/types";

interface Props {
  board: BoardT;
  me: UserLite;
  filters: Filters;
  onFilters: (f: Filters) => void;
  sort: SortMode;
  onSort: (s: SortMode) => void;
  shown: number;
  total: number;
}

export function FilterBar({ board, me, filters, onFilters, sort, onSort, shown, total }: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onFilters({ ...filters, [key]: value });
  const onlyMine = filters.assignees.length === 1 && filters.assignees[0] === me.id;
  const count = activeFilterCount(filters);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
      <div className="relative">
        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input className="input !w-48 !py-1.5 !pr-8" placeholder="جستجو در تسک‌ها…" value={filters.q} onChange={(e) => set("q", e.target.value)} />
      </div>

      <button
        className={`btn !py-1.5 border text-xs ${onlyMine ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
        onClick={() => set("assignees", onlyMine ? [] : [me.id])}
      >
        کارهای من
      </button>

      <MultiSelect
        label="مسئول"
        value={filters.assignees}
        onChange={(v) => set("assignees", v)}
        options={[
          { value: NO_ASSIGNEE, label: "بدون مسئول" },
          ...board.members.map(({ user }) => ({ value: user.id, label: user.name, icon: <Avatar user={user} size="sm" /> })),
        ]}
      />
      <MultiSelect
        label="برچسب"
        value={filters.labels}
        onChange={(v) => set("labels", v)}
        options={board.labels.map((l) => ({ value: l.id, label: l.name, icon: <span className="h-3 w-3 rounded-full" style={{ backgroundColor: l.color }} /> }))}
      />
      <MultiSelect
        label="اولویت"
        value={filters.priorities}
        onChange={(v) => set("priorities", v as Priority[])}
        options={PRIORITIES.map((p) => ({ value: p.value, label: p.label, icon: <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} /> }))}
      />

      <select
        className={`input !w-auto !py-1.5 text-xs ${filters.deadline !== "all" ? "!border-brand-500 !bg-brand-50 text-brand-700" : ""}`}
        value={filters.deadline}
        onChange={(e) => onFilters({ ...filters, deadline: e.target.value as DeadlineFilter, range: null })}
      >
        {DEADLINE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {filters.deadline === "range" && <RangePicker value={filters.range} onChange={(r) => set("range", r)} />}

      {count > 0 && (
        <button className="btn-ghost !py-1.5 text-xs text-red-600" onClick={() => onFilters(EMPTY_FILTERS)}>
          حذف فیلترها ({faNum(count)})
        </button>
      )}

      <span className="flex-1" />

      <span className="text-xs text-slate-500">
        {shown === total ? `${faNum(total)} تسک` : `${faNum(shown)} از ${faNum(total)} تسک`}
      </span>
      <label className="flex items-center gap-1.5 text-xs text-slate-500">
        مرتب‌سازی:
        <select className="input !w-auto !py-1.5 text-xs" value={sort} onChange={(e) => onSort(e.target.value as SortMode)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}
