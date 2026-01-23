import { atom } from "jotai";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface UiState {
  isLoading: boolean;
  toasts: Toast[];
}

const initialState: UiState = {
  isLoading: false,
  toasts: [],
};

export const uiAtom = atom<UiState>(initialState);
export const isLoadingAtom = atom(
  (get) => get(uiAtom).isLoading,
  (get, set, isLoading: boolean) => {
    set(uiAtom, { ...get(uiAtom), isLoading });
  },
);
export const toastsAtom = atom(
  (get) => get(uiAtom).toasts,
  (get, set, toasts: Toast[]) => {
    set(uiAtom, { ...get(uiAtom), toasts });
  },
);

// Helper atom to add a toast
export const addToastAtom = atom(null, (get, set, toast: Omit<Toast, "id">) => {
  const id = crypto.randomUUID();
  const current = get(uiAtom);
  set(uiAtom, { ...current, toasts: [...current.toasts, { ...toast, id }] });

  // Auto-remove after duration
  const duration = toast.duration ?? 4000;
  setTimeout(() => {
    const updated = get(uiAtom);
    set(uiAtom, { ...updated, toasts: updated.toasts.filter((t) => t.id !== id) });
  }, duration);
});
