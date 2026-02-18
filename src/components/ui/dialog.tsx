import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

type DialogContentProps = React.HTMLAttributes<HTMLDivElement>;

export function DialogContent({ className, children, ...props }: DialogContentProps) {
  const context = React.useContext(DialogContext);
  const open = context?.open ?? false;

  React.useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        context?.onOpenChange(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previous;
    };
  }, [open, context]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:px-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="fixed inset-0 cursor-default bg-slate-950/70"
        onClick={() => context?.onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full sm:max-w-3xl rounded-none sm:rounded-2xl border-0 sm:border border-border/70 bg-card/95 p-4 sm:p-6 shadow-2xl backdrop-blur",
          "flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden sm:overflow-y-auto",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-xl font-semibold tracking-tight", className)} {...props} />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export function DialogFooter({ className, style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-shrink-0 flex flex-wrap items-center justify-end gap-3 pt-4", className)}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)', ...style }}
      {...props}
    />
  );
}
