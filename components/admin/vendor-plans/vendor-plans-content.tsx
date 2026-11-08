"use client";

import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { CreditCard, Eye, LayoutGrid, Layers, Percent, Plus, Rows3, Store } from "lucide-react";
import { AdminStatsStrip } from "@/components/admin/admin-stats-strip";
import { VendorPageHeader } from "@/components/vendor/vendor-page-header";
import { useTranslations } from "next-intl";
import { useRouter } from "@/hooks/use-locale-navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { useApplyOnChange } from "@/hooks/use-apply-on-change";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { VendorPlansList } from "@/components/admin/vendor-plans/vendor-plans-list";
import { VendorPlansGrid } from "@/components/admin/vendor-plans/vendor-plans-grid";
import { VendorPlansPreview } from "@/components/admin/vendor-plans/vendor-plans-preview";
import type {
  AdminPlanAction,
  AdminVendorPlan,
  CommissionOnlySummary,
} from "@/components/admin/vendor-plans/types";

type PlansView = "list" | "cards";

// Each admin keeps the view they picked, in this browser only.
const VIEW_STORAGE_KEY = "admin-vendor-plans-view";
const VIEW_CHANGE_EVENT = "admin-vendor-plans-view-change";

function subscribeToView(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(VIEW_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(VIEW_CHANGE_EVENT, callback);
  };
}

function getViewSnapshot(): PlansView {
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "cards"
      ? "cards"
      : "list";
  } catch {
    return "list";
  }
}

function getServerViewSnapshot(): PlansView {
  return "list";
}

function setStoredView(view: PlansView) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Private mode or blocked storage: the switch still works for this visit.
  }
  window.dispatchEvent(new Event(VIEW_CHANGE_EVENT));
}

const PLANS_API = "/api/admin/vendors/plans";

interface VendorPlansContentProps {
  locale: string;
  plans: AdminVendorPlan[];
  commissionOnly: CommissionOnlySummary;
}

