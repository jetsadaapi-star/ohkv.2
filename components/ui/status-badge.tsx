import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_TONE_CLASS, STATUS_TONE_DOT, statusTone, type StatusTone } from "@/lib/ui/status-palette";

/**
 * A status as one pill, coloured by the shared palette (lib/ui/status-palette):
 * paid is green wherever it appears.
 */
export function StatusBadge({
  status,
  tone,
  children,
  dot = true,
  icon,
  className,
}: {
  /** The raw status key; picks the tone unless `tone` is given. */
  status?: string | null;
  tone?: StatusTone;
  children: ReactNode;
  dot?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const resolved = tone ?? statusTone(status);
  return (
    <span
      className={cn(
        "inline-flex w-fit max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        STATUS_TONE_CLASS[resolved],
        className,
      )}
    >
      {icon ? (
        <span className="shrink-0 [&_svg]:size-3.5">{icon}</span>
      ) : dot ? (
        <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_TONE_DOT[resolved])} />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
