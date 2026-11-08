"use client";

import { MODERN_TABLE_CARD, brandRowHue, statusRowClass } from "@/components/vendor/status-tone";
import { StatusBadge } from "@/components/ui/status-badge";
import type { StaffResourceActions } from "@/lib/access/staff-resource-actions";

import {
  Plus,
  Pencil,
  Trash2,
  Archive,
  Tag,
  CheckCircle2,
  CircleOff,
  Star,
  Check,
  X,
  RotateCcw,
  ChevronsUpDown,
  Download,
  Upload,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DataTable,
  ProductCell,
  StatusCell,
  NumberCell,
  type DataTableColumn,
  type DataTableTab,
  type DataTableAction,
  type DataTableBulkAction,
} from "@/components/ui/data-table";
import { toast } from "@/components/ui/toast-notification";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "@/hooks/use-locale-navigation";
import { useState, useCallback, useMemo } from "react";
import { useListNavigation } from "@/hooks/use-list-navigation";
import { useCsvImportExport } from "@/hooks/use-csv-import-export";
import { apiClient } from "@/lib/api/client";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { buildAdminCommerceTableHeader } from "@/components/admin/admin-commerce-table-header";

interface Brand {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  isActive: boolean;
  featured?: boolean;
  productCount?: number;
  ownerVendorId?: string | null;
  approvalStatus?: "approved" | "pending" | "rejected";
  deletedAt?: string | null;
}

interface BrandsDataTableProps {
  locale: string;
  area?: "admin" | "staff";
  actionAccess?: StaffResourceActions;
  /** Rows for the current query string, fetched by the page. */
  data: Brand[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function BrandsDataTable({
  locale,
  area = "admin",
  actionAccess,
  data,
  pagination,
}: BrandsDataTableProps) {
  const basePath = `/${locale}/${area}`;
  const modern = area === "admin";
  const canCreate = actionAccess?.canCreate ?? true;
  const canEdit = actionAccess?.canEdit ?? true;
  const canDelete = actionAccess?.canDelete ?? true;
  const canImport = canCreate && canEdit;
  const allowsAction = useCallback(
    (id: string) => ["delete", "archive"].includes(id) ? canDelete : canEdit,
    [canDelete, canEdit],
  );
  const t = useTranslations();
  const tb = useTranslations("admin.hc.brandsDataTable");
  const router = useRouter();
  const { confirm } = useConfirmation();

  const [selectedBrands, setSelectedBrands] = useState<Brand[]>([]);

  const list = useListNavigation<Brand>({
    items: data,
    pagination,
    // The "products" column sorts by the productCount field server-side.
    defaultSortBy: "name",
    defaultSortOrder: "asc",
  });

  const csv = useCsvImportExport({
    endpoint: "/api/admin/brands/import-export",
    noun: "brands",
    onImported: list.refetch,
    messages: {
      exporting: tb("exporting"),
      exported: tb("exported"),
      exportFailed: tb("exportFailed"),
    },
  });

  const handleArchive = useCallback(
    async (brand: Brand) => {
      const confirmed = await confirm({
        title: tb("archiveTitle"),
        description: tb("archiveDescription", { name: brand.name }),
        confirmText: tb("archive"),
        cancelText: tb("cancel"),
        variant: "destructive",
      });

      if (!confirmed) return;

      try {
        await apiClient.delete(`/api/brands/${brand._id}`);
        toast.success(tb("archived"));
        list.refetch();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : tb("archiveFailed"),
        );
      }
    },
    [confirm, list, tb],
  );

  const handlePermanentDelete = useCallback(
    async (brand: Brand) => {
      const confirmed = await confirm({
        title: tb("deleteTitle"),
        description: tb("deleteDescription", { name: brand.name }),
        confirmText: tb("deletePermanently"),
        cancelText: tb("cancel"),
        variant: "destructive",
      });

      if (!confirmed) return;

      try {
        await apiClient.delete(`/api/brands/${brand._id}?permanent=true`);
        toast.success(tb("deleted"));
        list.refetch();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : tb("deleteFailed"),
        );
      }
    },
    [confirm, list, tb],
  );

