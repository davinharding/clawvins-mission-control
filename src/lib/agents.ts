import type { Agent, AgentRole } from "@/lib/api";

export const agentEmojiMap: Record<string, string> = {
  clawvin: "🐾",
  patch: "🔧",
  scout: "🎯",
  vitals: "💪",
  alpha: "🔍",
  iris: "📨",
  nova: "✨",
  ledger: "📒",
  atlas: "🏋️",
};

export const getAgentEmoji = (name: string): string | null => {
  const key = name.split(" ")[0].toLowerCase();
  return agentEmojiMap[key] ?? null;
};

export const roleAvatarBg: Record<AgentRole, string> = {
  Main: "bg-blue-500/20 border border-blue-500/30",
  Dev: "bg-amber-500/20 border border-amber-500/30",
  Research: "bg-purple-500/20 border border-purple-500/30",
  Ops: "bg-emerald-500/20 border border-emerald-500/30",
};

export const roleAvatarText: Record<AgentRole, string> = {
  Main: "text-blue-300",
  Dev: "text-amber-300",
  Research: "text-purple-300",
  Ops: "text-emerald-300",
};

export const statusColor: Record<Agent["status"], string> = {
  online: "bg-emerald-400",
  busy: "bg-amber-400",
  offline: "bg-slate-500",
};

export const statusRing: Record<Agent["status"], string> = {
  online: "ring-emerald-400/40",
  busy: "ring-amber-400/40",
  offline: "ring-slate-500/40",
};
