import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Comment } from "@/lib/api";
import { formatRelativeTime } from "@/lib/time";

type CommentItemProps = {
  comment: Comment;
};

export function CommentItem({ comment }: CommentItemProps) {
  const initials = comment.authorName
    .split(" ")
    .map((part) => part[0])
    .join("");

  return (
    <div className="flex gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
      <Avatar className="h-9 w-9">
        <AvatarFallback>{initials || "?"}</AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{comment.authorName}</p>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(comment.createdAt)}
          </span>
        </div>
        <p className="text-sm text-foreground/90">{comment.text}</p>
      </div>
    </div>
  );
}
