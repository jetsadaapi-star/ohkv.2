"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import type { ComponentProps } from "react";
import { GripVertical, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/providers/currency-provider";
import {
  missingPlanPacksLabel,
  planPriceParts,
  planToolsSummary,
} from "@/components/vendor-plans/plan-copy";
import type { AdminVendorPlan } from "@/components/admin/vendor-plans/types";

export function PlanDefaultBadge() {
  const t = useTranslations("admin.hc.vendorPlanParts");
  return (
    <Badge
      variant="secondary"
      className="border-transparent bg-primary/10 text-[11px] font-semibold text-primary"
    >
      {t("default")}
    </Badge>
  );
}

export function PlanStatusBadge({ status }: { status: AdminVendorPlan["status"] }) {
  const t = useTranslations("admin.hc.vendorPlanParts");
  // The shared status palette: an active plan green, an archived one grey.
  return (
    <StatusBadge status={status}>
      {status === "archived" ? t("statusArchived") : t("statusActive")}
    </StatusBadge>
  );
}

/** Only a problem gets a line: an active paid plan with no live Stripe price. */
export function PlanStripeMissing({ className }: { className?: string }) {
  const t = useTranslations("admin.hc.vendorPlanParts");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium whitespace-nowrap text-amber-700 dark:text-amber-400",
        className,
      )}
      title={t("stripeMissingTitle")}
    >
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      {t("stripeNotLinked")}
    </span>
  );
}

/** "$29 /month" — the number carries the weight, the cadence stays quiet. */
export function PlanPrice({
  plan,
  amountClassName,
  cadenceClassName,
}: {
  plan: AdminVendorPlan;
  amountClassName?: string;
  cadenceClassName?: string;
}) {
  const { currency } = useCurrency();
  const { amount, cadence } = planPriceParts(plan, currency.code);
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span className={cn("font-semibold text-foreground", amountClassName)}>
        {amount}
      </span>
      {cadence ? (
        <span className={cn("text-muted-foreground", cadenceClassName)}>
          {cadence}
        </span>
      ) : null}
    </span>
  );
}

/** "All tools" / "All but AI Studio" / "7 of 11 tools", with the gaps on hover. */
export function PlanToolsSummary({
  plan,
  className,
}: {
  plan: Pick<AdminVendorPlan, "packs">;
  className?: string;
}) {
  const summary = planToolsSummary(plan.packs);
  const missing = missingPlanPacksLabel(plan.packs);
  if (!missing || !summary.includes(" of ")) {
    return <span className={className}>{summary}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "cursor-default underline decoration-dotted underline-offset-2",
            className,
          )}
        >
          {summary}
        </span>
      </TooltipTrigger>
      <TooltipContent>{missing}</TooltipContent>
    </Tooltip>
  );
}

/** The grip a plan is dragged by; keyboard users pick it up with Space. */
export function PlanDragHandle({
  planName,
  className,
  ...props
}: { planName: string } & ComponentProps<"button">) {
  const t = useTranslations("admin.hc.vendorPlanParts");
  return (
    <button
      type="button"
      aria-label={t("reorder", { name: planName })}
      className={cn(
        "grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground active:cursor-grabbing",
        className,
      )}
      {...props}
    >
      <GripVertical className="size-4" />
    </button>
  );
}
