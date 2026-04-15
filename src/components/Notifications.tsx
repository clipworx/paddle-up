"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type NotificationType = "success" | "error" | "info" | "warning";

type Toast = {
  id: string;
  message: string;
  type: NotificationType;
};

type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type NotificationsContextValue = {
  notify: (message: string, type?: NotificationType, durationMs?: number) => void;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
};

const NotificationsContext = createContext<NotificationsContextValue>({
  notify: () => {},
  confirm: () => Promise.resolve(false),
});

export function useNotifications() {
  return useContext(NotificationsContext);
}

type PendingConfirm = {
  message: string;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, type: NotificationType = "info", durationMs = 3500) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss]
  );

  const confirm = useCallback(
    (message: string, options: ConfirmOptions = {}): Promise<boolean> => {
      return new Promise((resolve) => {
        setPendingConfirm({ message, options, resolve });
      });
    },
    []
  );

  const resolveConfirm = (value: boolean) => {
    setPendingConfirm((current) => {
      if (current) current.resolve(value);
      return null;
    });
  };

  return (
    <NotificationsContext.Provider value={{ notify, confirm }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
      {pendingConfirm && (
        <ConfirmDialog
          message={pendingConfirm.message}
          options={pendingConfirm.options}
          onResolve={resolveConfirm}
        />
      )}
    </NotificationsContext.Provider>
  );
}

function ConfirmDialog({
  message,
  options,
  onResolve,
}: {
  message: string;
  options: ConfirmOptions;
  onResolve: (value: boolean) => void;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onResolve(false);
      if (e.key === "Enter") onResolve(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onResolve]);

  const title = options.title ?? "Are you sure?";
  const confirmLabel = options.confirmLabel ?? "Confirm";
  const cancelLabel = options.cancelLabel ?? "Cancel";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        entered ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="absolute inset-0 bg-foreground/40"
        onClick={() => onResolve(false)}
        aria-hidden="true"
      />
      <div
        className={`relative w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-xl transition-transform duration-200 ${
          entered ? "translate-y-0 scale-100" : "translate-y-2 scale-95"
        }`}
      >
        <h2
          id="confirm-title"
          className="text-lg font-bold text-foreground mb-2"
        >
          {title}
        </h2>
        <p className="text-sm text-foreground/80 mb-5 whitespace-pre-wrap">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onResolve(false)}
            className="rounded-lg px-4 py-2 text-sm font-semibold border border-border text-foreground hover:bg-accent/10 hover:border-accent transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onResolve(true)}
            autoFocus
            className="rounded-lg bg-accent text-background px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function toastClasses(type: NotificationType): string {
  switch (type) {
    case "success":
      return "border-accent bg-background text-foreground";
    case "error":
      return "border-accent bg-accent/15 text-foreground";
    case "warning":
      return "border-accent/60 bg-accent/10 text-foreground";
    case "info":
    default:
      return "border-border bg-background text-foreground";
  }
}

function iconFor(type: NotificationType): string {
  switch (type) {
    case "success":
      return "✓";
    case "error":
      return "✕";
    case "warning":
      return "!";
    case "info":
    default:
      return "i";
  }
}

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <button
      type="button"
      onClick={() => onDismiss(toast.id)}
      className={`pointer-events-auto rounded-lg border shadow-lg px-4 py-3 text-sm font-medium text-left min-w-[220px] max-w-sm transition-all duration-200 ease-out ${toastClasses(
        toast.type
      )} ${entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
    >
      <span className="inline-flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent text-background text-[11px] font-bold"
          aria-hidden="true"
        >
          {iconFor(toast.type)}
        </span>
        <span>{toast.message}</span>
      </span>
    </button>
  );
}
