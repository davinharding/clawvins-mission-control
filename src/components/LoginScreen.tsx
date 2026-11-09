import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LoginScreenProps = {
  onSubmit: (username: string, password: string) => Promise<void>;
  error?: string | null;
};

export function LoginScreen({ onSubmit, error }: LoginScreenProps) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(username.trim(), password);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-8 shadow-xl"
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            Mission Control
          </p>
          <h1 className="text-2xl font-semibold">Sign in</h1>
        </div>

        <label className="block space-y-2 text-sm">
          <span className="text-muted-foreground">Username</span>
          <Input
            autoComplete="username"
            autoFocus
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <label className="block space-y-2 text-sm">
          <span className="text-muted-foreground">Password</span>
          <Input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
