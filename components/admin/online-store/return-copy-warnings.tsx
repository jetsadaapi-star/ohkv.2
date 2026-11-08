"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReturnPolicyCopyWarning } from "@/lib/site-config/return-policy-copy";

type Translate = ReturnType<typeof useTranslations>;

/** Message keys, per feature the copy asks for that the store lacks. */
const FEATURE_WARNINGS: Record<string, string> = {
  photos: "featurePhotos",
};

function describe(warning: ReturnPolicyCopyWarning, t: Translate): string {
  if (warning.kind === "feature") {
    const key = FEATURE_WARNINGS[warning.feature];
    return key ? t(key) : "";
  }
  const said = warning.days.map((days) => t("daysCount", { count: days })).join(", ");
  return warning.windowDays === null
    ? t("saysNoLimit", { said })
    : t("saysWindow", { said, days: warning.windowDays });
}

/**
 * Where a page's return copy no longer matches the store — shared by the
 * Return Policy and FAQ editors. The merchant's words are never changed for
 * them; this says where they have gone stale, and how to keep the window in
 * step for good.
 */
export function ReturnCopyWarnings({
  warnings,
  windowDays,
}: {
  warnings: ReturnPolicyCopyWarning[];
  /** Null for no time limit. */
  windowDays: number | null;
}) {
  const t = useTranslations("admin.hc.returnCopyWarnings");
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {t.rich("tokensHint", {
          code: (chunks) => (
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{chunks}</code>
          ),
          windowToken: "{windowDays}",
          storeToken: "{storeName}",
          current:
            windowDays === null
              ? t("noTimeLimit")
              : t("daysCount", { count: windowDays }),
        })}
      </p>
      {warnings.length > 0 ? (
        <div
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {t("mismatchTitle")}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            {warnings.map((warning) => (
              <li key={warning.kind === "days" ? "days" : warning.feature}>
                {describe(warning, t)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
