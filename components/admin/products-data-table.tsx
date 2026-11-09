"use client";

import type { StaffResourceActions } from "@/lib/access/staff-resource-actions";

import { useTranslations } from "next-intl";
import { useRouter } from "@/hooks/use-locale-navigation";
import { useState, useCallback, useMemo } from "react";
import { useListNavigation } from "@/hooks/use-list-navigation";
import { apiClient } from "@/lib/api/client";
import {
  Plus,
  Download,
  Upload,
  ChevronsUpDown,
  Eye,
  Pencil,
  Trash2,
  Archive,
  CheckCircle2,
  CircleDot,
  FileDown,
  ShoppingBag,
  Globe,
  Star,
  Tag,
} from "lucide-react";
import Link from "@/components/language/link";
import {
  DataTable,
  ImageCell,
  StatusCell,
  TextCell,
  type DataTableColumn,
  type DataTableTab,
  type DataTableAction,
  type DataTableBulkAction,
  type DataTableFilter,
} from "@/components/ui/data-table";
import { toast } from "@/components/ui/toast-notification";
import { useCurrency } from "@/providers/currency-provider";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { buildAdminCommerceTableHeader } from "@/components/admin/admin-commerce-table-header";
import { MODERN_TABLE_CARD, productRowHue } from "@/components/vendor/status-tone";
import { cn } from "@/lib/utils";
import {
  ProductImportDialog,
  downloadProductImportSample,
} from "@/components/admin/product-import-dialog";
import type { ProductListItem as Product } from "@/types/product-list";


interface ProductsDataTableProps {
  locale: string;
  area?: "admin" | "staff";
  readOnly?: boolean;
  actionAccess?: StaffResourceActions;
  /** Rows for the current query string, fetched by the page. */
  data: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  /** Vendors present in the result set, for the vendor filter. */
  vendorOptions?: { label: string; value: string }[];
  isMultiVendor?: boolean;
}

const PRODUCT_FILTER_IDS = ["vendor", "source", "tag"];
const PRODUCTS_IMPORT_ENDPOINT = "/api/admin/products/import-export";

/** The status dropdown offers "archived"; the tab it drives is "unlisted". */
function normalizeStatus(status?: string) {
  if (status === "archived") return "unlisted";
  return status || "all";
}

