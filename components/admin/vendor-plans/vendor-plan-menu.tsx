"use client";

import {
  Archive,
  ArchiveRestore,
  MoreVertical,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  planDeleteBlockedReason,
  type AdminPlanAction,
  type AdminVendorPlan,
} from "@/components/admin/vendor-plans/types";

interface VendorPlanMenuProps {
  plan: AdminVendorPlan;
  busy?: boolean;
  onAction: (action: AdminPlanAction, plan: AdminVendorPlan) => void;
}

/**
 * The ⋮ menu both catalogue views share. Delete stays in the menu even when it
 * cannot run, greyed out with the reason under it, so the admin sees why and
 * what to do instead.
 */
export function VendorPlanMenu({ plan, busy = false, onAction }: VendorPlanMenuProps) {
  const t = useTranslations("admin.hc.vendorPlanMenu");
  const archived = plan.status === "archived";
  const deleteBlocked = planDeleteBlockedReason(plan);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={busy}
          aria-label={t("actionsFor", { name: plan.name })}
          className="text-muted-foreground hover:text-foreground"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onSelect={() => onAction("edit", plan)}>
          <Pencil />
          {t("edit")}
        </DropdownMenuItem>
        {!archived && !plan.isDefault ? (
          <DropdownMenuItem onSelect={() => onAction("makeDefault", plan)}>
            <Star />
            {t("makeDefault")}
          </DropdownMenuItem>
        ) : null}
        {archived ? (
          <DropdownMenuItem onSelect={() => onAction("restore", plan)}>
            <ArchiveRestore />
            {t("restore")}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onAction("archive", plan)}>
            <Archive />
            {t("archive")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={Boolean(deleteBlocked)}
          onSelect={() => onAction("delete", plan)}
        >
          <Trash2 />
          {t("delete")}
        </DropdownMenuItem>
        {deleteBlocked ? (
          <p className="px-2 pb-1.5 pl-8 text-xs leading-4 text-muted-foreground">
            {deleteBlocked}
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
