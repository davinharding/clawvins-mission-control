import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

type Props = {
  id: string;
  children: React.ReactNode;
  isSelecting?: boolean;
  isSelected?: boolean;
  onSelect?: (shiftKey?: boolean) => void;
  onLongPress?: () => void;
};

export function DraggableCard({
  id,
  children,
  isSelecting,
  isSelected,
  onSelect,
  onLongPress,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });

  // Detect if we're on mobile (< 1024px, which is the 'lg' breakpoint)
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    // Check initial screen size
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mediaQuery.matches);

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  // Keep refs fresh for use inside timer callbacks
  const onLongPressRef = React.useRef(onLongPress);
  const isDraggingRef = React.useRef(isDragging);
  React.useEffect(() => { onLongPressRef.current = onLongPress; }, [onLongPress]);
  React.useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);

  // Long-press detection (for mobile only)
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = React.useRef<{ x: number; y: number } | null>(null);

  const cancelLongPress = React.useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pressStart.current = null;
  }, []);

  // Cleanup on unmount
  React.useEffect(() => () => cancelLongPress(), [cancelLongPress]);

  // Long-press handler for handle only (mobile)
  const handleHandlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      pressStart.current = { x: e.clientX, y: e.clientY };
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        pressStart.current = null;
        if (!isDraggingRef.current) {
          onLongPressRef.current?.();
        }
      }, 300);
    },
    []
  );

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pressStart.current) {
        const dx = e.clientX - pressStart.current.x;
        const dy = e.clientY - pressStart.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 8) {
          cancelLongPress();
        }
      }
    },
    [cancelLongPress]
  );

  // On desktop, apply listeners to the whole card; on mobile, only to the handle
  const cardListeners = !isSelecting && !isMobile ? listeners : undefined;
  const handleListeners = !isSelecting && isMobile ? listeners : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...cardListeners}
      className={cn(
        "relative select-none transition-opacity",
        isDragging && "opacity-30",
        isSelected && "ring-2 ring-primary/60 rounded-lg",
        // On desktop: full card is draggable
        !isSelecting && !isMobile && "cursor-grab active:cursor-grabbing"
      )}
    >
      {/* Checkbox indicator — shown in top-left corner when selection mode is active */}
      {isSelecting && (
        <div className="absolute top-1.5 left-1.5 z-20 pointer-events-none">
          <div
            className={cn(
              "h-4 w-4 rounded border-2 flex items-center justify-center shadow-sm",
              isSelected
                ? "bg-primary border-primary"
                : "bg-background/90 border-muted-foreground/50"
            )}
          >
            {isSelected && (
              <svg viewBox="0 0 10 8" className="h-2.5 w-2.5" fill="none">
                <polyline
                  points="1,4 3.5,6.5 9,1"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Drag handle — only shown on mobile when NOT in selection mode */}
      {!isSelecting && isMobile && (
        <div
          {...attributes}
          {...handleListeners}
          onPointerDown={handleHandlePointerDown}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onPointerMove={handlePointerMove}
          className="absolute top-7 right-1.5 z-20 cursor-grab active:cursor-grabbing rounded p-0.5 hover:bg-muted/60 transition-colors touch-none"
          style={{ touchAction: "none" }}
          aria-label="Drag handle"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Click-capture overlay in selection mode — intercepts clicks before inner handlers */}
      {isSelecting && (
        <div
          className="absolute inset-0 z-10"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onSelect?.(e.shiftKey);
          }}
        />
      )}

      {children}
    </div>
  );
}
