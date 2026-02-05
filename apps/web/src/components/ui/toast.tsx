"use client";

import { useAtom, useSetAtom } from "jotai";
import { AlertCircle, CheckCircle, Info, X, XCircle } from "lucide-react";
import { useMemo } from "react";
import {
  addToastAtom,
  type Toast as ToastType,
  type ToastType as ToastVariant,
  uiAtom,
} from "@/atoms/ui";
import { cn } from "@/lib/utils";

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="h-4 w-4 text-green-600" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
  warning: <AlertCircle className="h-4 w-4 text-yellow-600" />,
  info: <Info className="h-4 w-4 text-blue-600" />,
};

const bgClasses: Record<ToastVariant, string> = {
  success: "border-green-200 bg-green-50",
  error: "border-destructive/20 bg-destructive/5",
  warning: "border-yellow-200 bg-yellow-50",
  info: "border-blue-200 bg-blue-50",
};

function ToastItem({ toast, onDismiss }: { toast: ToastType; onDismiss: () => void }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-4 py-3 shadow-md animate-in slide-in-from-bottom-2",
        bgClasses[toast.type],
      )}
    >
      {icons[toast.type]}
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const [ui, setUi] = useAtom(uiAtom);

  const dismiss = (id: string) => {
    setUi({ ...ui, toasts: ui.toasts.filter((t) => t.id !== id) });
  };

  if (ui.toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex w-80 -translate-x-1/2 flex-col gap-2">
      {ui.toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  );
}

export function useToast() {
  const addToast = useSetAtom(addToastAtom);

  return useMemo(
    () => ({
      success: (message: string) => addToast({ type: "success", message }),
      error: (message: string) => addToast({ type: "error", message }),
      warning: (message: string) => addToast({ type: "warning", message }),
      info: (message: string) => addToast({ type: "info", message }),
    }),
    [addToast],
  );
}
