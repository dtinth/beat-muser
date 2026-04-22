/**
 * @packageDocumentation
 *
 * Sonner toast provider and `useToast()` hook for displaying ephemeral
 * notifications (success, error, info) across the app.
 */

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { Toaster, toast } from "sonner";

interface ToastOptions {
  title: string;
  description?: string;
}

interface ToastContextValue {
  showError: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showError: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const showError = useCallback((options: ToastOptions) => {
    toast.error(options.title, { description: options.description });
  }, []);

  return (
    <ToastContext.Provider value={{ showError }}>
      {children}
      <Toaster richColors position="top-right" />
    </ToastContext.Provider>
  );
}
