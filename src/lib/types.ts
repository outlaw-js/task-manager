export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface UserLite {
  id: string;
  name: string;
  email: string;
  color: string;
}

export interface LabelT {
  id: string;
  name: string;
  color: string;
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
}

export interface ColumnT {
  id: string;
  title: string;
  color: string;
  position: number;
}

export interface MemberT {
  role: "OWNER" | "MEMBER";
  user: UserLite;
}

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
