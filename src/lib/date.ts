const short = new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" });
const full = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatShort = (iso: string) => short.format(new Date(iso));
export const formatFull = (iso: string) => full.format(new Date(iso));
export const faNum = (n: number) => n.toLocaleString("fa-IR");

export type DeadlineState = "overdue" | "soon" | "later";

export function deadlineState(iso: string, now = Date.now()): DeadlineState {
  const t = new Date(iso).getTime();
  if (t < now) return "overdue";
  if (t - now < 24 * 60 * 60 * 1000) return "soon";
  return "later";
}

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
/** "۵ دقیقه پیش", "دیروز", … falling back to a full date after a week. */
export function timeAgo(iso: string, now = Date.now()) {
  const sec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 45) return "همین الان";
  if (abs < 3600) return rtf.format(Math.round(sec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), "hour");
  if (abs < 7 * 86400) return rtf.format(Math.round(sec / 86400), "day");
  return formatFull(iso);
}
