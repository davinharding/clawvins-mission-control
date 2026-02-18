import * as React from "react";
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
  onPost: (text: string) => Promise<void>;
};

export function CommentsSection({
  comments,
  loading,
  posting,
  onPost,
}: CommentsSectionProps) {
  const [text, setText] = React.useState("");

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await onPost(trimmed);
    setText("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Comments
        </h4>
        <span className="text-xs text-muted-foreground">{comments.length}</span>
      </div>
      <div className="space-y-3">
        {loading && (
          <p className="text-sm text-muted-foreground">Loading comments...</p>
        )}
        {!loading && !comments.length && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        {!loading &&
          comments.map((comment) => <CommentItem key={comment.id} comment={comment} />)}
      </div>
      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a comment..."
          maxLength={1000}
          disabled={posting}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{text.length}/1000</span>
          <Button onClick={handleSubmit} disabled={posting || !text.trim()}>
            {posting ? "Posting..." : "Post"}
          </Button>
        </div>
      </div>
    </div>
  );
}
