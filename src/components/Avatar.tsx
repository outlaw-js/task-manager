import type { UserLite } from "@/lib/types";

const SIZES = { sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm" };

export function Avatar({ user, size = "md", ring }: { user: Pick<UserLite, "name" | "color">; size?: keyof typeof SIZES; ring?: boolean }) {
  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("‌");
  return (
    <span
      title={user.name}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white ${SIZES[size]} ${
        ring ? "ring-2 ring-white" : ""
      }`}
      style={{ backgroundColor: user.color }}
    >
      {initials}
    </span>
  );
}

export function AvatarStack({ users, max = 3, size = "sm" }: { users: Pick<UserLite, "id" | "name" | "color">[]; max?: number; size?: keyof typeof SIZES }) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <div className="flex -space-x-1.5 space-x-reverse">
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} ring />
      ))}
      {rest > 0 && (
        <span className={`inline-flex items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600 ring-2 ring-white ${SIZES[size]}`}>
          +{rest.toLocaleString("fa-IR")}
        </span>
      )}
    </div>
  );
}
