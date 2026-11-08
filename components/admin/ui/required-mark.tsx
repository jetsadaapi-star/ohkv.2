import { cn } from "@/lib/utils";

/** The red asterisk after the label of a field that must be filled in. */
export function RequiredMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("ms-0.5 font-bold text-red-500", className)}>
      *
    </span>
  );
}

/** "* = required" note for the top of a form that uses RequiredMark. */
export function RequiredLegend({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
      <span className="font-bold text-red-500">*</span>
      {text}
    </p>
  );
}
