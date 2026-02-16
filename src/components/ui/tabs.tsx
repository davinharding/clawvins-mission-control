import { cn } from "@/lib/utils";

export type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>; 
  className?: string;
};

export function Tabs({ value, onValueChange, options, className }: TabsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onValueChange(option.value)}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition",
            value === option.value
              ? "border-primary/50 bg-primary/20 text-primary"
              : "border-border/70 text-muted-foreground hover:bg-muted/60"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
