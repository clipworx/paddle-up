"use client";

import { useState } from "react";

type Props = {
  isEditor: boolean;
  onAuthenticate: (password: string) => Promise<boolean>;
  onLogout: () => void;
};

export function EditLock({ isEditor, onAuthenticate, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await onAuthenticate(password);
    setBusy(false);
    if (ok) {
      setPassword("");
      setOpen(false);
    } else {
      setError("Incorrect password");
    }
  };

  if (isEditor) {
    return (
      <button
        type="button"
        onClick={onLogout}
        className="text-xs font-semibold rounded-full px-3 py-1.5 border border-accent bg-accent text-background hover:bg-muted hover:border-muted transition-colors"
        title="Sign out of edit mode"
      >
        🔓 Editing
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-semibold rounded-full px-3 py-1.5 border border-border text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
      >
        🔒 View only
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="absolute right-0 mt-2 w-64 rounded-lg border border-border bg-background p-3 shadow-lg z-10 space-y-2"
        >
          <label className="text-xs uppercase tracking-wide text-muted font-semibold">
            Edit password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
          />
          {error && <p className="text-xs text-accent font-semibold">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setPassword("");
                setError(null);
              }}
              className="text-xs rounded px-3 py-1.5 border border-border text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !password}
              className="text-xs rounded px-3 py-1.5 bg-accent text-background font-semibold hover:bg-muted transition-colors disabled:opacity-40 disabled:hover:bg-accent"
            >
              {busy ? "Checking…" : "Unlock"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
