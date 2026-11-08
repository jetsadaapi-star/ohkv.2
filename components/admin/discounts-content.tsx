"use client";

import { cn } from "@/lib/utils";
import { MODERN_TABLE_CARD, statusRowClass, type StatusHue } from "@/components/vendor/status-tone";
import { pageLocale } from "@/lib/intl/date-locale";
import { useCallback, useMemo, useState } from "react";
import { useListNavigation } from "@/hooks/use-list-navigation";
import { useCurrency } from "@/providers/currency-provider";
import { apiClient } from "@/lib/api/client";
import { useTranslations } from "next-intl";
import {
  Pencil,
  Percent,
  Plus,
  TicketPercent,
  Truck,
  Trash2,
  CheckCircle2,
  CircleOff,
} from "lucide-react";
import { toast } from "@/components/ui/toast-notification";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  StatusCell,
  type DataTableAction,
  type DataTableBulkAction,
  type DataTableColumn,
  type DataTableTab,
} from "@/components/ui/data-table";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import {
  DiscountFormDialog,
  type CouponFormState,
  type CouponStatus,
  type CouponType,
} from "@/components/admin/discount-form-dialog";
import { buildAdminCommerceTableHeader } from "@/components/admin/admin-commerce-table-header";
import { useAdminPhrase } from "@/hooks/use-admin-phrase";


interface AdminCoupon {
  _id: string;
  code: string;
  label?: string;
  description?: string;
  type: CouponType;
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usedCount: number;
  perUserLimit?: number;
  startDate: string;
  endDate: string;
  status: CouponStatus;
  /** Store coupons only: who pays for the goods discount. Absent means the store. */
  fundedBy?: "platform" | "vendor";
  /** Offered in the shopper app's coupon list. */
  listed?: boolean;
}

