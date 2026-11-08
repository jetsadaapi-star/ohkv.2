"use client";

import { MODERN_TABLE_CARD, activeRowHue, statusRowClass } from "@/components/vendor/status-tone";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DataTable,
  StatusCell,
  type DataTableColumn,
  type DataTableAction,
  type DataTablePaginationType,
} from "@/components/ui/data-table";
import { toast } from "@/components/ui/toast-notification";
import { useRouter } from "@/hooks/use-locale-navigation";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { buildAdminCommerceTableHeader } from "@/components/admin/admin-commerce-table-header";

interface BlogCategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  postCount?: number;
}

export function BlogCategoriesDataTable({ locale }: { locale: string }) {
  const t = useTranslations("admin.hc.blogCategoriesDataTable");
  const router = useRouter();
  const { confirm } = useConfirmation();

  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<BlogCategory[]>([]);
  const [pagination, setPagination] = useState<DataTablePaginationType>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.pageSize),
      });
      const res = await fetch(`/api/blog-categories?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.data.data);
        setPagination((p) => ({
          ...p,
          total: data.data.pagination.total,
          totalPages: data.data.pagination.totalPages,
        }));
      }
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.pageSize, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchItems();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchItems]);

  const handleDelete = useCallback(
    async (cat: BlogCategory) => {
      const ok = await confirm({
        title: t("deleteTitle"),
        description: t("deleteDescription", { name: cat.name }),
        confirmText: t("delete"),
        cancelText: t("cancel"),
        variant: "destructive",
      });
      if (!ok) return;
      const res = await fetch(`/api/blog-categories/${cat._id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("deleted"));
        fetchItems();
      } else {
        // Prefer the server's reason — a refusal can be "in use by 3 posts" or
        // the demo-mode notice, and "Failed to delete" explains neither.
        const json = await res.json().catch(() => null);
        toast.error(json?.message || t("deleteFailed"));
      }
    },
    [confirm, fetchItems, t],
  );

  const columns = useMemo<DataTableColumn<BlogCategory>[]>(
    () => [
      {
        id: "name",
        header: t("columnName"),
        cell: (row) => (
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-xs text-muted-foreground">/{row.slug}</p>
          </div>
        ),
        className: "w-[280px]",
      },
      {
        id: "posts",
        header: t("columnPosts"),
        cell: (row) => <span className="text-sm">{row.postCount ?? 0}</span>,
        className: "w-[80px]",
      },
      {
        id: "status",
        header: t("columnStatus"),
        cell: (row) => <StatusCell status={row.isActive ? "active" : "inactive"} />,
        className: "w-[120px]",
      },
    ],
    [t],
  );

  const tableHeader = useMemo(
    () =>
      buildAdminCommerceTableHeader({
        title: t("title"),
        addAction: {
          id: "add",
          label: t("addCategory"),
          href: "/admin/content/blog-categories/new",
          icon: <Plus className="h-4 w-4" />,
          variant: "default",
        },
      }),
    [locale, t],
  );

  const rowActions = useCallback(
    (row: BlogCategory): DataTableAction[] => [
      {
        id: "edit",
        label: t("edit"),
        icon: <Pencil className="h-4 w-4" />,
        href: `/admin/content/blog-categories/${row._id}/edit`,
      },
      {
        id: "delete",
        label: t("delete"),
        icon: <Trash2 className="h-4 w-4" />,
        variant: "destructive",
        onClick: () => handleDelete(row),
      },
    ],
    [locale, handleDelete, t],
  );

  return (
    <DataTable
      data={items}
      columns={columns}
      keyField="_id"
      isLoading={isLoading}
      loadingMode="rows"
      // No title: the page carries its own heading.
      actions={tableHeader.actions?.length ? tableHeader.actions : undefined}
      toolbarActions={tableHeader.toolbarActions}
      toolbarLayout={tableHeader.toolbarLayout}
      tabsVariant={tableHeader.tabsVariant}
      filtersVariant={tableHeader.filtersVariant}
      appearance={tableHeader.appearance}
      stackedTopControls={tableHeader.stackedTopControls}
      showToolbarSortButton={tableHeader.showToolbarSortButton}
      pagination={pagination}
      onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
      onPageSizeChange={(pageSize) =>
        setPagination((p) => ({ ...p, page: 1, pageSize }))
      }
      rowActions={rowActions}
      rowActionsHeader={t("actions")}
      rowActionsVariant="inline"
      onRowClick={(row) =>
        router.push(`/admin/content/blog-categories/${row._id}/edit`)
      }
      emptyMessage={t("empty")}
      className={MODERN_TABLE_CARD}
      rowClassName={(row) => statusRowClass(activeRowHue(row.isActive))}
      emptyIcon={<Tags className="h-8 w-8" />}
    />
  );
}
