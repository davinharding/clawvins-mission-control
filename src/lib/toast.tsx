import * as React from "react";

export type ToastVariant = "default" | "error";

export type Toast = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
};

export type ToastContextValue = {
  notify: (toast: Omit<Toast, "id">) => void;
};

export const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
