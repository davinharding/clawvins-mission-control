import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Comment } from "@/lib/api";
import { formatRelativeTime } from "@/lib/time";
import { renderMarkdown } from "@/lib/markdown";

type CommentItemProps = {
  comment: Comment;
};

export function CommentItem({ comment }: CommentItemProps) {
  const initials = comment.authorName
    .split(" ")
    .map((part) => part[0])
    .join("");

  return (
    <div className="flex min-w-0 gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarFallback>{initials || "?"}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="min-w-0 break-words text-sm font-semibold [overflow-wrap:anywhere]">{comment.authorName}</p>
          <span className="flex-shrink-0 text-xs text-muted-foreground">
            {formatRelativeTime(comment.createdAt)}
          </span>
        </div>
        <div
          className="prose prose-sm min-w-0 max-w-none text-sm leading-relaxed text-foreground/90 [overflow-wrap:anywhere] [&_a]:break-all [&_code]:break-words [&_code]:[overflow-wrap:anywhere] [&_li]:break-words [&_li]:[overflow-wrap:anywhere] [&_p]:break-words [&_p]:[overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:overflow-x-hidden [&_pre]:[overflow-wrap:anywhere]"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(comment.text) }}
        />
      </div>
    </div>
  );
}
