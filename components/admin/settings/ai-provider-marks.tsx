import type { AITextProvider } from "@/lib/ai-authoring/text-providers";
import { cn } from "@/lib/utils";

/**
 * A small mark per AI provider for the settings picker: the provider's colour
 * and a simple glyph, not the provider's logo artwork.
 */
export function AIProviderMark({
  provider,
  className,
}: {
  provider: AITextProvider;
  className?: string;
}) {
  const base = cn(
    "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-black tracking-tight",
    className,
  );
  switch (provider) {
    case "openai":
      return (
        <span className={cn(base, "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900")} aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 3.5l7.4 4.25v8.5L12 20.5l-7.4-4.25v-8.5z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </span>
      );
    case "gemini":
      return (
        <span className={cn(base, "bg-gradient-to-br from-sky-50 to-violet-100 dark:from-sky-950 dark:to-violet-950")} aria-hidden="true">
          <svg viewBox="0 0 24 24" className="size-6">
            <defs>
              <linearGradient id="ai-mark-gemini" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#4285F4" />
                <stop offset="0.55" stopColor="#9B72CB" />
                <stop offset="1" stopColor="#D96570" />
              </linearGradient>
            </defs>
            <path
              fill="url(#ai-mark-gemini)"
              d="M12 2c.5 4.9 5.1 9.5 10 10-4.9.5-9.5 5.1-10 10-.5-4.9-5.1-9.5-10-10 4.9-.5 9.5-5.1 10-10z"
            />
          </svg>
        </span>
      );
    case "deepseek":
      return (
        <span className={cn(base, "bg-[#4D6BFE] text-white")} aria-hidden="true">
          DS
        </span>
      );
    case "glm":
      return (
        <span className={cn(base, "bg-gradient-to-br from-indigo-600 to-blue-500 text-white")} aria-hidden="true">
          GLM
        </span>
      );
  }
}