interface DiscountsContentProps {
  locale: string;
  apiBasePath?: string;
  /** Rows for the current query string, fetched by the page. */
  data: AdminCoupon[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}


const DEFAULT_FORM: CouponFormState = {
  code: "",
  label: "",
  description: "",
  type: "percentage",
  value: "",
  minOrderAmount: "",
  maxDiscount: "",
  usageLimit: "",
  perUserLimit: "",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  status: "active",
  fundedBy: "platform",
  listed: false,
};

function getThrowableMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function formatDiscount(
  coupon: AdminCoupon,
  formatPrice: (value: number) => string,
) {
  if (coupon.type === "free_shipping") return "Free shipping";
  if (coupon.type === "percentage") return `${coupon.value}%`;
  return formatPrice(coupon.value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(pageLocale());
}

function toFormState(coupon?: AdminCoupon | null): CouponFormState {
  if (!coupon) return DEFAULT_FORM;
  return {
    code: coupon.code,
    label: coupon.label || "",
    description: coupon.description || "",
    type: coupon.type,
    value: String(coupon.value ?? ""),
    minOrderAmount:
      typeof coupon.minOrderAmount === "number" ? String(coupon.minOrderAmount) : "",
    maxDiscount: typeof coupon.maxDiscount === "number" ? String(coupon.maxDiscount) : "",
    usageLimit: typeof coupon.usageLimit === "number" ? String(coupon.usageLimit) : "",
    perUserLimit:
      typeof coupon.perUserLimit === "number" ? String(coupon.perUserLimit) : "",
    startDate: coupon.startDate.slice(0, 10),
    endDate: coupon.endDate.slice(0, 10),
    status: coupon.status,
    fundedBy: coupon.fundedBy === "vendor" ? "vendor" : "platform",
    listed: coupon.listed === true,
  };
}

export function DiscountsContent({
  apiBasePath = "/api/admin/coupons",
  data,
  pagination,
}: DiscountsContentProps) {
  const t = useTranslations();
  const tr = useAdminPhrase();
  const { confirm } = useConfirmation();
  const { currency, formatPrice } = useCurrency();
  const currencySymbol = currency?.symbol || currency?.code || "";

  // The store's coupon screen, as opposed to a vendor managing their own.
  const isStoreCoupon = apiBasePath === "/api/admin/coupons";
  const [selectedCoupons, setSelectedCoupons] = useState<AdminCoupon[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<AdminCoupon | null>(null);
  const [formState, setFormState] = useState<CouponFormState>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const list = useListNavigation<AdminCoupon>({
    items: data,
    pagination,
  });

  const openCreateDialog = () => {
    setEditingCoupon(null);
    setFormState(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (coupon: AdminCoupon) => {
    setEditingCoupon(coupon);
    setFormState(toFormState(coupon));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    if (isSaving) return;
    setDialogOpen(false);
  };

  const setField = <K extends keyof CouponFormState>(field: K, value: CouponFormState[K]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const setDiscountType = (type: CouponType) => {
    setFormState((prev) => ({
      ...prev,
      type,
      value: type === "free_shipping" ? "0" : prev.value === "0" ? "" : prev.value,
    }));
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      code: formState.code.trim().toUpperCase(),
      label: formState.label.trim() || undefined,
      description: formState.description.trim() || undefined,
      type: formState.type,
      value: formState.type === "free_shipping" ? 0 : Number(formState.value),
      startDate: formState.startDate || undefined,
      endDate: formState.endDate,
      status: formState.status,
      listed: formState.listed,
    };

    if (formState.minOrderAmount) payload.minOrderAmount = Number(formState.minOrderAmount);
    if (formState.maxDiscount) payload.maxDiscount = Number(formState.maxDiscount);
    if (formState.usageLimit) payload.usageLimit = Number(formState.usageLimit);
    if (formState.perUserLimit) payload.perUserLimit = Number(formState.perUserLimit);
    // Only the store's own coupons choose; a vendor's coupon is always theirs.
    if (isStoreCoupon) payload.fundedBy = formState.fundedBy;

    return payload;
  };

  const saveCoupon = async () => {
    if (!formState.code.trim() && !editingCoupon) {
      toast.error(tr("Discount code is required", "ডিসকাউন্ট কোড প্রয়োজন"));
      return;
    }
    if (
      formState.type !== "free_shipping" &&
      (!formState.value || Number(formState.value) <= 0)
    ) {
      toast.error(tr("Discount value must be greater than 0", "ডিসকাউন্ট মান ০ এর বেশি হতে হবে"));
      return;
    }
    if (!formState.endDate) {
      toast.error(tr("End date is required", "শেষ তারিখ প্রয়োজন"));
      return;
    }

    setIsSaving(true);
    try {
      const isEdit = Boolean(editingCoupon);
      const endpoint = isEdit
        ? `${apiBasePath}/${editingCoupon?._id}`
        : apiBasePath;

      const payload = buildPayload();

      if (isEdit) {
        delete payload.code;
      }

      if (isEdit) {
        await apiClient.put(endpoint, payload);
      } else {
        await apiClient.post(endpoint, payload);
      }

      toast.success(isEdit ? tr("Discount updated", "ডিসকাউন্ট আপডেট হয়েছে") : tr("Discount created", "ডিসকাউন্ট তৈরি হয়েছে"));
      setDialogOpen(false);
      list.refetch();
    } catch (error: unknown) {
      toast.error(getThrowableMessage(error, tr("Failed to save discount", "ডিসকাউন্ট সংরক্ষণ করা যায়নি")));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCoupon = useCallback(
    async (coupon: AdminCoupon) => {
      const confirmed = await confirm({
        title: tr("Delete Discount", "ডিসকাউন্ট মুছুন"),
        description: t("admin.discountsDataTable.deleteSingleDescription", { code: coupon.code }),
        confirmText: tr("Delete", "মুছুন"),
        cancelText: tr("Cancel", "বাতিল"),
        variant: "destructive",
      });

      if (!confirmed) return;

      try {
        await apiClient.delete(`${apiBasePath}/${coupon._id}`);
        toast.success(tr("Discount deleted", "ডিসকাউন্ট মুছে ফেলা হয়েছে"));
        list.refetch();
      } catch (error: unknown) {
        toast.error(getThrowableMessage(error, tr("Failed to delete discount", "ডিসকাউন্ট মুছতে ব্যর্থ")));
      }
    },
    [apiBasePath, confirm, list, tr],
  );

  const handleBulkDelete = useCallback(
    async (items: AdminCoupon[]) => {
      const confirmed = await confirm({
        title: tr("Delete Discounts", "ডিসকাউন্টসমূহ মুছুন"),
        description: t("admin.discountsDataTable.deleteBulkDescription", {
          count: items.length,
        }),
        confirmText: tr("Delete", "মুছুন"),
        cancelText: tr("Cancel", "বাতিল"),
        variant: "destructive",
      });

      if (!confirmed) return;

      const results = await Promise.allSettled(
        items.map((coupon) => apiClient.delete(`${apiBasePath}/${coupon._id}`)),
      );

      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failCount = items.length - successCount;

      setSelectedCoupons([]);
      list.refetch();

      if (successCount > 0) {
        toast.success(t("admin.discountsDataTable.deleteBulkSuccess", { count: successCount }));
      }
      if (failCount > 0) {
        toast.error(t("admin.discountsDataTable.deleteBulkError", { count: failCount }));
      }
    },
    [apiBasePath, confirm, list, t, tr],
  );

  const handleBulkStatusUpdate = useCallback(
    async (items: AdminCoupon[], status: CouponStatus) => {
      const confirmed = await confirm({
        title: tr("Update Discount Status", "ডিসকাউন্ট স্ট্যাটাস আপডেট"),
        description: t("admin.discountsDataTable.updateStatusDescription", {
          count: items.length,
          status,
        }),
        confirmText: tr("Update", "আপডেট"),
        cancelText: tr("Cancel", "বাতিল"),
      });

      if (!confirmed) return;

      const results = await Promise.allSettled(
        items.map((coupon) =>
          apiClient.put(`${apiBasePath}/${coupon._id}`, { status }),
        ),
      );

      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failCount = items.length - successCount;

      setSelectedCoupons([]);
      list.refetch();

      if (successCount > 0) {
        toast.success(t("admin.discountsDataTable.updateSuccess", { count: successCount }));
      }
      if (failCount > 0) {
        toast.error(t("admin.discountsDataTable.updateError", { count: failCount }));
      }
    },
    [apiBasePath, confirm, list, t, tr],
  );

  const columns = useMemo<DataTableColumn<AdminCoupon>[]>(
    () => [
      {
        id: "code",
        header: tr("Discount", "ডিসকাউন্ট"),
        cell: (row) => (
          <div className="min-w-0">
            <p
              className={cn(
                "truncate font-medium",
                // The code as a ticket: the thing a shopper types.
                "w-fit max-w-full rounded-md border border-dashed border-emerald-400 bg-emerald-50 px-2 py-0.5 font-mono text-xs font-bold tracking-wide text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300",
              )}
            >
              {row.code}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.label || row.description || tr("No label", "কোনো লেবেল নেই")}
            </p>
          </div>
        ),
        className: "w-[300px]",
      },
      {
        id: "type",
        header: tr("Type", "ধরন"),
        cell: (row) => (
          <Badge variant="outline" className="w-fit capitalize">
            {row.type === "percentage" ? (
              <>
                <Percent className="mr-1 h-3 w-3" />
                {tr("Percentage", "শতাংশ")}
              </>
            ) : row.type === "free_shipping" ? (
              <>
                <Truck className="mr-1 h-3 w-3" />
                {tr("Free shipping", "ফ্রি শিপিং")}
              </>
            ) : (
              <>
                <TicketPercent className="mr-1 h-3 w-3" />
                {tr("Fixed", "নির্দিষ্ট")}
              </>
            )}
          </Badge>
        ),
        className: "w-[130px]",
      },
      {
        id: "value",
        header: tr("Value", "মান"),
        cell: (row) => formatDiscount(row, formatPrice),
        className: "w-[100px]",
      },
      {
        id: "status",
        header: tr("Status", "স্ট্যাটাস"),
        cell: (row) => (
          <StatusCell
            status={row.status}
            statusMap={{
              active: { label: tr("Active", "সক্রিয়"), variant: "default" },
              inactive: { label: tr("Inactive", "নিষ্ক্রিয়"), variant: "outline" },
              expired: { label: tr("Expired", "মেয়াদোত্তীর্ণ"), variant: "destructive" },
            }}
          />
        ),
        className: "w-[120px]",
      },
      {
        id: "usage",
        header: tr("Usage", "ব্যবহার"),
        cell: (row) => (
          <span>
            {row.usedCount}
            {row.usageLimit ? ` / ${row.usageLimit}` : ""}
          </span>
        ),
        className: "w-[130px]",
      },
      {
        id: "schedule",
        header: tr("Schedule", "সময়সূচি"),
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {formatDate(row.startDate)} - {formatDate(row.endDate)}
          </span>
        ),
        className: "w-[220px]",
      },
    ],
    [tr, formatPrice],
  );

  const tabs = useMemo<DataTableTab[]>(
    () => [
      { id: "all", label: tr("All", "সব") },
      { id: "active", label: tr("Active", "সক্রিয়") },
      { id: "inactive", label: tr("Inactive", "নিষ্ক্রিয়") },
      { id: "expired", label: tr("Expired", "মেয়াদোত্তীর্ণ") },
    ],
    [tr],
  );

  const tableHeader = useMemo(
    () =>
      buildAdminCommerceTableHeader({
        title: tr("Discounts", "ডিসকাউন্ট"),
        addAction: {
          id: "add",
          label: tr("Add discount", "ডিসকাউন্ট যোগ করুন"),
          icon: <Plus className="h-4 w-4" />,
          variant: "default",
          onClick: openCreateDialog,
        },
      }),
    [tr],
  );

  const bulkActions = useMemo<DataTableBulkAction<AdminCoupon>[]>(
    () => [
      {
        id: "set-active",
        label: tr("Set active", "সক্রিয় করুন"),
        icon: <CheckCircle2 className="h-4 w-4" />,
        variant: "outline",
        onClick: (items) => handleBulkStatusUpdate(items, "active"),
      },
      {
        id: "set-inactive",
        label: tr("Set inactive", "নিষ্ক্রিয় করুন"),
        icon: <CircleOff className="h-4 w-4" />,
        variant: "outline",
        onClick: (items) => handleBulkStatusUpdate(items, "inactive"),
      },
      {
        id: "delete",
        label: tr("Delete", "মুছুন"),
        icon: <Trash2 className="h-4 w-4" />,
        variant: "destructive",
        onClick: handleBulkDelete,
      },
    ],
    [handleBulkDelete, handleBulkStatusUpdate, tr],
  );

  const rowActions = useCallback(
    (row: AdminCoupon): DataTableAction[] => [
      {
        id: "edit",
        label: tr("Edit", "এডিট"),
        icon: <Pencil className="h-4 w-4" />,
        onClick: () => openEditDialog(row),
      },
      {
        id: "delete",
        label: tr("Delete", "মুছুন"),
        icon: <Trash2 className="h-4 w-4" />,
        variant: "destructive",
        onClick: () => {
          void deleteCoupon(row);
        },
      },
    ],
    [deleteCoupon, tr],
  );

  return (
    <>
      <DataTable
        data={list.items}
        columns={columns}
        keyField="_id"
        isLoading={list.isLoading}
        loadingMode="rows"
        // No title: the admin and vendor pages carry their own heading.
        tabs={tabs}
        activeTab={list.activeTab}
        onTabChange={list.handleTabChange}
        actions={tableHeader.actions?.length ? tableHeader.actions : undefined}
        selectable
        selectedItems={selectedCoupons}
        onSelectionChange={setSelectedCoupons}
        bulkActions={bulkActions}
        searchable
        searchPlaceholder={tr("Search code, label, or description", "কোড, লেবেল বা বর্ণনা দিয়ে খুঁজুন")}
        searchValue={list.search}
        onSearchChange={list.handleSearchChange}
        toolbarActions={tableHeader.toolbarActions}
        toolbarLayout={tableHeader.toolbarLayout}
        tabsVariant={tableHeader.tabsVariant}
        filtersVariant={tableHeader.filtersVariant}
        appearance={tableHeader.appearance}
        stackedTopControls={tableHeader.stackedTopControls}
        showToolbarSortButton={tableHeader.showToolbarSortButton}
        pagination={list.pagination}
        onPageChange={list.handlePageChange}
        onPageSizeChange={list.handlePageSizeChange}
        rowActions={rowActions}
        rowActionsHeader={tr("Actions", "অ্যাকশন")}
        rowActionsVariant="inline"
        emptyMessage={tr("No discounts found", "কোনো ডিসকাউন্ট পাওয়া যায়নি")}
        emptyIcon={<TicketPercent className="h-8 w-8" />}
        className={MODERN_TABLE_CARD}
        rowClassName={(row) => statusRowClass(couponHue(row))}
      />

      <DiscountFormDialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        editing={Boolean(editingCoupon)}
        form={formState}
        setField={setField}
        setType={setDiscountType}
        isStoreCoupon={isStoreCoupon}
        currencySymbol={currencySymbol}
        formatPrice={formatPrice}
        saving={isSaving}
        onSave={saveCoupon}
        onCancel={closeDialog}
      />
    </>
  );
}

/** A coupon's row colour: live green, ending within a week amber, off grey, over red. */
function couponHue(coupon: { status: string; endDate?: string; usageLimit?: number; usedCount: number }): StatusHue {
  const end = coupon.endDate ? new Date(coupon.endDate).getTime() : Number.POSITIVE_INFINITY;
  const now = Date.now();
  if (coupon.status === "expired" || end < now) return "rose";
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return "rose";
  if (coupon.status !== "active") return "slate";
  if (end - now <= 7 * 24 * 60 * 60 * 1000) return "amber";
  return "emerald";
}
