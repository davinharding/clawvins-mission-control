import type { ConnectionState } from "@/lib/socket";
import { cn } from "@/lib/utils";

const STATE_LABELS: Record<ConnectionState, string> = {
  connected: "Connected",
  disconnected: "Disconnected",
  reconnecting: "Reconnecting...",
};

const STATE_STYLES: Record<ConnectionState, { dot: string; ring: string; text: string }> = {
  connected: { dot: "bg-emerald-400", ring: "ring-emerald-400/40", text: "text-emerald-200" },
  disconnected: { dot: "bg-rose-500", ring: "ring-rose-400/40", text: "text-rose-200" },
  reconnecting: { dot: "bg-amber-400", ring: "ring-amber-400/40", text: "text-amber-200" },
};

type ConnectionStatusProps = {
  state: ConnectionState;
};

export function ConnectionStatus({ state }: ConnectionStatusProps) {
  const styles = STATE_STYLES[state];

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs uppercase tracking-[0.2em]">
      <span className={cn("h-2.5 w-2.5 rounded-full ring-2", styles.dot, styles.ring)} />
      <span className={cn("font-semibold", styles.text)}>{STATE_LABELS[state]}</span>
    </div>
  );
}