export function ProductsDataTable({
  locale,
  area = "admin",
  readOnly = false,
  actionAccess,
  data,
  pagination,
  vendorOptions = [],
  isMultiVendor = false,
}: ProductsDataTableProps) {
  const canCreate = !readOnly && (actionAccess?.canCreate ?? true);
  const canEdit = !readOnly && (actionAccess?.canEdit ?? true);
  const canDelete = !readOnly && (actionAccess?.canDelete ?? true);
  const t = useTranslations();
  const th = useTranslations("admin.hc.productsDataTable");
  const router = useRouter();
  const { confirm } = useConfirmation();
  const { formatPrice: formatCurrency } = useCurrency();

  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const basePath = `/${locale}/${area}`;
  const modern = area === "admin";

  const list = useListNavigation<Product>({
    items: data,
    pagination,
    filterIds: PRODUCT_FILTER_IDS,
  });

  const tagOptions = useMemo(
    () =>
      Array.from(
        new Set(list.items.flatMap((p) => (Array.isArray(p.tags) ? p.tags : []))),
      ).map((tag) => ({ label: tag, value: tag })),
    [list.items],
  );

  // The "statuses" dropdown filter mirrors the active tab.
  const handleStatusChange = useCallback(
    (value: string) => {
      list.handleTabChange(normalizeStatus(value));
    },
    [list],
  );

  const handleDelete = useCallback(
    async (product: Product) => {
      const confirmed = await confirm({
        title: t("admin.productsDataTable.dialogs.deleteSingle.title"),
        description: t(
          "admin.productsDataTable.dialogs.deleteSingle.description",
          { name: product.title || product.name },
        ),
        confirmText: t("admin.productsDataTable.dialogs.deleteSingle.confirm"),
        cancelText: t("admin.productsDataTable.dialogs.deleteSingle.cancel"),
        variant: "destructive",
      });

      if (!confirmed) return;

      try {
        await apiClient.delete(`/api/admin/products/${product._id}`);
        toast.success(
          t("admin.productsDataTable.toasts.deleteSingleSuccess"),
        );
        list.refetch();
      } catch {
        toast.error(t("admin.productsDataTable.toasts.deleteSingleError"));
      }
    },
    [confirm, list, t],
  );

  const handleBulkDelete = useCallback(
    async (items: Product[]) => {
      const confirmed = await confirm({
        title: t("admin.productsDataTable.dialogs.deleteBulk.title"),
        description: t(
          "admin.productsDataTable.dialogs.deleteBulk.description",
          {
            count: items.length,
          },
        ),
        confirmText: t("admin.productsDataTable.dialogs.deleteBulk.confirm"),
        cancelText: t("admin.productsDataTable.dialogs.deleteBulk.cancel"),
        variant: "destructive",
      });

      if (!confirmed) return;

      try {
        await Promise.all(
          items.map((product) =>
            apiClient.delete(`/api/admin/products/${product._id}`),
          ),
        );
        toast.success(
          t("admin.productsDataTable.toasts.deleteBulkSuccess", {
            count: items.length,
          }),
        );
        setSelectedProducts([]);
        list.refetch();
      } catch {
        toast.error(t("admin.productsDataTable.toasts.deleteBulkError"));
      }
    },
    [confirm, list, t],
  );

  const handleBulkStatusUpdate = useCallback(
    async (items: Product[], status: Product["status"]) => {
      const confirmed = await confirm({
        title: t("admin.productsDataTable.dialogs.updateStatus.title"),
        description: t(
          "admin.productsDataTable.dialogs.updateStatus.description",
          {
            count: items.length,
            status,
          },
        ),
        confirmText: t("admin.productsDataTable.dialogs.updateStatus.confirm"),
        cancelText: t("admin.productsDataTable.dialogs.updateStatus.cancel"),
      });

      if (!confirmed) return;

      const results = await Promise.allSettled(
        items.map((product) =>
          apiClient.put(`/api/admin/products/${product._id}`, { status }),
        ),
      );

      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failCount = items.length - successCount;

      setSelectedProducts([]);
      list.refetch();

      if (successCount > 0) {
        toast.success(
          t("admin.productsDataTable.toasts.updateSuccess", {
            count: successCount,
          }),
        );
      }
      if (failCount > 0) {
        toast.error(
          t("admin.productsDataTable.toasts.updateError", {
            count: failCount,
          }),
        );
      }
    },
    [confirm, list, t],
  );

  const buildImportExportParams = useCallback(() => {
    const params = new URLSearchParams();
    if (list.search) params.set("search", list.search);
    if (list.activeTab && list.activeTab !== "all") {
      params.set("status", list.activeTab);
    }
    if (isMultiVendor && list.filters.vendor && list.filters.vendor !== "all") {
      params.set("vendor", list.filters.vendor);
    }
    if (isMultiVendor && list.filters.source && list.filters.source !== "all") {
      params.set("source", list.filters.source);
    }
    if (list.filters.tag && list.filters.tag !== "all") {
      params.set("tag", list.filters.tag);
    }
    if (list.sortBy) params.set("sortBy", list.sortBy);
    if (list.sortOrder) params.set("sortOrder", list.sortOrder);
    return params;
  }, [
    isMultiVendor,
    list.activeTab,
    list.filters.source,
    list.filters.tag,
    list.filters.vendor,
    list.search,
    list.sortBy,
    list.sortOrder,
  ]);

  const handleExportProducts = useCallback(async () => {
    try {
      const params = buildImportExportParams();
      const res = await fetch(
        `${PRODUCTS_IMPORT_ENDPOINT}?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(th("exportSuccess"));
    } catch {
      toast.error(th("exportFailed"));
    }
  }, [buildImportExportParams, th]);

  const handleImportProducts = useCallback(() => {
    setImportOpen(true);
  }, []);

  const handleDownloadSample = useCallback(async () => {
    try {
      await downloadProductImportSample(PRODUCTS_IMPORT_ENDPOINT, "csv");
    } catch {
      toast.error(t("admin.productsDataTable.importDialog.sampleFailed"));
    }
  }, [t]);

  const handleImported = useCallback(() => {
    list.handlePageChange(1);
    list.refetch();
  }, [list]);

  // Price display helper
  const formatPrice = useCallback(
    (row: Product) => {
      const variantPrices = row.variants
        ?.map((v) => v.price)
        .filter((p): p is number => p != null && p > 0);

      if (variantPrices && variantPrices.length > 1) {
        const min = Math.min(...variantPrices);
        const max = Math.max(...variantPrices);
        if (min !== max) {
          return `${formatCurrency(min)} – ${formatCurrency(max)}`;
        }
      }

      return formatCurrency(row.price);
    },
    [formatCurrency],
  );

  // Column definitions. The category rides under the name and the sales
  // channels are icons, so the columns that matter fit without scrolling.
  const columns = useMemo<DataTableColumn<Product>[]>(
    () => [
      {
        id: "product",
        header: t("admin.productsDataTable.columns.product"),
        cell: (row) => {
          const href = !canEdit ? `/${locale}/products/${row.slug}` : `${basePath}/products/${row._id}/edit`;
          const title = row.title || row.name;
          return (
            <div className="flex w-[min(236px,58vw)] min-w-0 items-center gap-3 whitespace-normal">
              <span className="shrink-0 overflow-hidden rounded-xl ring-1 ring-border/70 [&>div]:rounded-xl">
                <ImageCell src={row.images?.[0] || row.media?.[0]?.url} alt={title} size="lg" rounded="lg" />
              </span>
              <div className="min-w-0">
                <Link
                  href={href}
                  onClick={(event) => event.stopPropagation()}
                  title={title}
                  className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors hover:text-primary"
                >
                  {title}
                </Link>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-md bg-muted/70 px-1.5 py-0.5">
                    <Tag className="size-3 shrink-0" />
                    <span className="truncate">{row.category?.name || t("admin.productsDataTable.columns.uncategorized")}</span>
                  </span>
                  {row.featured ? (
                    <span className="inline-flex items-center gap-0.5 rounded-md bg-highlight-surface px-1.5 py-0.5 font-medium text-highlight-surface-foreground">
                      <Star className="size-3 fill-current" />
                      {th("featured")}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        },
        className: "min-w-[236px]",
      },
      ...(isMultiVendor
        ? [
            {
              id: "vendor",
              header: th("colStoreName"),
              cell: (row: Product) => {
                const name = row.vendorId?.storeName || th("defaultStore");
                return (
                  <span className="inline-flex max-w-[140px] items-center gap-2 text-sm" title={name}>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {name.trim().charAt(0)}
                    </span>
                    <span className="truncate">{name}</span>
                  </span>
                );
              },
              className: "w-[160px]",
            },
          ]
        : []),
      {
        id: "status",
        header: t("admin.productsDataTable.columns.status"),
        cell: (row) => <StatusCell status={row.status} />,
        className: "w-[110px]",
      },
      {
        id: "inventory",
        header: t("admin.productsDataTable.columns.inventory"),
        cell: (row) => {
          const hue = productRowHue(row);
          const units = row.variants?.length
            ? row.variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0)
            : (row.stock ?? 0);
          if (hue === "rose") {
            return (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30">
                <span className="size-1.5 rounded-full bg-red-500" />
                {th("outOfStock")}
              </span>
            );
          }
          return (
            <span className="inline-flex flex-col">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    hue === "amber" ? "bg-amber-500" : hue === "slate" ? "bg-slate-300" : "bg-emerald-500",
                  )}
                />
                {th("units", { count: units })}
              </span>
              {hue === "amber" ? <span className="ps-3.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">{th("lowStock")}</span> : null}
            </span>
          );
        },
        className: "w-[104px]",
      },
      {
        id: "price",
        header: t("admin.productsDataTable.columns.price"),
        cell: (row) => (
          <span className="inline-flex flex-col">
            <span className="text-sm font-bold tabular-nums text-foreground">{formatPrice(row)}</span>
            {row.comparePrice && row.comparePrice > row.price ? (
              <span className="text-[11px] tabular-nums text-muted-foreground line-through">{formatCurrency(row.comparePrice)}</span>
            ) : null}
          </span>
        ),
        className: "w-[130px]",
      },
      {
        id: "channels",
        header: t("admin.productsDataTable.columns.availableIn"),
        cell: (row) => {
          const pos = row.publishing?.pointOfSale ?? false;
          const online = row.publishing?.onlineStore ?? true;
          const channel = (on: boolean, label: string, icon: React.ReactNode) => (
            <span
              title={label}
              aria-label={label}
              className={cn(
                "flex size-7 items-center justify-center rounded-lg ring-1 ring-inset [&_svg]:size-3.5",
                on ? "bg-primary/10 text-primary ring-primary/20" : "bg-muted/50 text-muted-foreground/40 ring-transparent",
              )}
            >
              {icon}
            </span>
          );
          return (
            <div className="flex items-center gap-1.5">
              {channel(online, t("admin.productsDataTable.channels.online"), <Globe />)}
              {channel(pos, t("admin.productsDataTable.channels.inStore"), <ShoppingBag />)}
            </div>
          );
        },
        className: "w-[90px]",
      },
    ],
    [basePath, formatPrice, formatCurrency, isMultiVendor, locale, canEdit, t, th],
  );

  // Tabs
  const tabs = useMemo<DataTableTab[]>(
    () => [
      { id: "all", label: t("admin.productsDataTable.tabs.all") },
      { id: "active", label: t("admin.productsDataTable.tabs.active") },
      { id: "draft", label: t("admin.productsDataTable.tabs.draft") },
      { id: "unlisted", label: t("admin.productsDataTable.tabs.archived") },
    ],
    [t],
  );

  const filters = useMemo<DataTableFilter[]>(
    () => [
      ...(isMultiVendor
        ? [
            {
              id: "vendor",
              label: th("filterVendor"),
              type: "select" as const,
              options: [
                { label: th("allVendors"), value: "all" },
                ...vendorOptions,
              ],
            },
            {
              id: "source",
              label: th("filterSource"),
              type: "select" as const,
              options: [
                { label: th("allSources"), value: "all" },
                { label: th("adminProducts"), value: "admin" },
                { label: th("vendorProducts"), value: "vendor" },
              ],
            },
          ]
        : []),
      {
        id: "tag",
        label: t("admin.productsDataTable.filters.tag"),
        type: "select",
        options:
          tagOptions.length > 0
            ? tagOptions
            : [
                {
                  label: t("admin.productsDataTable.filters.all"),
                  value: "all",
                },
              ],
      },
      {
        id: "statuses",
        label: t("admin.productsDataTable.filters.statuses"),
        type: "select",
        options: [
          { label: t("admin.productsDataTable.filters.all"), value: "all" },
          {
            label: t("admin.productsDataTable.filters.active"),
            value: "active",
          },
          { label: t("admin.productsDataTable.filters.draft"), value: "draft" },
          {
            label: t("admin.productsDataTable.filters.archived"),
            value: "unlisted",
          },
        ],
      },
    ],
    [isMultiVendor, vendorOptions, tagOptions, t, th],
  );

  const tableHeader = useMemo(
    () =>
      buildAdminCommerceTableHeader({
        title: t("admin.productsDataTable.title"),
        addAction: !canCreate
          ? undefined
          : {
              id: "add",
              label: t("admin.productsDataTable.actions.addProduct"),
              href: `${basePath}/products/new`,
              icon: <Plus className="h-4 w-4" />,
              variant: "default",
            },
        importExportAction: !(canCreate || canEdit)
          ? {
              id: "export",
              label: t("admin.productsDataTable.actions.export"),
              icon: <Download className="h-4 w-4" />,
              variant: "outline",
              onClick: handleExportProducts,
            }
          : {
              id: "import-export",
              label: t("admin.productsDataTable.actions.importExport"),
              icon: <ChevronsUpDown className="h-4 w-4" />,
              variant: "outline",
              items: [
                {
                  id: "toolbar-export",
                  label: t("admin.productsDataTable.actions.export"),
                  icon: <Download className="h-4 w-4" />,
                  onClick: handleExportProducts,
                },
                {
                  id: "toolbar-import",
                  label: t("admin.productsDataTable.actions.import"),
                  icon: <Upload className="h-4 w-4" />,
                  onClick: handleImportProducts,
                },
                {
                  id: "toolbar-import-sample",
                  label: t("admin.productsDataTable.actions.downloadSample"),
                  icon: <FileDown className="h-4 w-4" />,
                  onClick: handleDownloadSample,
                },
              ],
            },
      }),
    [
      basePath,
      handleDownloadSample,
      handleExportProducts,
      handleImportProducts,
      canCreate,
      canEdit,
      t,
    ],
  );

  // Bulk actions
  const bulkActions = useMemo<DataTableBulkAction<Product>[]>(
    () =>
      readOnly
        ? []
        : ([
            {
              id: "set-active",
              label: t("admin.productsDataTable.bulkActions.setActive"),
              icon: <CheckCircle2 className="h-4 w-4" />,
              variant: "outline",
              onClick: (items) => handleBulkStatusUpdate(items, "active"),
            },
            {
              id: "set-draft",
              label: t("admin.productsDataTable.bulkActions.setDraft"),
              icon: <CircleDot className="h-4 w-4" />,
              variant: "outline",
              onClick: (items) => handleBulkStatusUpdate(items, "draft"),
            },
            {
              id: "set-archived",
              label: t("admin.productsDataTable.bulkActions.setArchived"),
              icon: <Archive className="h-4 w-4" />,
              variant: "outline",
              onClick: (items) => handleBulkStatusUpdate(items, "unlisted"),
            },
            {
              id: "delete",
              label: t("admin.productsDataTable.bulkActions.delete"),
              icon: <Trash2 className="h-4 w-4" />,
              variant: "destructive",
              onClick: handleBulkDelete,
            },
          ] satisfies DataTableBulkAction<Product>[]).filter((action) => action.id === "delete" ? canDelete : canEdit),
    [handleBulkDelete, handleBulkStatusUpdate, readOnly, canEdit, canDelete, t],
  );

  // Row actions
  const rowActions = useCallback(
    (row: Product): DataTableAction[] =>
      readOnly
        ? [
            {
              id: "view",
              label: t("admin.productsDataTable.rowActions.view"),
              icon: <Eye className="h-4 w-4" />,
              href: `/products/${row.slug}`,
            },
          ]
        : ([
            {
              id: "view",
              label: t("admin.productsDataTable.rowActions.view"),
              icon: <Eye className="h-4 w-4" />,
              href: `/products/${row.slug}`,
            },
            {
              id: "edit",
              label: t("admin.productsDataTable.rowActions.edit"),
              icon: <Pencil className="h-4 w-4" />,
              href: `${basePath}/products/${row._id}/edit`,
            },
            {
              id: "delete",
              label: t("admin.productsDataTable.rowActions.delete"),
              icon: <Trash2 className="h-4 w-4" />,
              variant: "destructive",
              onClick: () => handleDelete(row),
            },
          ] satisfies DataTableAction[]).filter((action) => action.id === "view" || (action.id === "edit" ? canEdit : canDelete)),
    [basePath, handleDelete, locale, readOnly, canEdit, canDelete, t],
  );

  return (
    <>
      {(canCreate || canEdit) && (
        <ProductImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          endpoint={PRODUCTS_IMPORT_ENDPOINT}
          audience="admin"
          onImported={handleImported}
        />
      )}
      <DataTable
        data={list.items}
        columns={columns}
        keyField="_id"
        isLoading={list.isLoading}
        loadingMode="rows"
        // Header: the admin page carries its own heading above the tiles.
        title={modern ? undefined : tableHeader.title}
        tabs={tabs}
        activeTab={list.activeTab}
        onTabChange={handleStatusChange}
        actions={tableHeader.actions?.length ? tableHeader.actions : undefined}
        // Selection
        selectable
        selectedItems={selectedProducts}
        onSelectionChange={setSelectedProducts}
        bulkActions={bulkActions}
        // Search
        searchable
        searchPlaceholder={t("admin.productsDataTable.searchPlaceholder")}
        searchValue={list.search}
        onSearchChange={list.handleSearchChange}
        filters={filters}
        filterValues={{ ...list.filters, statuses: list.activeTab }}
        onFilterChange={(filterId, value) => {
          if (filterId === "statuses") {
            handleStatusChange(value);
            return;
          }
          list.handleFilterChange(filterId, value);
        }}
        toolbarActions={tableHeader.toolbarActions}
        toolbarLayout={tableHeader.toolbarLayout}
        tabsVariant={tableHeader.tabsVariant}
        filtersVariant={tableHeader.filtersVariant}
        appearance={tableHeader.appearance}
        stackedTopControls={tableHeader.stackedTopControls}
        showToolbarSortButton={tableHeader.showToolbarSortButton}
        sortColumn={list.sortBy}
        sortDirection={list.sortOrder}
        onSortChange={list.handleSortChange}
        // Pagination
        pagination={list.pagination}
        onPageChange={list.handlePageChange}
        onPageSizeChange={list.handlePageSizeChange}
        // Row actions
        rowActions={rowActions}
        // A "⋯" menu needs no heading; the column stays narrow.
        rowActionsHeader={<span className="sr-only">{t("admin.productsDataTable.rowActionsHeader")}</span>}
        rowActionsVariant="dropdown"
        onRowClick={(row) =>
          router.push(
            !canEdit
              ? `/${locale}/products/${row.slug}`
              : `${basePath}/products/${row._id}/edit`,
          )
        }
        className={modern ? MODERN_TABLE_CARD : undefined}
        // Plain rows: the stock column carries the colour, so the list stays calm.
        rowClassName={() => "transition-colors hover:bg-primary/[0.03]"}
        // Empty state
        emptyMessage={t("admin.productsDataTable.empty")}
      />
    </>
  );
}