  const handleModeration = useCallback(
    async (brand: Brand, approvalStatus: "approved" | "rejected") => {
      if (approvalStatus === "rejected") {
        const confirmed = await confirm({
          title: tb("rejectTitle"),
          description: tb("rejectDescription", { name: brand.name }),
          confirmText: tb("reject"),
          cancelText: tb("cancel"),
          variant: "destructive",
        });
        if (!confirmed) return;
      }

      try {
        await apiClient.put(`/api/brands/${brand._id}`, { approvalStatus });
        toast.success(
          approvalStatus === "approved" ? tb("approved") : tb("rejected"),
        );
        list.refetch();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : tb("updateFailed"),
        );
      }
    },
    [confirm, list, tb],
  );

  const handleRestore = useCallback(
    async (brand: Brand) => {
      try {
        await apiClient.put(`/api/brands/${brand._id}`, { restore: true });
        toast.success(tb("restored"));
        list.refetch();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : tb("restoreFailed"),
        );
      }
    },
    [list, tb],
  );

  const handleBulkArchive = useCallback(
    async (items: Brand[]) => {
      const confirmed = await confirm({
        title: tb("bulkArchiveTitle"),
        description: tb("bulkArchiveDescription", { count: items.length }),
        confirmText: tb("archive"),
        cancelText: tb("cancel"),
        variant: "destructive",
      });

      if (!confirmed) return;

      try {
        await Promise.all(
          items.map((brand) => apiClient.delete(`/api/brands/${brand._id}`)),
        );
        toast.success(tb("bulkArchived", { count: items.length }));
        setSelectedBrands([]);
        list.refetch();
      } catch {
        toast.error(tb("bulkArchiveFailed"));
      }
    },
    [confirm, list, tb],
  );

  const handleBulkPermanentDelete = useCallback(
    async (items: Brand[]) => {
      const confirmed = await confirm({
        title: tb("bulkDeleteTitle"),
        description: tb("bulkDeleteDescription", { count: items.length }),
        confirmText: tb("deletePermanently"),
        cancelText: tb("cancel"),
        variant: "destructive",
      });

      if (!confirmed) return;

      try {
        const results = await Promise.allSettled(
          items.map((brand) =>
            apiClient.delete(`/api/brands/${brand._id}?permanent=true`),
          ),
        );
        const successCount = results.filter(
          (result) => result.status === "fulfilled",
        ).length;
        const failCount = items.length - successCount;

        setSelectedBrands([]);
        list.refetch();

        if (successCount > 0) {
          toast.success(tb("bulkDeleted", { count: successCount }));
        }
        if (failCount > 0) {
          toast.error(tb("bulkDeleteSomeFailed", { count: failCount }));
        }
      } catch {
        toast.error(tb("bulkDeleteFailed"));
      }
    },
    [confirm, list, tb],
  );

  const handleBulkStatusUpdate = useCallback(
    async (items: Brand[], isActive: boolean) => {
      const results = await Promise.allSettled(
        items.map((brand) =>
          apiClient.put(`/api/brands/${brand._id}`, { isActive }),
        ),
      );

      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failCount = items.length - successCount;

      setSelectedBrands([]);
      list.refetch();

      if (successCount > 0) {
        toast.success(tb("bulkUpdated", { count: successCount }));
      }
      if (failCount > 0) {
        toast.error(tb("bulkUpdateSomeFailed", { count: failCount }));
      }
    },
    [list, tb],
  );

  const handleFeaturedUpdate = useCallback(
    async (brand: Brand, featured: boolean) => {
      try {
        await apiClient.put(`/api/brands/${brand._id}`, { featured });
        toast.success(
          featured ? tb("markedFeatured") : tb("removedFeatured"),
        );
        list.refetch();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : tb("updateFailed"),
        );
      }
    },
    [list, tb],
  );

  const handleBulkFeaturedUpdate = useCallback(
    async (items: Brand[], featured: boolean) => {
      const results = await Promise.allSettled(
        items.map((brand) =>
          apiClient.put(`/api/brands/${brand._id}`, { featured }),
        ),
      );

      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failCount = items.length - successCount;

      setSelectedBrands([]);
      list.refetch();

      if (successCount > 0) {
        toast.success(
          featured
            ? tb("bulkMarkedFeatured", { count: successCount })
            : tb("bulkRemovedFeatured", { count: successCount }),
        );
      }
      if (failCount > 0) {
        toast.error(tb("bulkUpdateSomeFailed", { count: failCount }));
      }
    },
    [list, tb],
  );

  const columns = useMemo<DataTableColumn<Brand>[]>(
    () => [
      {
        id: "brand",
        header: tb("colBrand"),
        cell: (row) => (
          <ProductCell
            image={row.logo}
            title={row.name}
            subtitle={`/${row.slug}`}
            href={canEdit ? `${basePath}/brands/${row._id}/edit` : undefined}
          />
        ),
        className: "w-[420px]",
      },
      {
        id: "products",
        header: tb("colProducts"),
        cell: (row) => <NumberCell value={row.productCount ?? 0} />,
        className: "w-[90px]",
      },
      {
        id: "owner",
        header: tb("colSource"),
        cell: (row) =>
          row.ownerVendorId ? (
            <Badge variant="outline">{tb("sourceVendor")}</Badge>
          ) : (
            <span className="text-sm text-muted-foreground">{tb("sourceOfficial")}</span>
          ),
        className: "w-[110px]",
      },
      {
        id: "approval",
        header: tb("colApproval"),
        cell: (row) => {
          if (row.deletedAt) {
            return <StatusBadge tone="neutral">{tb("statusArchived")}</StatusBadge>;
          }
          if (row.approvalStatus === "pending") {
            return <StatusBadge tone="warning">{tb("statusPending")}</StatusBadge>;
          }
          if (row.approvalStatus === "rejected") {
            return <StatusBadge tone="danger">{tb("statusRejected")}</StatusBadge>;
          }
          return (
            <StatusBadge tone="success" icon={<Check className="h-3 w-3" />}>
              {tb("statusApproved")}
            </StatusBadge>
          );
        },
        className: "w-[130px]",
      },
      {
        id: "status",
        header: tb("colStatus"),
        cell: (row) => (
          <StatusCell status={row.isActive ? "active" : "inactive"} />
        ),
        className: "w-[110px]",
      },
    ],
    [locale, tb],
  );

  const tabs = useMemo<DataTableTab[]>(
    () => [
      { id: "all", label: tb("tabAll") },
      { id: "pending", label: tb("statusPending") },
      { id: "active", label: tb("tabActive") },
      { id: "featured", label: tb("tabFeatured") },
      { id: "inactive", label: tb("tabInactive") },
      { id: "rejected", label: tb("statusRejected") },
      { id: "archived", label: tb("statusArchived") },
    ],
    [basePath, canEdit, tb],
  );

  const tableHeader = useMemo(
    () =>
      buildAdminCommerceTableHeader({
        title: tb("title"),
        addAction: canCreate ? {
          id: "add",
          label: tb("addBrand"),
          href: `${basePath}/brands/new`,
          icon: <Plus className="h-4 w-4" />,
          variant: "default",
        } : undefined,
        importExportAction: !canImport ? {
          id: "export", label: tb("exportCsv"), icon: <Download className="h-4 w-4" />, onClick: csv.exportCsv,
        } : {
          id: "import-export",
          label: t("admin.productsDataTable.actions.importExport"),
          icon: <ChevronsUpDown className="h-4 w-4" />,
          variant: "outline",
          items: [
            {
              id: "toolbar-import",
              label: tb("importCsv"),
              icon: <Upload className="h-4 w-4" />,
              onClick: csv.openFilePicker,
              disabled: csv.isImporting,
            },
            {
              id: "toolbar-export",
              label: tb("export"),
              icon: <Download className="h-4 w-4" />,
              onClick: csv.exportCsv,
              disabled: csv.isExporting,
            },
          ],
        },
      }),
    [
      csv.exportCsv,
      csv.isExporting,
      csv.isImporting,
      csv.openFilePicker,
      basePath,
      canCreate,
      canImport,
      t,
      tb,
    ],
  );

  const bulkActions = useMemo<DataTableBulkAction<Brand>[]>(
    () => ([
      {
        id: "activate",
        label: tb("setActive"),
        icon: <CheckCircle2 className="h-4 w-4" />,
        variant: "outline",
        onClick: (items) => handleBulkStatusUpdate(items, true),
      },
      {
        id: "deactivate",
        label: tb("setInactive"),
        icon: <CircleOff className="h-4 w-4" />,
        variant: "outline",
        onClick: (items) => handleBulkStatusUpdate(items, false),
      },
      {
        id: "mark-featured",
        label: tb("markFeatured"),
        icon: <Star className="h-4 w-4" />,
        variant: "outline",
        onClick: (items) => handleBulkFeaturedUpdate(items, true),
      },
      {
        id: "remove-featured",
        label: tb("removeFeatured"),
        icon: <CircleOff className="h-4 w-4" />,
        variant: "outline",
        onClick: (items) => handleBulkFeaturedUpdate(items, false),
      },
      {
        id: "archive",
        label: tb("archive"),
        icon: <Archive className="h-4 w-4" />,
        variant: "destructive",
        onClick: handleBulkArchive,
      },
      {
        id: "delete",
        label: tb("deletePermanently"),
        icon: <Trash2 className="h-4 w-4" />,
        variant: "destructive",
        onClick: handleBulkPermanentDelete,
      },
    ] satisfies DataTableBulkAction<Brand>[]).filter((action) => allowsAction(action.id)),
    [
      handleBulkArchive,
      handleBulkFeaturedUpdate,
      handleBulkPermanentDelete,
      handleBulkStatusUpdate,
      allowsAction,
      tb,
    ],
  );

  const rowActions = useCallback(
    (row: Brand): DataTableAction[] => {
      // Archived brands only offer restore.
      if (row.deletedAt) {
        return ([
          {
            id: "restore",
            label: tb("restore"),
            icon: <RotateCcw className="h-4 w-4" />,
            onClick: () => handleRestore(row),
          },
          {
            id: "delete",
            label: tb("deletePermanently"),
            icon: <Trash2 className="h-4 w-4" />,
            variant: "destructive",
            onClick: () => handlePermanentDelete(row),
          },
        ] satisfies DataTableAction[]).filter((action) => allowsAction(action.id));
      }

      const actions: DataTableAction[] = [];

      // Moderation shortcuts for vendor-submitted brands awaiting review.
      if (row.approvalStatus === "pending" || row.approvalStatus === "rejected") {
        actions.push({
          id: "approve",
          label: tb("approve"),
          icon: <Check className="h-4 w-4" />,
          onClick: () => handleModeration(row, "approved"),
        });
      }
      if (row.approvalStatus === "pending") {
        actions.push({
          id: "reject",
          label: tb("reject"),
          icon: <X className="h-4 w-4" />,
          variant: "destructive",
          onClick: () => handleModeration(row, "rejected"),
        });
      }

      actions.push(
        {
          id: "edit",
          label: tb("edit"),
          icon: <Pencil className="h-4 w-4" />,
          href: `${basePath}/brands/${row._id}/edit`,
        },
        {
          id: row.featured ? "remove-featured" : "mark-featured",
          label: row.featured ? tb("removeFeatured") : tb("markFeatured"),
          icon: (
            <Star
              className={
                row.featured ? "h-4 w-4 fill-current text-amber-500" : "h-4 w-4"
              }
            />
          ),
          onClick: () => handleFeaturedUpdate(row, !row.featured),
        },
        {
          id: "archive",
          label: tb("archive"),
          icon: <Archive className="h-4 w-4" />,
          variant: "destructive",
          onClick: () => handleArchive(row),
        },
        {
          id: "delete",
          label: tb("deletePermanently"),
          icon: <Trash2 className="h-4 w-4" />,
          variant: "destructive",
          onClick: () => handlePermanentDelete(row),
        },
      );

      return actions.filter((action) => allowsAction(action.id));
    },
    [
      basePath,
      allowsAction,
      handleArchive,
      handleFeaturedUpdate,
      handleModeration,
      handlePermanentDelete,
      handleRestore,
      tb,
    ],
  );

  return (
    <>
      <input
        id={csv.fileInputId}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-label={tb("importAria")}
        onChange={csv.handleFileChange}
      />
      <DataTable
        data={list.items}
        columns={columns}
        keyField="_id"
        isLoading={list.isLoading}
        loadingMode="rows"
        // The admin page carries its own heading above the tiles.
        title={modern ? undefined : tableHeader.title}
        tabs={tabs}
        activeTab={list.activeTab}
        onTabChange={list.handleTabChange}
        actions={tableHeader.actions?.length ? tableHeader.actions : undefined}
        selectable={canEdit || canDelete}
        selectedItems={selectedBrands}
        onSelectionChange={setSelectedBrands}
        bulkActions={bulkActions}
        searchable
        searchPlaceholder={tb("searchPlaceholder")}
        searchValue={list.search}
        onSearchChange={list.handleSearchChange}
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
        pagination={list.pagination}
        onPageChange={list.handlePageChange}
        onPageSizeChange={list.handlePageSizeChange}
        rowActions={rowActions}
        rowActionsHeader={tb("actions")}
        rowActionsVariant="inline"
        onRowClick={canEdit ? (row) => router.push(`${basePath}/brands/${row._id}/edit`) : undefined}
        emptyMessage={tb("empty")}
        emptyIcon={<Tag className="h-8 w-8" />}
        className={modern ? MODERN_TABLE_CARD : undefined}
        // Live green, waiting on review amber, refused red, hidden or archived grey.
        rowClassName={modern ? (row) => statusRowClass(brandRowHue(row)) : undefined}
      />
    </>
  );
}
