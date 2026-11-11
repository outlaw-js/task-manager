import { avatarUrl } from "@/lib/types";

const SIZES = { sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm", xl: "h-20 w-20 text-2xl" };

type AvatarUser = { id?: string; name: string; color: string; avatar?: string | null };

export function Avatar({ user, size = "md", ring }: { user: AvatarUser; size?: keyof typeof SIZES; ring?: boolean }) {
  const src = user.id ? avatarUrl({ id: user.id, avatar: user.avatar }) : null;
  const cls = `inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-bold text-white ${SIZES[size]} ${ring ? "ring-2 ring-white" : ""}`;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={user.name} title={user.name} loading="lazy" draggable={false} className={`${cls} bg-slate-200 object-cover`} />
    );
  }
  const initials = user.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("‌");
  return (
    <span title={user.name} className={cls} style={{ backgroundColor: user.color }}>
      {initials}
    </span>
  );
}

export function AvatarStack({ users, max = 3, size = "sm" }: { users: (AvatarUser & { id: string })[]; max?: number; size?: keyof typeof SIZES }) {
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
