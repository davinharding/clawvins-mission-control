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