export function VendorPlansContent({
  locale,
  plans,
  commissionOnly,
}: VendorPlansContentProps) {
  const t = useTranslations("admin.hc.vendorPlansContent");
  const tp = useTranslations("admin.hc.adminPages.vendorPlans");
  const router = useRouter();
  const { confirm } = useConfirmation();
  const isMobile = useIsMobile();
  const basePath = `/${locale}/admin/vendors/plans`;

  const storedView = useSyncExternalStore(
    subscribeToView,
    getViewSnapshot,
    getServerViewSnapshot,
  );
  // A click wins for the rest of the visit even where storage is blocked.
  const [pickedView, setPickedView] = useState<PlansView | null>(null);
  const view = pickedView ?? storedView;
  const chooseView = (next: PlansView) => {
    setPickedView(next);
    setStoredView(next);
  };

  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Offered plans in the order vendors see them. Held locally so a drag shows
  // at once; the server's order takes over again whenever it re-renders.
  const [order, setOrder] = useState<string[]>([]);
  useApplyOnChange([plans], () => {
    setOrder(plans.filter((p) => p.status === "active").map((p) => p.id));
  });

  const byId = useMemo(
    () => new Map(plans.map((plan) => [plan.id, plan])),
    [plans],
  );
  const activePlans = useMemo(
    () =>
      order
        .map((id) => byId.get(id))
        .filter((plan): plan is AdminVendorPlan => Boolean(plan)),
    [order, byId],
  );
  const archivedPlans = useMemo(
    () => plans.filter((plan) => plan.status === "archived"),
    [plans],
  );

  const handleReorder = useCallback(
    async (activeId: string, overId: string) => {
      const from = order.indexOf(activeId);
      const to = order.indexOf(overId);
      if (from < 0 || to < 0 || from === to) return;

      const previous = order;
      const next = arrayMove(order, from, to);
      setOrder(next);
      try {
        await apiClient.put(`${PLANS_API}/reorder`, {
          ids: [...next, ...archivedPlans.map((plan) => plan.id)],
        });
        toast.success(t("orderSaved"));
        router.refresh();
      } catch (error) {
        setOrder(previous);
        toast.error(
          error instanceof Error ? error.message : t("orderSaveFailed"),
        );
      }
    },
    [order, archivedPlans, router, t],
  );

  const runUpdate = useCallback(
    async (
      plan: AdminVendorPlan,
      body: Record<string, unknown>,
      success: string,
      failure: string,
    ) => {
      setBusyId(plan.id);
      try {
        await apiClient.put(`${PLANS_API}/${plan.id}`, body);
        toast.success(success);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : failure);
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  const handleAction = useCallback(
    async (action: AdminPlanAction, plan: AdminVendorPlan) => {
      switch (action) {
        case "edit":
          router.push(`${basePath}/${plan.id}/edit`);
          return;
        case "makeDefault":
          await runUpdate(
            plan,
            { isDefault: true },
            t("makeDefaultSuccess", { name: plan.name }),
            t("makeDefaultFailed"),
          );
          return;
        case "archive":
          await runUpdate(
            plan,
            { status: "archived" },
            t("archiveSuccess", { name: plan.name }),
            t("archiveFailed"),
          );
          return;
        case "restore":
          await runUpdate(
            plan,
            { status: "active" },
            t("restoreSuccess", { name: plan.name }),
            t("restoreFailed"),
          );
          return;
        case "delete": {
          const confirmed = await confirm({
            title: t("deleteTitle"),
            description: t("deleteDescription", { name: plan.name }),
            confirmText: t("delete"),
            cancelText: t("cancel"),
            variant: "destructive",
          });
          if (!confirmed) return;
          setBusyId(plan.id);
          try {
            await apiClient.delete(`${PLANS_API}/${plan.id}`);
            toast.success(t("deleted"));
            router.refresh();
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : t("deleteFailed"),
            );
          } finally {
            setBusyId(null);
          }
        }
      }
    },
    [basePath, confirm, router, runUpdate, t],
  );

  const addPlan = () => router.push(`${basePath}/new`);

  return (
    <div className="space-y-5">
      <VendorPageHeader
        icon={<Layers />}
        tone="violet"
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            {plans.length > 0 ? (
              <div
                role="group"
                aria-label={t("layout")}
                className="flex items-center gap-0.5 rounded-full border bg-card p-0.5"
              >
                <ViewButton
                  label={t("viewList")}
                  active={view === "list"}
                  onClick={() => chooseView("list")}
                >
                  <Rows3 className="size-4" />
                </ViewButton>
                <ViewButton
                  label={t("viewCards")}
                  active={view === "cards"}
                  onClick={() => chooseView("cards")}
                >
                  <LayoutGrid className="size-4" />
                </ViewButton>
              </div>
            ) : null}
            {activePlans.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => setPreviewOpen(true)}
                aria-label={t("vendorView")}
              >
                <Eye className="size-4" />
                <span className="hidden sm:inline">{t("vendorView")}</span>
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={addPlan}
            >
              <Plus className="size-4" />
              {t("addPlan")}
            </Button>
          </>
        }
      />

      {/* Counted from the plans the page already holds. */}
      <AdminStatsStrip
        variant="tiles"
        items={[
          { title: tp("activePlans"), description: tp("activePlans"), value: activePlans.length, icon: <Layers />, iconClassName: "bg-violet-100" },
          {
            title: tp("vendorsOnPlans"),
            description: tp("vendorsOnPlans"),
            value: plans.reduce((sum, plan) => sum + plan.vendorCount, 0),
            icon: <Store />,
            iconClassName: "bg-green-100",
          },
          {
            title: tp("activeSubscriptions"),
            description: tp("activeSubscriptions"),
            value: plans.reduce((sum, plan) => sum + plan.activeSubscriptionCount, 0),
            icon: <CreditCard />,
            iconClassName: "bg-blue-100",
          },
          {
            title: tp("commissionOnly"),
            description: tp("commissionOnlyHint", { rate: commissionOnly.rate }),
            value: commissionOnly.vendorCount,
            icon: <Percent />,
            iconClassName: "bg-amber-100",
          },
        ]}
      />

      {plans.length === 0 ? (
        <Card className="rounded-2xl border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
              <Layers className="size-5" />
            </span>
            <div className="space-y-1">
              <h2 className="text-base font-semibold">{t("emptyTitle")}</h2>
              <p className="max-w-md text-[13px] leading-5 text-muted-foreground">
                {t("emptyDescription", { rate: commissionOnly.rate })}
              </p>
            </div>
            <Button type="button" size="sm" onClick={addPlan}>
              <Plus className="size-4" />
              {t("addPlan")}
            </Button>
          </CardContent>
        </Card>
      ) : view === "cards" ? (
        <VendorPlansGrid
          activePlans={activePlans}
          archivedPlans={archivedPlans}
          commissionOnly={commissionOnly}
          basePath={basePath}
          busyId={busyId}
          onAction={handleAction}
          onReorder={handleReorder}
          onAdd={addPlan}
        />
      ) : (
        <VendorPlansList
          activePlans={activePlans}
          archivedPlans={archivedPlans}
          commissionOnly={commissionOnly}
          basePath={basePath}
          busyId={busyId}
          compact={isMobile}
          onAction={handleAction}
          onReorder={handleReorder}
        />
      )}

      <VendorPlansPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        plans={activePlans}
      />
    </div>
  );
}

function ViewButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={cn(
            "grid size-7 place-items-center rounded-full transition-colors",
            active
              ? "bg-violet-600 text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
