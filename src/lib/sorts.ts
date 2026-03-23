import type { Task, TaskPriority, TaskStatus } from "@/lib/api";
import { priorityWeight } from "@/lib/columns";

export type ColumnSort =
  | "priority-desc"
  | "priority-asc"
  | "created-desc"
  | "created-asc"
  | "updated-desc"
  | "updated-asc";

export const validColumnSorts: ReadonlySet<ColumnSort> = new Set<ColumnSort>([
  "priority-desc",
  "priority-asc",
  "created-desc",
  "created-asc",
  "updated-desc",
  "updated-asc",
]);

export const defaultColumnSorts: Record<TaskStatus, ColumnSort> = {
  backlog: "priority-desc",
  todo: "priority-desc",
  "in-progress": "priority-desc",
  testing: "priority-desc",
  done: "priority-desc",
  archived: "priority-desc",
};

export const columnSortOptions: Array<{ label: string; value: ColumnSort }> = [
  { label: "Priority (High → Low)", value: "priority-desc" },
  { label: "Priority (Low → High)", value: "priority-asc" },
  { label: "Created (Newest)", value: "created-desc" },
  { label: "Created (Oldest)", value: "created-asc" },
  { label: "Updated (Newest)", value: "updated-desc" },
  { label: "Updated (Oldest)", value: "updated-asc" },
];

export const sortTasks = (items: Task[], sort: ColumnSort) => {
  const sorted = [...items];
  const byPriority = (task: Task) => priorityWeight[(task.priority || "low") as NonNullable<TaskPriority>] ?? 0;
  const byCreated = (task: Task) => task.createdAt ?? 0;
  const byUpdated = (task: Task) => task.updatedAt ?? task.createdAt ?? 0;

  switch (sort) {
    case "priority-asc":
      sorted.sort((a, b) => byPriority(a) - byPriority(b));
      break;
    case "priority-desc":
      sorted.sort((a, b) => byPriority(b) - byPriority(a));
      break;
    case "created-asc":
      sorted.sort((a, b) => byCreated(a) - byCreated(b));
      break;
    case "created-desc":
      sorted.sort((a, b) => byCreated(b) - byCreated(a));
      break;
    case "updated-asc":
      sorted.sort((a, b) => byUpdated(a) - byUpdated(b));
      break;
    case "updated-desc":
      sorted.sort((a, b) => byUpdated(b) - byUpdated(a));
      break;
    default:
      return sorted;
  }
  return sorted;
};
