import * as React from "react";
import type { Agent, Comment, Task, TaskPriority, TaskStatus } from "@/lib/api";
import { createComment, getComments } from "@/lib/api";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { CommentsSection } from "@/components/CommentsSection";
import { LinkifiedText } from "@/components/LinkifiedText";
import { useToast } from "@/lib/toast";

type TaskEditModalProps = {
  open: boolean;
  task: Task | null;
  agents: Agent[];
  incomingComment?: Comment | null;
  onOpenChange: (open: boolean) => void;
  onSave: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  onArchive?: (taskId: string) => void;
};

const statusOptions: TaskStatus[] = ["backlog", "todo", "in-progress", "testing", "done", "archived"];
const priorityOptions: TaskPriority[] = ["low", "medium", "high", "critical"];

const upsertById = <T extends { id: string }>(items: T[], item: T) => {
  const index = items.findIndex((existing) => existing.id === item.id);
  if (index === -1) return [...items, item];
  const next = [...items];
  next[index] = item;
  return next;
};

export function TaskEditModal({
  open,
  task,
  agents,
  incomingComment,
  onOpenChange,
  onSave,
  onDelete,
  onArchive,
}: TaskEditModalProps) {
  const { notify } = useToast();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState<TaskPriority>("low");
  const [assignedAgent, setAssignedAgent] = React.useState<string>("");
  const [status, setStatus] = React.useState<TaskStatus>("backlog");
  const [tagsInput, setTagsInput] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = React.useState(false);
  const [postingComment, setPostingComment] = React.useState(false);

  React.useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPriority((task.priority ?? "low") as TaskPriority);
    setAssignedAgent(task.assignedAgent ?? "");
    setStatus(task.status);
    setTagsInput((task.tags ?? []).join(", "));
  }, [task]);

  React.useEffect(() => {
    if (!open || !task) return;
    let mounted = true;
    setLoadingComments(true);
    getComments(task.id)
      .then((response) => {
        if (!mounted) return;
        setComments(response.comments);
      })
      .catch((err) => {
        if (!mounted) return;
        notify({
          title: "Failed to load comments",
          description: err instanceof Error ? err.message : "Unexpected error",
          variant: "error",
        });
      })
      .finally(() => {
        if (mounted) setLoadingComments(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, task, notify]);

  React.useEffect(() => {
    if (!incomingComment || !task) return;
    if (incomingComment.taskId !== task.id) return;
    setComments((prev) => upsertById(prev, incomingComment));
  }, [incomingComment, task]);

  if (!task) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      notify({
        title: "Title is required",
        description: "Please provide a task title before saving.",
        variant: "error",
      });
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      await onSave(task.id, {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        priority,
        assignedAgent: assignedAgent || null,
        status,
        tags,
      });
      onOpenChange(false);
    } catch (err) {
      notify({
        title: "Failed to update task",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    const confirmed = window.confirm(`Delete "${task.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      await onDelete(task.id);
      onOpenChange(false);
    } catch (err) {
      notify({
        title: "Failed to delete task",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handlePostComment = async (text: string, authorId: string, authorName: string) => {
    if (!task) return;
    setPostingComment(true);
    try {
      const response = await createComment(task.id, text, { authorId, authorName });
      setComments((prev) => upsertById(prev, response.comment));
    } catch (err) {
      notify({
        title: "Failed to post comment",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "error",
      });
    } finally {
      setPostingComment(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-screen sm:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>Update task details and collaborate in real-time.</DialogDescription>
        </DialogHeader>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Title
            </label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              placeholder="Task title"
              className="w-full"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              placeholder="Describe the mission details..."
            />
            {/https?:\/\//.test(description) && (
              <p className="rounded-md bg-muted/40 px-3 py-2 text-sm leading-relaxed break-words">
                <LinkifiedText text={description} />
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Priority
            </label>
            <Select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} className="w-full min-h-[44px]">
              {priorityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Status
            </label>
            <Select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)} className="w-full min-h-[44px]">
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Assigned Agent
            </label>
            <Select
              value={assignedAgent}
              onChange={(event) => setAssignedAgent(event.target.value)}
              className="w-full min-h-[44px]"
            >
              <option value="">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Tags
            </label>
            <Input
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="infra, urgent, api"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">Comma-separated tags</p>
          </div>
        </div>

        <Separator className="my-6" />

        <CommentsSection
          comments={comments}
          agents={agents}
          loading={loadingComments}
          posting={postingComment}
          onPost={handlePostComment}
        />

        <DialogFooter className="mt-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving || deleting}>
            Cancel
          </Button>
          {onArchive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onArchive(task.id);
                onOpenChange(false);
              }}
              disabled={saving || deleting}
              className="text-amber-400 hover:text-amber-300"
            >
              <Archive className="h-4 w-4 mr-1" />
              Archive
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleDelete}
            disabled={saving || deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
          <Button onClick={handleSave} disabled={saving || deleting}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
