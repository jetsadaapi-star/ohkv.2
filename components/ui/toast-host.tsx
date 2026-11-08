"use client";

import { useEffect, type ComponentProps } from "react";
import * as sonner from "sonner";

/**
 * Sonner and its toaster, in a chunk of their own (see toast-notification.tsx).
 * `onReady` hands Sonner over once the toaster is listening: a child's effect
 * runs before its parent's, so nothing sent from then on is missed.
 */
export function ToastHost({
  onReady,
  ...props
}: ComponentProps<typeof sonner.Toaster> & {
  onReady: (module: typeof sonner) => void;
}) {
  useEffect(() => {
    onReady(sonner);
  }, [onReady]);
  // The toaster is mounted outside the intl provider and only ever on the
  // client, so it reads the page's language from <html lang> and carries its
  // own two labels.
  const thai =
    typeof document === "undefined" ||
    (document.documentElement.lang || "th").toLowerCase().startsWith("th");
  return (
    <sonner.Toaster
      containerAriaLabel={thai ? "การแจ้งเตือน" : "Notifications"}
      {...props}
      toastOptions={{
        closeButtonAriaLabel: thai ? "ปิดการแจ้งเตือน" : "Close toast",
        ...props.toastOptions,
      }}
    />
  );
}
