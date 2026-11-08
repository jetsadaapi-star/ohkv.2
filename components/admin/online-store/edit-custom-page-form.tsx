"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/language/link";
import { useTranslations } from "next-intl";
import { useRouter } from "@/hooks/use-locale-navigation";
import { ExternalLink, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/rich-text-editor-lazy";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { SearchEngineListingPreview } from "@/components/admin/search-engine-listing-preview";
import { PageEditorSkeleton } from "@/components/admin/online-store/online-store-skeletons";
import {
  normalizeContentPagesSettings,
  RESERVED_CONTENT_PAGE_HANDLES,
  slugifyContentPageHandle,
  type ContentPagesSettings,
} from "@/lib/site-config/content-pages-config";
import { isRecord } from "@/lib/utils";

type SettingsResponse = {
  success?: boolean;
  data?: {
    contentPages?: unknown;
  };
};

export function EditCustomPageForm({
  locale,
  pageId,
}: {
  locale: string;
  pageId: string;
}) {
  const t = useTranslations("admin.hc.editCustomPageForm");
  const router = useRouter();
  const { confirm } = useConfirmation();

  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [content, setContent] = useState("");
  const [visible, setVisible] = useState(true);

  const [existingPages, setExistingPages] = useState<
    ContentPagesSettings["customPages"]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [initialSnapshot, setInitialSnapshot] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/admin/settings", { method: "GET" });
        const payload = (await response.json()) as SettingsResponse;

        if (
          !response.ok ||
          payload.success !== true ||
          !isRecord(payload.data)
        ) {
          throw new Error("Failed to load settings");
        }

        const normalized = normalizeContentPagesSettings(
          payload.data.contentPages,
        );
        setExistingPages(normalized.customPages);

        const page = normalized.customPages.find((item) => item.id === pageId);
        if (!page) {
          toast.error(t("notFound"));
          router.push("/admin/online-store/pages");
          return;
        }

        setTitle(page.title);
        setHandle(page.handle);
        setMetaTitle(page.metaTitle);
        setMetaDescription(page.metaDescription);
        setContent(page.content);
        setVisible(page.visible);
        setInitialSnapshot(JSON.stringify(page));
      } catch {
        toast.error(t("loadFailed"));
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [pageId, router, t]);

  const effectiveHandle = handle;

  const handleStatus = useMemo(() => {
    const normalized = slugifyContentPageHandle(effectiveHandle);

    if (!normalized) {
      return { ok: false, message: t("handleRequired") };
    }

    if (RESERVED_CONTENT_PAGE_HANDLES.has(normalized)) {
      return {
        ok: false,
        message: t("handleReserved"),
      };
    }

    const exists = existingPages.some(
      (page) => page.id !== pageId && page.handle === normalized,
    );
    if (exists) {
      return {
        ok: false,
        message: t("handleExists"),
      };
    }

    return { ok: true, message: t("handleAvailable") };
  }, [effectiveHandle, existingPages, pageId, t]);

  const isDirty = useMemo(() => {
    const currentPage = existingPages.find((item) => item.id === pageId);
    if (!currentPage) return false;

    const currentSnapshot = JSON.stringify({
      ...currentPage,
      title: title.trim(),
      handle: slugifyContentPageHandle(effectiveHandle),
      metaTitle: metaTitle.trim(),
      metaDescription: metaDescription.trim(),
      content,
      visible,
    });
    return currentSnapshot !== initialSnapshot;
  }, [
    content,
    effectiveHandle,
    existingPages,
    initialSnapshot,
    metaDescription,
    metaTitle,
    pageId,
    title,
    visible,
  ]);

  const save = async () => {
    const normalizedHandle = slugifyContentPageHandle(effectiveHandle);

    if (!title.trim()) {
      toast.error(t("titleRequired"));
      return;
    }

    if (!normalizedHandle) {
      toast.error(t("urlHandleRequired"));
      return;
    }

    if (!handleStatus.ok) {
      toast.error(handleStatus.message);
      return;
    }

    const current = existingPages.find((item) => item.id === pageId);
    if (!current) {
      toast.error(t("pageNotFound"));
      return;
    }

    try {
      setIsSaving(true);
      const now = new Date().toISOString();
      const nextCustomPages = existingPages.map((page) =>
        page.id === pageId
          ? {
              ...page,
              title: title.trim(),
              handle: normalizedHandle,
              content,
              metaTitle: metaTitle.trim(),
              metaDescription: metaDescription.trim(),
              visible,
              updatedAt: now,
            }
          : page,
      );

      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "contentPages",
          data: {
            customPages: nextCustomPages,
          },
        }),
      });

      const payload = (await response.json()) as SettingsResponse;
      if (!response.ok || payload.success !== true || !isRecord(payload.data)) {
        throw new Error("Failed to save");
      }

      const normalized = normalizeContentPagesSettings(
        payload.data.contentPages,
      );
      setExistingPages(normalized.customPages);

      const savedPage = normalized.customPages.find((item) => item.id === pageId);
      if (!savedPage) {
        throw new Error("Page not found after save");
      }

      setTitle(savedPage.title);
      setHandle(savedPage.handle);
      setMetaTitle(savedPage.metaTitle);
      setMetaDescription(savedPage.metaDescription);
      setContent(savedPage.content);
      setVisible(savedPage.visible);
      setInitialSnapshot(JSON.stringify(savedPage));

      toast.success(t("updated"));
    } catch {
      toast.error(t("updateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const deletePage = async () => {
    const current = existingPages.find((item) => item.id === pageId);
    if (!current) {
      toast.error(t("pageNotFound"));
      return;
    }

    const confirmed = await confirm({
      title: t("deleteTitle"),
      description: t("deleteDescription", { title: current.title }),
      confirmText: t("delete"),
      cancelText: t("cancel"),
      confirmVariant: "destructive",
      type: "danger",
    });

    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "contentPages",
          data: {
            customPages: existingPages.filter((item) => item.id !== pageId),
          },
        }),
      });

      const payload = (await response.json()) as SettingsResponse;
      if (!response.ok || payload.success !== true || !isRecord(payload.data)) {
        throw new Error("Failed to delete");
      }

      toast.success(t("deleted"));
      router.push("/admin/online-store/pages");
      router.refresh();
    } catch {
      toast.error(t("deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  };

  // Same placeholder as `pages/custom/[id]/loading.tsx`.
  if (isLoading) {
    return <PageEditorSkeleton side="narrow" mainCards={1} actions={4} />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <AdminFormStickyHeader
        className="!mx-0 -mt-2 border-b-0 px-0 shadow-none md:px-0"
        title={t("headerTitle")}
        description={t("headerDescription")}
        actions={
          <>
            <Button asChild type="button" variant="outline" size="sm">
              <Link href="/admin/online-store/pages">{t("backToPages")}</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(
                  `/${locale}/pages/${
                    slugifyContentPageHandle(effectiveHandle) || "your-handle"
                  }`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("preview")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={deletePage}
              disabled={isDeleting || isSaving}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("delete")}
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={!isDirty || isSaving || isDeleting}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {t("savePage")}
                </>
              )}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="rounded-2xl border border-border bg-card p-4 shadow-[0_3px_14px_rgba(15,23,42,0.06)] md:p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t("title")}
              </p>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("titlePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t("content")}
              </p>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder={t("contentPlaceholder")}
                className="min-h-[340px]"
              />
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-sm border border-border bg-card p-4 shadow-[0_3px_14px_rgba(15,23,42,0.06)]">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t("visibility")}
              </p>
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t("visible")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("hideDraft")}
                  </p>
                </div>
                <Switch checked={visible} onCheckedChange={setVisible} />
              </div>
            </div>
          </Card>

          <SearchEngineListingPreview
            pageTitle={metaTitle}
            metaDescription={metaDescription}
            handle={effectiveHandle}
            title={title}
            description={content}
            entityLabel={t("seoEntityLabel")}
            emptyTitle={t("seoEmptyTitle")}
            emptyHandle="page-handle"
            pathPrefix={[locale, "pages"]}
            titlePlaceholder={t("seoTitlePlaceholder")}
            metaDescriptionPlaceholder={t("seoMetaDescriptionPlaceholder")}
            handlePlaceholder="page-handle"
            handleFeedback={handleStatus.message}
            handleFeedbackTone={handleStatus.ok ? "success" : "error"}
            defaultEditing
            onPageTitleChange={setMetaTitle}
            onMetaDescriptionChange={setMetaDescription}
            onHandleChange={(value) => {
              setHandle(value);
            }}
          />
        </div>
      </div>
    </div>
  );
}
