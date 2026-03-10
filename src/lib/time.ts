export function formatRelativeTime(value: number, now = Date.now()) {
  const diffMs = now - value;
  if (diffMs < 60_000) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diffMs / 86_400_000);
  if (days < 7) return `${days}d ago`;

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
