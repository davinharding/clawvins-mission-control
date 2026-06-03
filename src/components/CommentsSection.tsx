import type { Comment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CommentItem } from "@/components/CommentItem";

// Author identity is determined server-side from the auth token.
// No manual "Post as" selection — UI posts always attribute to the logged-in user.
type CommentsSectionProps = {
  comments: Comment[];
  loading: boolean;
  posting: boolean;
  onPost: (text: string) => Promise<boolean>;
  draftText: string;
  onDraftChange: (text: string) => void;
};

export function CommentsSection({
  comments,
  loading,
  posting,
  onPost,
  draftText,
  onDraftChange,
}: CommentsSectionProps) {
  const text = draftText;

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const posted = await onPost(trimmed);
    if (posted) onDraftChange("");
  };

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="flex min-w-0 items-center justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Comments
        </h4>
        <span className="text-xs text-muted-foreground">{comments.length}</span>
      </div>
      <div className="min-w-0 space-y-3">
        {loading && (
          <p className="text-sm text-muted-foreground">Loading comments...</p>
        )}
        {!loading && !comments.length && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        {!loading &&
          comments.map((comment) => <CommentItem key={comment.id} comment={comment} />)}
      </div>
      <div className="min-w-0 space-y-2">
        <Textarea
          value={text}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Add a comment..."
          maxLength={1000}
          disabled={posting}
        />
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{text.length}/1000</span>
          <Button onClick={handleSubmit} disabled={posting || !text.trim()}>
            {posting ? "Posting..." : "Post"}
          </Button>
        </div>
      </div>
    </div>
  );
}
