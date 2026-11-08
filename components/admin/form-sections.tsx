import type { ReactNode } from "react";
import { CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The admin forms' look, shared by the customer and vendor editors: rounded
 * section cards whose titles carry a coloured icon, and a page title with the
 * vendor area's icon square.
 */
export const SECTION_CARD = "gap-4 rounded-2xl shadow-sm";

const SECTION_TONE = {
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
} as const;

export type SectionTone = keyof typeof SECTION_TONE;

/** A form card's title with a coloured icon. */
export function SectionTitle({
  icon,
  tone,
  children,
  className,
}: {
  icon: ReactNode;
  tone: SectionTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <CardTitle className={cn("flex items-center gap-2.5 text-base font-bold", className)}>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl [&_svg]:size-4", SECTION_TONE[tone])}>
        {icon}
      </span>
      {children}
    </CardTitle>
  );
}

const TITLE_TONE = {
  sky: "bg-sky-500",
  emerald: "bg-emerald-600",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
} as const;

/** The page title a form's sticky bar shows: an icon square and the heading. */
export function FormPageTitle({
  icon,
  tone,
  children,
}: {
  icon: ReactNode;
  tone: keyof typeof TITLE_TONE;
  children: ReactNode;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm [&_svg]:size-5",
          TITLE_TONE[tone],
        )}
      >
        {icon}
      </span>
      <span className="truncate text-xl font-extrabold tracking-tight">{children}</span>
    </span>
  );
}

/**
 * Up to two initials, one letter from the first and the last word. A Thai
 * word gives its first consonant: a leading vowel (เ แ โ ใ ไ) and tone or
 * vowel marks are skipped, so "ร้านทดสอบ ตัวอย่าง" reads "รต", not "ร้ตั".
 */
export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return picked
    .map((word) => Array.from(word).find((ch) => /\p{L}/u.test(ch) && !/[เแโใไ]/.test(ch)) ?? "")
    .join("")
    .toUpperCase();
}
