import * as React from "react";
import type { Agent, Comment } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { CommentItem } from "@/components/CommentItem";

type CommentsSectionProps = {
  comments: Comment[];
  agents: Agent[];
  loading: boolean;
  posting: boolean;
  onPost: (text: string, authorId: string, authorName: string) => Promise<void>;
};

export function CommentsSection({
  comments,
  agents,
  loading,
  posting,
  onPost,
}: CommentsSectionProps) {
  const [text, setText] = React.useState("");
  const [selectedAuthorId, setSelectedAuthorId] = React.useState<string>("");

  // Default to first agent when agents load
  React.useEffect(() => {
    if (!selectedAuthorId && agents.length > 0) {
      setSelectedAuthorId(agents[0].id);
    }
  }, [agents, selectedAuthorId]);

  const selectedAgent = agents.find((a) => a.id === selectedAuthorId) ?? agents[0];

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || !selectedAgent) return;
    await onPost(trimmed, selectedAgent.id, selectedAgent.name);
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
        {agents.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Post as:</label>
            <Select
              value={selectedAuthorId}
              onChange={(e) => setSelectedAuthorId(e.target.value)}
              disabled={posting}
              className="h-7 flex-1 text-xs"
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add a comment..."
          maxLength={1000}
          disabled={posting}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{text.length}/1000</span>
          <Button onClick={handleSubmit} disabled={posting || !text.trim() || !selectedAgent}>
            {posting ? "Posting..." : "Post"}
          </Button>
        </div>
      </div>
    </div>
  );
}
