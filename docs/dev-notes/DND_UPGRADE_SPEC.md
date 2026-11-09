# Phase 4: dnd-kit Drag & Drop Upgrade

Work in `~/code/mission-control`. Replace native HTML drag events with @dnd-kit for a polished, modern Kanban drag experience.

---

## Install

```bash
cd ~/code/mission-control
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## What to Replace

Currently in `src/App.tsx`:
- `handleDragStart` (sets dataTransfer)
- `handleDrop` (reads dataTransfer, calls updateTask)
- `onDragStart`, `onDrop`, `onDragOver` props on Card and column divs

Replace all of this with @dnd-kit.

---

## Implementation

### Overview of dnd-kit architecture:
- `<DndContext>` wraps the entire Kanban board — handles drag events
- `useDroppable` on each column — makes columns accept drops
- `useDraggable` on each task card — makes cards draggable
- `<DragOverlay>` renders a floating ghost card while dragging
- `onDragEnd` is where you call `updateTask` to persist the move

### Step 1: Create `src/components/KanbanColumn.tsx`

```tsx
import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  children: React.ReactNode;
  className?: string;
};

export function KanbanColumn({ id, children, className }: Props) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-h-0 overflow-hidden rounded-2xl border border-dashed border-border/70 bg-card/40 p-3 transition-colors",
        isOver && "border-primary/60 bg-primary/5",
        className
      )}
    >
      {children}
    </div>
  );
}
```

### Step 2: Create `src/components/DraggableCard.tsx`

```tsx
import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  children: React.ReactNode;
};

export function DraggableCard({ id, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-opacity",
        isDragging && "opacity-30"
      )}
    >
      {children}
    </div>
  );
}
```

### Step 3: Refactor `src/App.tsx`

**Imports to add:**
```tsx
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { DraggableCard } from "@/components/DraggableCard";
```

**State to add:**
```tsx
const [draggingTaskId, setDraggingTaskId] = React.useState<string | null>(null);
```

**Sensors (replace handleDragStart):**
```tsx
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }, // 5px before drag activates — allows click to still work
  }),
  useSensor(KeyboardSensor)
);
```

**Replace handleDragStart + handleDrop with:**
```tsx
const handleDragStart = (event: DragStartEvent) => {
  setDraggingTaskId(event.active.id as string);
};

const handleDragEnd = async (event: DragEndEvent) => {
  setDraggingTaskId(null);
  const { active, over } = event;
  if (!over) return;

  const taskId = active.id as string;
  const newStatus = over.id as TaskStatus;
  const existing = tasks.find((t) => t.id === taskId);
  if (!existing || existing.status === newStatus) return;

  // Optimistic update
  setTasks((prev) =>
    prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
  );

  try {
    await updateTask(taskId, { status: newStatus });
  } catch (err) {
    // Revert on failure
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: existing.status } : t))
    );
    notify({
      title: "Failed to move task",
      description: err instanceof Error ? err.message : "Unexpected error",
      variant: "error",
    });
  }
};
```

**Wrap the Kanban section in DndContext:**
```tsx
<DndContext
  sensors={sensors}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 overflow-hidden sm:grid-cols-2 lg:grid-cols-4">
    {columns.map((column) => {
      const columnTasks = sortTasks(
        filteredTasks.filter((t) => t.status === column),
        columnSorts[column]
      );
      return (
        <KanbanColumn key={column} id={column}>
          {/* column header (sort dropdown, count) — keep as-is */}
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-3">
              {columnTasks.map((task) => (
                <DraggableCard key={task.id} id={task.id}>
                  <Card
                    onClick={() => { setActiveTaskId(task.id); setModalOpen(true); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setActiveTaskId(task.id);
                        setModalOpen(true);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    {/* card content — same as before */}
                  </Card>
                </DraggableCard>
              ))}
            </div>
          </div>
        </KanbanColumn>
      );
    })}
  </div>

  {/* Ghost card while dragging */}
  <DragOverlay>
    {draggingTaskId ? (() => {
      const task = tasks.find((t) => t.id === draggingTaskId);
      const agent = task?.assignedAgent ? agentById[task.assignedAgent] : null;
      const priority = (task?.priority || "low") as TaskPriority;
      if (!task) return null;
      return (
        <Card className="rotate-2 shadow-2xl ring-2 ring-primary/60 opacity-95">
          <CardHeader className="space-y-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold leading-snug">{task.title}</h3>
              <Badge variant={priorityVariant[priority]} className="px-2 py-0.5 text-[10px] uppercase tracking-wide">
                {priority}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Avatar className="h-7 w-7">
                <AvatarFallback>
                  {agent?.name?.split(" ").map((p) => p[0]).join("") ?? "?"}
                </AvatarFallback>
              </Avatar>
              <span>{agent?.name ?? "Unassigned"}</span>
            </div>
          </CardHeader>
        </Card>
      );
    })() : null}
  </DragOverlay>
</DndContext>
```

**Remove** old `draggable`, `onDragStart`, `onDragOver`, `onDrop` props — they're no longer needed.

---

## Key UX Behaviors
- Cards need 5px of movement before drag activates (prevents accidental drags on click)
- Dragged card becomes 30% opaque in place (ghost stays in column)
- `DragOverlay` renders a rotated, shadowed, ring-highlighted floating card following the cursor
- Columns highlight with primary color when a card hovers over them
- Keyboard drag works (Tab to card, Space to lift, arrow keys to move)

---

## Build & Push

```bash
cd ~/code/mission-control
pnpm build
bash scripts/restart.sh
git add -A
git commit -m "feat: replace native drag with @dnd-kit - smooth overlay, column highlight, keyboard support"
GIT_SSH_COMMAND="ssh -i /home/node/.openclaw/workspace/.ssh/clawvin-bot -o StrictHostKeyChecking=no" git push origin master
```

## Done Criteria
- [ ] Cards drag smoothly with a floating ghost card following the cursor
- [ ] Ghost card is slightly rotated and has a ring + shadow
- [ ] Source card becomes semi-transparent while dragging (not invisible)
- [ ] Drop column highlights when card hovers over it
- [ ] Clicking a card still opens the edit modal (activationConstraint: distance 5)
- [ ] Keyboard drag works
- [ ] No TypeScript errors
