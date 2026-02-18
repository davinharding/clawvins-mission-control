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
      style={{ ...style, touchAction: 'none', WebkitUserSelect: 'none' }}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-opacity select-none",
        isDragging && "opacity-30"
      )}
    >
      {children}
    </div>
  );
}
