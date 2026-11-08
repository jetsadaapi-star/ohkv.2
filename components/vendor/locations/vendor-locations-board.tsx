"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Globe,
  MapPin,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShoppingBag,
  Star,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { LocationFormDialog } from "@/components/pos/location-form-dialog";
import { StoreProfileNotice, storeProfileCodeOf } from "@/components/admin/store-profile-notice";
import { dispatchesOnlineOrders, rankFulfillmentCandidates } from "@/lib/locations/dispatch-order";
import { cn } from "@/lib/utils";

interface Location {
  _id: string;
  name: string;
  address?: string;
  isDefault: boolean;
  isActive: boolean;
  pickupEnabled?: boolean;
  fulfillsOnlineOrders?: boolean;
  sellsAtCounter?: boolean;
  acceptsReturns?: boolean;
  fulfillmentPriority?: number;
  createdAt: string;
  updatedAt: string;
}

const putLocation = (id: string, body: Record<string, unknown>) =>
  fetch(`/api/admin/locations/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((res) => res.json());

/**
 * A vendor's shops, warehouses and collection points as cards. The same
 * endpoints and rules as the shared locations table (components/pos/
 * locations-content.tsx): the dispatch order is ranked with the checkout's own
 * function, so the numbers here are the order orders really ship in.
 */
export function VendorLocationsBoard() {
  const t = useTranslations();
  const tv = useTranslations("admin.hc.vendorLocations");
  const { confirm } = useConfirmation();
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [profileProblem, setProfileProblem] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const json = await fetch("/api/admin/locations?includeInactive=true").then((res) => res.json());
      if (json.success) {
        setProfileProblem(null);
        setLocations(json.data || []);
        return;
      }
      const problem = storeProfileCodeOf(json);
      setProfileProblem(problem);
      if (!problem) toast.error(json.message || t("locations.fetchError"));
    } catch {
      toast.error(t("locations.fetchError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const dispatchOrder = useMemo(() => rankFulfillmentCandidates(locations.filter(dispatchesOnlineOrders)), [locations]);
  const rankOf = useCallback((id: string) => dispatchOrder.findIndex((entry) => entry.id === id), [dispatchOrder]);

  const counts = useMemo(
    () => ({
      all: locations.length,
      active: locations.filter((l) => l.isActive).length,
      inactive: locations.filter((l) => !l.isActive).length,
      pickup: locations.filter((l) => l.isActive && l.pickupEnabled).length,
      dispatch: dispatchOrder.length,
    }),
    [locations, dispatchOrder.length],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return locations
      .filter((l) => (tab === "active" ? l.isActive : tab === "inactive" ? !l.isActive : true))
      .filter((l) => !q || l.name.toLowerCase().includes(q) || l.address?.toLowerCase().includes(q))
      .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || Number(b.isActive) - Number(a.isActive));
  }, [locations, query, tab]);

  const run = async (id: string, work: () => Promise<{ success?: boolean; message?: string }>, ok: string) => {
    setBusyId(id);
    try {
      const json = await work();
      if (json.success) {
        toast.success(ok);
        await load();
      } else toast.error(json.message || t("locations.updateError"));
    } catch {
      toast.error(t("locations.updateError"));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (location: Location) => {
    if (location.isDefault) {
      toast.error(t("locations.cannotDeleteDefault"));
      return;
    }
    const ok = await confirm({
      title: t("locations.deleteTitle"),
      description: t("locations.deleteDescription", { name: location.name }),
      confirmText: t("common.delete"),
      cancelText: t("common.cancel"),
      variant: "destructive",
    });
    if (!ok) return;
    await run(
      location._id,
      () => fetch(`/api/admin/locations/${location._id}`, { method: "DELETE" }).then((res) => res.json()),
      t("locations.deleted"),
    );
  };

  // Swap with the neighbour in the dispatch queue — both written explicitly,
  // since several branches can share the default priority.
  const move = async (location: Location, direction: -1 | 1) => {
    const index = rankOf(location._id);
    const swapWith = dispatchOrder[index + direction];
    if (index < 0 || !swapWith) return;
    setBusyId(location._id);
    try {
      await Promise.all([
        putLocation(location._id, { fulfillmentPriority: index + direction }),
        putLocation(swapWith.id, { fulfillmentPriority: index }),
      ]);
      await load();
    } catch {
      toast.error(t("locations.saveError"));
    } finally {
      setBusyId(null);
    }
  };

  const openForm = (location: Location | null) => {
    setEditing(location);
    setDialogOpen(true);
  };

  return (
    <section className="space-y-5">
      {profileProblem ? <StoreProfileNotice code={profileProblem} /> : null}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{t("locations.title")}</h1>
          <p className="text-sm text-muted-foreground">{tv("subtitle")}</p>
        </div>
        <Button
          onClick={() => openForm(null)}
          disabled={Boolean(profileProblem)}
          className="gap-1.5 rounded-full bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
        >
          <Plus className="size-4" />
          {t("locations.addLocation")}
        </Button>
      </div>

      {/* Stats */}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {(
          [
            { key: "all", value: counts.all, icon: MapPin, tone: "from-slate-50 ring-slate-200 text-slate-700 dark:from-slate-500/10", iconTone: "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" },
            { key: "active", value: counts.active, icon: CheckCircle2, tone: "from-emerald-50 ring-emerald-200 text-emerald-700 dark:from-emerald-500/10", iconTone: "bg-emerald-500 text-white" },
            { key: "dispatch", value: counts.dispatch, icon: Truck, tone: "from-sky-50 ring-sky-200 text-sky-700 dark:from-sky-500/10", iconTone: "bg-sky-500 text-white" },
            { key: "pickup", value: counts.pickup, icon: Package, tone: "from-violet-50 ring-violet-200 text-violet-700 dark:from-violet-500/10", iconTone: "bg-violet-500 text-white" },
          ] as const
        ).map(({ key, value, icon: Icon, tone, iconTone }) => (
          <div key={key} className={cn("flex min-w-[9.5rem] shrink-0 snap-start items-center gap-3 rounded-2xl bg-linear-to-br to-white p-3 ring-1 ring-inset sm:min-w-0 sm:p-4 dark:to-card", tone)}>
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm sm:size-10", iconTone)}>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium opacity-80">{tv(`stat.${key}`)}</p>
              {isLoading && locations.length === 0 ? (
                <Skeleton className="mt-1 h-6 w-10" />
              ) : (
                <p className="text-xl font-extrabold tracking-tight text-foreground tabular-nums sm:text-2xl">{value}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="flex gap-1.5">
          {(["all", "active", "inactive"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
                tab === id ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
              )}
            >
              {id === "all" ? t("locations.all") : id === "active" ? t("locations.active") : t("locations.inactive")}
              <span className={cn("rounded-full px-1.5 text-[11px] font-bold tabular-nums", tab === id ? "bg-background/20" : "bg-muted text-muted-foreground")}>
                {counts[id]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative min-w-[14rem] flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("locations.searchPlaceholder")} className="h-10 rounded-full ps-9 pe-9" />
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={tv("clearSearch")}>
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Cards */}
      {isLoading && locations.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : (
        <ul className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", isLoading && "opacity-70")}>
          {shown.map((location) => {
            const rank = rankOf(location._id);
            const busy = busyId === location._id;
            return (
              <li
                key={location._id}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-md",
                  location.isActive
                    ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/5"
                    : "border-slate-200 bg-slate-100/80 dark:border-slate-500/30 dark:bg-slate-500/10",
                )}
              >
                <div className="flex items-start gap-3 p-4">
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm",
                      location.isActive ? "bg-emerald-500 text-white" : "bg-slate-400 text-white",
                    )}
                  >
                    <MapPin className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button type="button" onClick={() => openForm(location)} className="truncate text-start text-base font-bold hover:underline">
                        {location.name}
                      </button>
                      {location.isDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          <Star className="size-3 fill-current" />
                          {t("locations.default")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{location.address || tv("noAddress")}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-full" disabled={busy} aria-label={t("locations.actions")}>
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => openForm(location)}>
                        <Pencil className="size-4" />
                        {t("common.edit")}
                      </DropdownMenuItem>
                      {!location.isDefault ? (
                        <DropdownMenuItem onClick={() => void run(location._id, () => putLocation(location._id, { isDefault: true }), t("locations.setAsDefault"))}>
                          <Star className="size-4" />
                          {t("locations.setDefault")}
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        onClick={() =>
                          void run(
                            location._id,
                            () => putLocation(location._id, { isActive: !location.isActive }),
                            location.isActive ? t("locations.deactivated") : t("locations.activated"),
                          )
                        }
                      >
                        {location.isActive ? <ToggleLeft className="size-4" /> : <ToggleRight className="size-4" />}
                        {location.isActive ? t("locations.deactivate") : t("locations.activate")}
                      </DropdownMenuItem>
                      {!location.isDefault ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void remove(location)}>
                            <Trash2 className="size-4" />
                            {t("common.delete")}
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* What this place does */}
                <div className="flex flex-wrap gap-1.5 px-4">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      location.isActive ? "bg-emerald-600 text-white" : "bg-slate-500 text-white",
                    )}
                  >
                    {location.isActive ? t("locations.active") : t("locations.inactive")}
                  </span>
                  {rank >= 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                      <Globe className="size-3" />
                      {tv("shipsOnline")}
                    </span>
                  ) : null}
                  {location.pickupEnabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                      <Package className="size-3" />
                      {t("locations.pickup")}
                    </span>
                  ) : null}
                  {location.acceptsReturns ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                      <RotateCcw className="size-3" />
                      {t("locations.returns")}
                    </span>
                  ) : null}
                  {location.sellsAtCounter === false ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                      {t("locations.noTill")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-pink-100 px-2.5 py-1 text-[11px] font-semibold text-pink-700 dark:bg-pink-500/15 dark:text-pink-300">
                      <ShoppingBag className="size-3" />
                      {tv("counter")}
                    </span>
                  )}
                </div>

                {/* Dispatch queue */}
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-black/5 px-4 py-3 dark:border-white/10">
                  {rank >= 0 ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-sm font-extrabold text-background tabular-nums">
                          {rank + 1}
                        </span>
                        <div className="leading-tight">
                          <p className="text-xs font-semibold">{tv("dispatchOrder")}</p>
                          <p className="text-[11px] text-muted-foreground">{tv("dispatchOf", { count: dispatchOrder.length })}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 rounded-full bg-background"
                          disabled={busy || rank === 0}
                          onClick={() => void move(location, -1)}
                          aria-label={t("locations.shipSooner")}
                          title={t("locations.shipSooner")}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 rounded-full bg-background"
                          disabled={busy || rank >= dispatchOrder.length - 1}
                          onClick={() => void move(location, 1)}
                          aria-label={t("locations.shipLater")}
                          title={t("locations.shipLater")}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">{tv("notDispatching")}</p>
                  )}
                </div>
              </li>
            );
          })}

          {!profileProblem ? (
            <li>
              <button
                type="button"
                onClick={() => openForm(null)}
                className="flex h-full min-h-[13rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-muted-foreground transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-700 dark:hover:bg-emerald-500/5"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                  <Plus className="size-6" />
                </span>
                <span className="text-sm font-semibold">{t("locations.addLocation")}</span>
                <span className="px-6 text-center text-[11px]">{tv("addHint")}</span>
              </button>
            </li>
          ) : null}
        </ul>
      )}

      {!isLoading && shown.length === 0 && locations.length > 0 ? (
        <p className="text-center text-sm text-muted-foreground">{tv("noMatch")}</p>
      ) : null}

      <LocationFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        location={editing}
        onSuccess={() => {
          setDialogOpen(false);
          setEditing(null);
          void load();
        }}
      />
    </section>
  );
}
