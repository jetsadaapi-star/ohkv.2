"use client";

import { MODERN_TABLE_CARD, statusRowClass, statusRowHue } from "@/components/vendor/status-tone";
import { StatusBadge } from "@/components/ui/status-badge";
import { pageLocale } from "@/lib/intl/date-locale";
import {
  CheckCircle2,
  Trash2,
  MessageCircle,
  XCircle,
  ShieldOff,
  ExternalLink,
} from "lucide-react";
import {
  DataTable,
  type DataTableColumn,
  type DataTableTab,
  type DataTableAction,
  type DataTableBulkAction,
  type DataTablePaginationType,
} from "@/components/ui/data-table";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/toast-notification";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { buildAdminCommerceTableHeader } from "@/components/admin/admin-commerce-table-header";
import { apiClient } from "@/lib/api/client";

interface Comment {
  _id: string;
  postId: { _id: string; title?: string; slug?: string } | string;
  authorName: string;
  /** Absent once the author deleted their account. */
  authorEmail?: string;
  content: string;
  status: "pending" | "approved" | "spam" | "trash";
  createdAt: string;
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: "statusPending",
  approved: "statusApproved",
  spam: "statusSpam",
  trash: "statusTrash",
};

export function BlogCommentsDataTable({ locale }: { locale: string }) {
  const t = useTranslations("admin.hc.blogCommentsDataTable");
  const { confirm } = useConfirmation();
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<Comment[]>([]);
  const [selected, setSelected] = useState<Comment[]>([]);
  const [activeTab, setActiveTab] = useState("pending");
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
      if (activeTab && activeTab !== "all") params.set("status", activeTab);
      const data = await apiClient.get<{
        data: Comment[];
        pagination: { total: number; totalPages: number };
      }>(`/api/blog-comments?${params.toString()}`);
      setItems(data.data);
      setPagination((p) => ({
        ...p,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      }));
    } catch {
      toast.error(t("loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.pageSize, activeTab, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchItems();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchItems]);

  const updateStatus = useCallback(
    async (c: Comment, status: string) => {
      try {
        await apiClient.put(`/api/blog-comments/${c._id}`, { status });
        toast.success(t("updated"));
        fetchItems();
      } catch {
        toast.error(t("failed"));
      }
    },
    [fetchItems, t],
  );

  const handleDelete = useCallback(
    async (c: Comment) => {
      const ok = await confirm({
        title: t("deleteTitle"),
        description: t("deleteDescription"),
        confirmText: t("delete"),
        cancelText: t("cancel"),
        variant: "destructive",
      });
      if (!ok) return;
      try {
        await apiClient.delete(`/api/blog-comments/${c._id}`);
        toast.success(t("deleted"));
        fetchItems();
      } catch {
        toast.error(t("failed"));
      }
    },
    [confirm, fetchItems, t],
  );

  const bulkUpdate = useCallback(
    async (comments: Comment[], status: string) => {
      await Promise.all(
        comments.map((c) =>
          apiClient.put(`/api/blog-comments/${c._id}`, { status }),
        ),
      );
      setSelected([]);
      toast.success(t("bulkUpdated", { count: comments.length }));
      fetchItems();
    },
    [fetchItems, t],
  );

  const bulkDelete = useCallback(
    async (comments: Comment[]) => {
      const ok = await confirm({
        title: t("bulkDeleteTitle"),
        description: t("bulkDeleteDescription", { count: comments.length }),
        confirmText: t("delete"),
        cancelText: t("cancel"),
        variant: "destructive",
      });
      if (!ok) return;
      await Promise.all(
        comments.map((c) => apiClient.delete(`/api/blog-comments/${c._id}`)),
      );
      setSelected([]);
      toast.success(t("deleted"));
      fetchItems();
    },
    [confirm, fetchItems, t],
  );

  const columns = useMemo<DataTableColumn<Comment>[]>(
    () => [
      {
        id: "author",
        header: t("columnAuthor"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{row.authorName}</p>
            {row.authorEmail ? (
              <p className="truncate text-xs text-muted-foreground">{row.authorEmail}</p>
            ) : null}
          </div>
        ),
        className: "w-[200px]",
      },
      {
        id: "content",
        header: t("columnComment"),
        cell: (row) => (
          <p className="line-clamp-2 text-sm text-foreground/90">{row.content}</p>
        ),
        className: "min-w-[280px]",
      },
      {
        id: "post",
        header: t("columnPost"),
        cell: (row) => {
          const p = row.postId;
          if (typeof p === "string") return <span>—</span>;
          return (
            <a
              href={`/blog/${p.slug || ""}`}
              className="inline-flex items-center gap-1 text-sm text-primary"
              target="_blank"
              rel="noreferrer"
            >
              {p.title || t("view")}
              <ExternalLink className="h-3 w-3" />
            </a>
          );
        },
        className: "w-[200px]",
      },
      {
        id: "status",
        header: t("columnStatus"),
        cell: (row) => (
          <StatusBadge status={row.status}>
            {STATUS_LABEL_KEYS[row.status]
              ? t(STATUS_LABEL_KEYS[row.status])
              : row.status}
          </StatusBadge>
        ),
        className: "w-[120px]",
      },
      {
        id: "date",
        header: t("columnDate"),
        cell: (row) => (
          <span className="text-xs text-muted-foreground">
            {new Date(row.createdAt).toLocaleDateString(pageLocale())}
          </span>
        ),
        className: "w-[120px]",
      },
    ],
    [locale, t],
  );

  const tabs = useMemo<DataTableTab[]>(
    () => [
      { id: "all", label: t("tabAll") },
      { id: "pending", label: t("statusPending") },
      { id: "approved", label: t("statusApproved") },
      { id: "spam", label: t("statusSpam") },
      { id: "trash", label: t("statusTrash") },
    ],
    [t],
  );

  const tableHeader = useMemo(
    () => buildAdminCommerceTableHeader({ title: t("title") }),
    [t],
  );

  const bulkActions = useMemo<DataTableBulkAction<Comment>[]>(
    () => [
      {
        id: "approve",
        label: t("approve"),
        icon: <CheckCircle2 className="h-4 w-4" />,
        variant: "outline",
        onClick: (c) => bulkUpdate(c, "approved"),
      },
      {
        id: "spam",
        label: t("markSpam"),
        icon: <ShieldOff className="h-4 w-4" />,
        variant: "outline",
        onClick: (c) => bulkUpdate(c, "spam"),
      },
      {
        id: "delete",
        label: t("delete"),
        icon: <Trash2 className="h-4 w-4" />,
        variant: "destructive",
        onClick: bulkDelete,
      },
    ],
    [bulkUpdate, bulkDelete, t],
  );

  const rowActions = useCallback(
    (row: Comment): DataTableAction[] => {
      const actions: DataTableAction[] = [];
      if (row.status !== "approved") {
        actions.push({
          id: "approve",
          label: t("approve"),
          icon: <CheckCircle2 className="h-4 w-4" />,
          onClick: () => updateStatus(row, "approved"),
        });
      }
      if (row.status !== "pending") {
        actions.push({
          id: "pending",
          label: t("markPending"),
          icon: <XCircle className="h-4 w-4" />,
          onClick: () => updateStatus(row, "pending"),
        });
      }
      if (row.status !== "spam") {
        actions.push({
          id: "spam",
          label: t("markSpam"),
          icon: <ShieldOff className="h-4 w-4" />,
          onClick: () => updateStatus(row, "spam"),
        });
      }
      actions.push({
        id: "delete",
        label: t("delete"),
        icon: <Trash2 className="h-4 w-4" />,
        variant: "destructive",
        onClick: () => handleDelete(row),
      });
      return actions;
    },
    [updateStatus, handleDelete, t],
  );

  return (
    <DataTable
      data={items}
      columns={columns}
      keyField="_id"
      isLoading={isLoading}
      loadingMode="rows"
      // No title: the page carries its own heading.
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab);
        setPagination((p) => ({ ...p, page: 1 }));
      }}
      actions={tableHeader.actions?.length ? tableHeader.actions : undefined}
      selectable
      selectedItems={selected}
      onSelectionChange={setSelected}
      bulkActions={bulkActions}
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
      emptyMessage={t("empty")}
      className={MODERN_TABLE_CARD}
      rowClassName={(row) => statusRowClass(statusRowHue(row.status))}
      emptyIcon={<MessageCircle className="h-8 w-8" />}
    />
  );
}
