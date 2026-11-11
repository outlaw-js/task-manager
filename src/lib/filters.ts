import type { Priority, TaskT } from "./types";
import { priorityMeta } from "./types";
import { endOfDay, startOfDay } from "./date";

export const NO_ASSIGNEE = "__none";

export type DeadlineFilter = "all" | "overdue" | "today" | "week" | "none" | "range";
export type SortMode = "manual" | "deadline" | "priority" | "newest" | "title";

export interface Filters {
  q: string;
  assignees: string[];
  labels: string[];
  priorities: Priority[];
  deadline: DeadlineFilter;
  range: [string, string] | null;
}

export const EMPTY_FILTERS: Filters = { q: "", assignees: [], labels: [], priorities: [], deadline: "all", range: null };

export const DEADLINE_OPTIONS: { value: DeadlineFilter; label: string }[] = [
  { value: "all", label: "همه ددلاین‌ها" },
  { value: "overdue", label: "گذشته از موعد" },
  { value: "today", label: "امروز" },
  { value: "week", label: "۷ روز آینده" },
  { value: "none", label: "بدون ددلاین" },
  { value: "range", label: "بازه دلخواه…" },
];

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "manual", label: "ترتیب دستی" },
  { value: "deadline", label: "نزدیک‌ترین ددلاین" },
  { value: "priority", label: "بیشترین اولویت" },
  { value: "newest", label: "جدیدترین" },
  { value: "title", label: "عنوان (الفبا)" },
];

export function activeFilterCount(f: Filters) {
  return (
    (f.q.trim() ? 1 : 0) +
    (f.assignees.length ? 1 : 0) +
    (f.labels.length ? 1 : 0) +
    (f.priorities.length ? 1 : 0) +
    (f.deadline !== "all" ? 1 : 0)
  );
}

export function matchesFilters(task: TaskT, f: Filters, now = new Date()) {
  const q = f.q.trim().toLowerCase();
  if (q && !task.title.toLowerCase().includes(q) && !(task.description ?? "").toLowerCase().includes(q)) return false;

  if (f.assignees.length) {
    const ok = f.assignees.some((id) =>
      id === NO_ASSIGNEE ? task.assignees.length === 0 : task.assignees.some((a) => a.id === id),
    );
    if (!ok) return false;
  }

  if (f.labels.length && !task.labels.some((l) => f.labels.includes(l.id))) return false;
  if (f.priorities.length && !f.priorities.includes(task.priority)) return false;

  if (f.deadline !== "all") {
    const d = task.deadline ? new Date(task.deadline) : null;
    switch (f.deadline) {
      case "none":
        if (d) return false;
        break;
      case "overdue":
        if (!d || d >= now) return false;
        break;
      case "today":
        if (!d || d < startOfDay(now) || d > endOfDay(now)) return false;
        break;
      case "week": {
        const until = endOfDay(new Date(now.getTime() + 7 * 864e5));
        if (!d || d < startOfDay(now) || d > until) return false;
        break;
      }
      case "range":
        if (f.range) {
          if (!d || d < startOfDay(new Date(f.range[0])) || d > endOfDay(new Date(f.range[1]))) return false;
        }
        break;
    }
  }
  return true;
}

export function compareTasks(mode: SortMode) {
  return (a: TaskT, b: TaskT) => {
    switch (mode) {
      case "deadline": {
        // Tasks without a deadline go last.
        const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return da - db || a.position - b.position;
      }
      case "priority":
        return priorityMeta(b.priority).weight - priorityMeta(a.priority).weight || a.position - b.position;
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "title":
        return a.title.localeCompare(b.title, "fa");
      default:
        return a.position - b.position;
    }
  };
}
