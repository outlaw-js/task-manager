export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface UserLite {
  id: string;
  name: string;
  email: string;
  color: string;
  /** Storage key of the profile photo; doubles as a cache-buster in the URL. */
  avatar?: string | null;
}

export const avatarUrl = (user: { id: string; avatar?: string | null }) =>
  user.avatar ? `/api/avatars/${user.id}?v=${encodeURIComponent(user.avatar.slice(-16))}` : null;

export interface LabelT {
  id: string;
  name: string;
  color: string;
}

export interface AttachmentT {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploaderId: string | null;
  createdAt: string;
}

export const attachmentUrl = (id: string) => `/api/attachments/${id}`;

export interface CommentT {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: UserLite | null;
  attachments: AttachmentT[];
}

export interface TaskT {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  deadline: string | null;
  position: number;
  columnId: string;
  createdAt: string;
  updatedAt: string;
  creator: UserLite | null;
  assignees: UserLite[];
  labels: LabelT[];
  attachments: AttachmentT[];
  _count?: { comments: number };
}

export interface ColumnT {
  id: string;
  title: string;
  color: string;
  position: number;
}

export type Role = "OWNER" | "ADMIN" | "MEMBER";

export interface MemberT {
  role: Role;
  user: UserLite;
}

export const ROLE_LABELS: Record<Role, string> = { OWNER: "مالک", ADMIN: "ادمین", MEMBER: "کاربر" };

/** Only a task's creator or a super admin may delete it. */
export const canDeleteTask = (task: Pick<TaskT, "creator">, meId: string, superAdmin: boolean) =>
  superAdmin || task.creator?.id === meId;

/** Owner and admins manage members, columns and the board itself. */
export const canManage = (role: Role | undefined) => role === "OWNER" || role === "ADMIN";

export interface BoardT {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  columns: ColumnT[];
  labels: LabelT[];
  members: MemberT[];
  tasks: TaskT[];
}

export const PRIORITIES: { value: Priority; label: string; color: string; weight: number }[] = [
  { value: "URGENT", label: "فوری", color: "#dc2626", weight: 4 },
  { value: "HIGH", label: "زیاد", color: "#ea580c", weight: 3 },
  { value: "MEDIUM", label: "متوسط", color: "#ca8a04", weight: 2 },
  { value: "LOW", label: "کم", color: "#16a34a", weight: 1 },
];

export const priorityMeta = (p: Priority) => PRIORITIES.find((x) => x.value === p)!;
