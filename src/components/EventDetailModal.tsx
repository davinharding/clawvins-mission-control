import * as React from "react";
import type { EventItem } from "@/lib/api";
import { LinkifiedText } from "@/components/LinkifiedText";

type Props = {
  event: EventItem | null;
  agentName?: string;
  open: boolean;
  onClose: () => void;
};

export function EventDetailModal({ event, agentName, open, onClose }: Props) {
  // Close on Escape key
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !event) return null;

  const detail = event.detail;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      style={{ 
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))"
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {event.type.replace(/_/g, " ")}
            </p>
            <h3 className="text-lg font-semibold">{agentName ?? "System"}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground min-h-[44px] min-w-[44px]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Channel */}
          {detail?.channelName && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Channel
              </p>
              <p className="text-sm font-mono">{detail.channelName}</p>
            </div>
          )}

          {/* Content */}
          {detail?.content && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                {event.type === "message_received" ? "Message" : "Response"}
              </p>
              <p className="rounded-lg bg-muted/60 p-3 text-sm leading-relaxed whitespace-pre-wrap break-words max-h-[50vh] overflow-y-auto">
                <LinkifiedText text={detail.content} />
              </p>
            </div>
          )}

          {/* Fallback: show raw message if no detail content */}
          {!detail?.content && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Event
              </p>
              <p className="rounded-lg bg-muted/60 p-3 text-sm leading-relaxed whitespace-pre-wrap break-words max-h-[50vh] overflow-y-auto">
                <LinkifiedText text={event.message} />
              </p>
            </div>
          )}

          {/* Tool calls */}
          {detail?.tools && detail.tools.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Tools Used
              </p>
              <div className="space-y-1.5">
                {detail.tools.map((tool, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2"
                  >
                    <span className="text-sm">🔧</span>
                    <span className="text-sm font-mono font-semibold">{tool.name}</span>
                    {tool.inputKeys?.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({tool.inputKeys.join(", ")})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta row: model, tokens, cost */}
          {(detail?.model || detail?.tokens || detail?.cost) && (
            <div className="flex flex-wrap gap-3 rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              {detail.model && (
                <span>
                  <span className="font-semibold">Model:</span>{" "}
                  {detail.model.split("/").pop()}
                </span>
              )}
              {detail.tokens && (
                <span>
                  <span className="font-semibold">Tokens:</span>{" "}
                  {detail.tokens.toLocaleString()}
                </span>
              )}
              {detail.cost && (
                <span>
                  <span className="font-semibold">Cost:</span> ${detail.cost.toFixed(4)}
                </span>
              )}
            </div>
          )}

          {/* Timestamp */}
          <p className="text-xs text-muted-foreground font-mono">
            {new Date(event.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
