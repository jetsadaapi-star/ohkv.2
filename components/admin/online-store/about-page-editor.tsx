"use client";

import { nanoid } from "nanoid";
import { useTranslations } from "next-intl";

import Link from "@/components/language/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "@/components/ui/toast-notification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { RichTextEditor } from "@/components/ui/rich-text-editor-lazy";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { ImageUploadField } from "@/components/admin/settings/fields/image-upload-field";
import { FieldRow, SwitchRow } from "@/components/admin/online-store/editor-fields";
import { PageEditorSkeleton } from "@/components/admin/online-store/online-store-skeletons";
import {
  ABOUT_PAGE_LIMITS,
  ABOUT_VALUE_ICONS,
  CONTENT_PAGE_META,
  normalizeContentPagesSettings,
  type AboutPageData,
  type AboutValueIcon,
} from "@/lib/site-config/content-pages-config";
import { isRecord } from "@/lib/utils";

type SettingsResponse = {
  success?: boolean;
  data?: {
    contentPages?: unknown;
  };
};

type ListKey =
  | "shopperSteps"
  | "sellerSteps"
  | "protectionItems"
  | "values"
  | "milestones"
  | "members";

type ListItem<K extends ListKey> = AboutPageData[K][number];

const LIST_LIMITS: Record<ListKey, number> = {
  shopperSteps: ABOUT_PAGE_LIMITS.steps,
  sellerSteps: ABOUT_PAGE_LIMITS.steps,
  protectionItems: ABOUT_PAGE_LIMITS.protectionItems,
  values: ABOUT_PAGE_LIMITS.values,
  milestones: ABOUT_PAGE_LIMITS.milestones,
  members: ABOUT_PAGE_LIMITS.members,
};

const VALUE_ICON_LABELS: Record<AboutValueIcon, string> = {
  shield: "iconShield",
  wallet: "iconWallet",
  truck: "iconTruck",
  returns: "iconReturns",
  support: "iconSupport",
  discount: "iconDiscount",
  gift: "iconGift",
};

const STAT_HINTS: Record<AboutPageData["stats"][number]["key"], string> = {
  sellers: "statHintSellers",
  products: "statHintProducts",
  orders: "statHintOrders",
  customers: "statHintCustomers",
  founded: "statHintFounded",
};

const STAT_NAMES: Record<AboutPageData["stats"][number]["key"], string> = {
  sellers: "statSellers",
  products: "statProducts",
  orders: "statOrders",
  customers: "statCustomers",
  founded: "statFounded",
};

function clonePage(value: AboutPageData): AboutPageData {
  return JSON.parse(JSON.stringify(value)) as AboutPageData;
}

function newId(prefix: string): string {
  return `${prefix}-${nanoid(8)}`;
}

export function AboutPageEditor({ locale }: { locale: string }) {
  const t = useTranslations("admin.hc.aboutPageEditor");
  const pageMeta = CONTENT_PAGE_META.about;
  const [page, setPage] = useState<AboutPageData | null>(null);
  const [initialPage, setInitialPage] = useState<AboutPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/admin/settings", { method: "GET" });
        const payload = (await response.json()) as SettingsResponse;
        if (!response.ok || payload.success !== true || !isRecord(payload.data)) {
          throw new Error("Failed to load settings");
        }
        const normalized = normalizeContentPagesSettings(payload.data.contentPages);
        setPage(clonePage(normalized.about));
        setInitialPage(clonePage(normalized.about));
      } catch {
        toast.error(t("loadFailed"));
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(page) !== JSON.stringify(initialPage),
    [page, initialPage],
  );

  const updateField = <K extends keyof AboutPageData>(
    field: K,
    value: AboutPageData[K],
  ) => {
    setPage((current) => (current ? { ...current, [field]: value } : current));
  };

  const updateList = <K extends ListKey>(
    key: K,
    updater: (items: ListItem<K>[]) => ListItem<K>[],
  ) => {
    setPage((current) => {
      if (!current) return current;
      const items = current[key] as ListItem<K>[];
      return { ...current, [key]: updater(items) };
    });
  };

  const patchItem = <K extends ListKey>(
    key: K,
    id: string,
    patch: Partial<ListItem<K>>,
  ) => {
    updateList(key, (items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const moveItem = (key: ListKey, index: number, direction: "up" | "down") => {
    updateList(key, (items) => {
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeItem = (key: ListKey, id: string) => {
    updateList(key, (items) => items.filter((item) => item.id !== id));
  };

  const addItem = <K extends ListKey>(key: K, item: ListItem<K>) => {
    updateList(key, (items) =>
      items.length >= LIST_LIMITS[key] ? items : [...items, item],
    );
  };

  const updateStat = (
    statKey: AboutPageData["stats"][number]["key"],
    patch: Partial<AboutPageData["stats"][number]>,
  ) => {
    setPage((current) =>
      current
        ? {
            ...current,
            stats: current.stats.map((stat) =>
              stat.key === statKey ? { ...stat, ...patch } : stat,
            ),
          }
        : current,
    );
  };

  const save = async () => {
    if (!page) return;

    try {
      setIsSaving(true);
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "contentPages",
          data: { about: page },
        }),
      });

      const payload = (await response.json()) as SettingsResponse;
      if (!response.ok || payload.success !== true || !isRecord(payload.data)) {
        throw new Error("Failed to save");
      }

      const normalized = normalizeContentPagesSettings(payload.data.contentPages);
      setPage(clonePage(normalized.about));
      setInitialPage(clonePage(normalized.about));
      toast.success(t("saved"));
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  const openPreview = () => {
    window.open(`/${locale}${pageMeta.publicPath}`, "_blank", "noopener,noreferrer");
  };

  // Same placeholder as `pages/about/loading.tsx`.
  if (isLoading || !page) return <PageEditorSkeleton side="none" />;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <AdminFormStickyHeader
        className="!mx-0 -mt-2 border-b-0 px-0 shadow-none md:px-0"
        title={t("headerTitle")}
        description={t("headerDescription")}
        status={
          <Badge variant={isDirty ? "secondary" : "default"}>
            {isDirty ? t("unsaved") : t("live")}
          </Badge>
        }
        actions={
          <>
            <Button asChild type="button" variant="outline" size="sm">
              <Link href="/admin/online-store/pages">{t("backToPages")}</Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={openPreview}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {t("preview")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={save}
              disabled={!isDirty || isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {t("save")}
            </Button>
          </>
        }
      />

      <p className="text-sm text-muted-foreground">
        {t.rich("tokensHint", {
          code: (chunks) => (
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{chunks}</code>
          ),
          storeName: "{storeName}",
          returnWindow: "{returnWindow}",
          windowDays: "{windowDays}",
        })}
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          {/* Hero */}
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{t("heroTitle")}</CardTitle>
              <CardDescription>
                {t("heroDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <FieldRow label={t("pageTitle")}>
                  <Input
                    value={page.title}
                    onChange={(event) => updateField("title", event.target.value)}
                    placeholder={t("pageTitlePlaceholder")}
                  />
                </FieldRow>
                <FieldRow label={t("eyebrow")}>
                  <Input
                    value={page.eyebrow}
                    onChange={(event) => updateField("eyebrow", event.target.value)}
                    placeholder={t("eyebrowPlaceholder", { storeName: "{storeName}" })}
                  />
                </FieldRow>
              </div>
              <FieldRow label={t("headline")}>
                <Input
                  value={page.headline}
                  onChange={(event) => updateField("headline", event.target.value)}
                  placeholder={t("headlinePlaceholder")}
                />
              </FieldRow>
              <FieldRow label={t("summary")}>
                <Textarea
                  value={page.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  rows={4}
                />
              </FieldRow>
              <div className="grid gap-3 md:grid-cols-2">
                <FieldRow label={t("primaryButton")}>
                  <Input
                    value={page.primaryCtaLabel}
                    onChange={(event) =>
                      updateField("primaryCtaLabel", event.target.value)
                    }
                    placeholder={t("primaryCtaPlaceholder")}
                  />
                </FieldRow>
                <FieldRow label={t("secondaryButton")}>
                  <Input
                    value={page.secondaryCtaLabel}
                    onChange={(event) =>
                      updateField("secondaryCtaLabel", event.target.value)
                    }
                    placeholder={t("secondaryCtaPlaceholder", { storeName: "{storeName}" })}
                  />
                </FieldRow>
              </div>
              <ImageUploadField
                id="about-hero-image"
                label={t("heroImage")}
                value={page.heroImageUrl}
                onChange={(value) => updateField("heroImageUrl", value)}
                previewAlt={t("heroImageAlt")}
                previewClassName="h-full w-full object-cover"
              />
            </CardContent>
          </Card>

          {/* Numbers */}
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{t("numbersTitle")}</CardTitle>
              <CardDescription>
                {t("numbersDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SwitchRow
                label={t("showStats")}
                description={t("showStatsDescription")}
                checked={page.showStats}
                onChange={(value) => updateField("showStats", value)}
              />
              <div className="space-y-3">
                {page.stats.map((stat) => (
                  <div
                    key={stat.key}
                    className="grid gap-3 rounded-xl border border-border bg-background p-3.5 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] md:items-center"
                  >
                    <div className="flex items-center gap-3 md:w-40">
                      <Switch
                        checked={stat.enabled}
                        onCheckedChange={(value) =>
                          updateStat(stat.key, { enabled: value })
                        }
                        aria-label={t("showStatAria", { stat: t(STAT_NAMES[stat.key]) })}
                      />
                      <div>
                        <p className="text-sm font-medium capitalize">{t(STAT_NAMES[stat.key])}</p>
                        <p className="text-xs text-muted-foreground">
                          {t(STAT_HINTS[stat.key])}
                        </p>
                      </div>
                    </div>
                    <Input
                      value={stat.label}
                      onChange={(event) =>
                        updateStat(stat.key, { label: event.target.value })
                      }
                      placeholder={t("labelPlaceholder")}
                      aria-label={t("statLabelAria", { stat: t(STAT_NAMES[stat.key]) })}
                    />
                    <Input
                      value={stat.manualValue}
                      onChange={(event) =>
                        updateStat(stat.key, { manualValue: event.target.value })
                      }
                      placeholder={stat.key === "founded" ? t("foundedPlaceholder") : t("autoPlaceholder")}
                      aria-label={t("statValueAria", { stat: t(STAT_NAMES[stat.key]) })}
                    />
                  </div>
                ))}
              </div>
              <FieldRow label={t("footnote")}>
                <Input
                  value={page.statsFootnote}
                  onChange={(event) => updateField("statsFootnote", event.target.value)}
                  placeholder={t("footnotePlaceholder")}
                />
              </FieldRow>
            </CardContent>
          </Card>

          {/* How it works */}
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{t("howItWorksTitle")}</CardTitle>
              <CardDescription>
                {t("howItWorksDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FieldRow label={t("sectionTitle")}>
                <Input
                  value={page.howItWorksTitle}
                  onChange={(event) => updateField("howItWorksTitle", event.target.value)}
                />
              </FieldRow>
              <FieldRow label={t("sectionDescription")}>
                <Input
                  value={page.howItWorksDescription}
                  onChange={(event) =>
                    updateField("howItWorksDescription", event.target.value)
                  }
                />
              </FieldRow>

              <FieldRow label={t("shoppersColumnTitle")}>
                <Input
                  value={page.shopperStepsTitle}
                  onChange={(event) =>
                    updateField("shopperStepsTitle", event.target.value)
                  }
                />
              </FieldRow>
              <ListSection
                label={t("shopperSteps")}
                addLabel={t("addStep")}
                count={page.shopperSteps.length}
                limit={LIST_LIMITS.shopperSteps}
                onAdd={() =>
                  addItem("shopperSteps", {
                    id: newId("step"),
                    title: "",
                    description: "",
                  })
                }
              >
                {page.shopperSteps.map((step, index) => (
                  <ItemFrame
                    key={step.id}
                    label={t("stepLabel", { number: index + 1 })}
                    index={index}
                    count={page.shopperSteps.length}
                    onMove={(direction) => moveItem("shopperSteps", index, direction)}
                    onRemove={() => removeItem("shopperSteps", step.id)}
                  >
                    <Input
                      value={step.title}
                      onChange={(event) =>
                        patchItem("shopperSteps", step.id, { title: event.target.value })
                      }
                      placeholder={t("titlePlaceholder")}
                    />
                    <Textarea
                      value={step.description}
                      onChange={(event) =>
                        patchItem("shopperSteps", step.id, {
                          description: event.target.value,
                        })
                      }
                      rows={2}
                      placeholder={t("oneSentencePlaceholder")}
                    />
                  </ItemFrame>
                ))}
              </ListSection>

              <SwitchRow
                label={t("showSellerSteps")}
                description={t("showSellerStepsDescription")}
                checked={page.showSellerSteps}
                onChange={(value) => updateField("showSellerSteps", value)}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <FieldRow label={t("sellersColumnTitle")}>
                  <Input
                    value={page.sellerStepsTitle}
                    onChange={(event) =>
                      updateField("sellerStepsTitle", event.target.value)
                    }
                  />
                </FieldRow>
                <FieldRow label={t("sellerLinkLabel")}>
                  <Input
                    value={page.sellerCtaLabel}
                    onChange={(event) => updateField("sellerCtaLabel", event.target.value)}
                    placeholder={t("sellerCtaPlaceholder")}
                  />
                </FieldRow>
              </div>
              <ListSection
                label={t("sellerSteps")}
                addLabel={t("addStep")}
                count={page.sellerSteps.length}
                limit={LIST_LIMITS.sellerSteps}
                onAdd={() =>
                  addItem("sellerSteps", {
                    id: newId("step"),
                    title: "",
                    description: "",
                  })
                }
              >
                {page.sellerSteps.map((step, index) => (
                  <ItemFrame
                    key={step.id}
                    label={t("stepLabel", { number: index + 1 })}
                    index={index}
                    count={page.sellerSteps.length}
                    onMove={(direction) => moveItem("sellerSteps", index, direction)}
                    onRemove={() => removeItem("sellerSteps", step.id)}
                  >
                    <Input
                      value={step.title}
                      onChange={(event) =>
                        patchItem("sellerSteps", step.id, { title: event.target.value })
                      }
                      placeholder={t("titlePlaceholder")}
                    />
                    <Textarea
                      value={step.description}
                      onChange={(event) =>
                        patchItem("sellerSteps", step.id, {
                          description: event.target.value,
                        })
                      }
                      rows={2}
                      placeholder={t("oneSentencePlaceholder")}
                    />
                  </ItemFrame>
                ))}
              </ListSection>

              <ListSection
                label={t("buyerProtection")}
                addLabel={t("addItem")}
                count={page.protectionItems.length}
                limit={LIST_LIMITS.protectionItems}
                onAdd={() =>
                  addItem("protectionItems", {
                    id: newId("protection"),
                    title: "",
                    text: "",
                  })
                }
              >
                {page.protectionItems.map((item, index) => (
                  <ItemFrame
                    key={item.id}
                    label={t("itemLabel", { number: index + 1 })}
                    index={index}
                    count={page.protectionItems.length}
                    onMove={(direction) => moveItem("protectionItems", index, direction)}
                    onRemove={() => removeItem("protectionItems", item.id)}
                  >
                    <Input
                      value={item.title}
                      onChange={(event) =>
                        patchItem("protectionItems", item.id, { title: event.target.value })
                      }
                      placeholder={t("titlePlaceholder")}
                    />
                    <Textarea
                      value={item.text}
                      onChange={(event) =>
                        patchItem("protectionItems", item.id, { text: event.target.value })
                      }
                      rows={2}
                      placeholder={t("oneSentencePlaceholder")}
                    />
                  </ItemFrame>
                ))}
              </ListSection>
            </CardContent>
          </Card>

          {/* Mission & values */}
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{t("missionValuesTitle")}</CardTitle>
              <CardDescription>
                {t("missionValuesDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FieldRow label={t("sectionTitle")}>
                <Input
                  value={page.valuesTitle}
                  onChange={(event) => updateField("valuesTitle", event.target.value)}
                />
              </FieldRow>
              <FieldRow label={t("missionStatement")}>
                <Textarea
                  value={page.missionStatement}
                  onChange={(event) =>
                    updateField("missionStatement", event.target.value)
                  }
                  rows={2}
                />
              </FieldRow>
              <ListSection
                label={t("values")}
                addLabel={t("addValue")}
                count={page.values.length}
                limit={LIST_LIMITS.values}
                onAdd={() =>
                  addItem("values", {
                    id: newId("value"),
                    icon: "shield",
                    title: "",
                    text: "",
                  })
                }
              >
                {page.values.map((item, index) => (
                  <ItemFrame
                    key={item.id}
                    label={t("valueLabel", { number: index + 1 })}
                    index={index}
                    count={page.values.length}
                    onMove={(direction) => moveItem("values", index, direction)}
                    onRemove={() => removeItem("values", item.id)}
                  >
                    <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
                      <Select
                        value={item.icon}
                        onValueChange={(value) =>
                          patchItem("values", item.id, { icon: value as AboutValueIcon })
                        }
                      >
                        <SelectTrigger className="w-full" aria-label={t("iconAria")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ABOUT_VALUE_ICONS.map((icon) => (
                            <SelectItem key={icon} value={icon}>
                              {t(VALUE_ICON_LABELS[icon])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={item.title}
                        onChange={(event) =>
                          patchItem("values", item.id, { title: event.target.value })
                        }
                        placeholder={t("titlePlaceholder")}
                      />
                    </div>
                    <Input
                      value={item.text}
                      onChange={(event) =>
                        patchItem("values", item.id, { text: event.target.value })
                      }
                      placeholder={t("oneLinePlaceholder")}
                    />
                  </ItemFrame>
                ))}
              </ListSection>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Story */}
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{t("storyTitle")}</CardTitle>
              <CardDescription>
                {t("storyDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FieldRow label={t("sectionTitle")}>
                <Input
                  value={page.storyTitle}
                  onChange={(event) => updateField("storyTitle", event.target.value)}
                />
              </FieldRow>
              <FieldRow label={t("storyTitle")}>
                <RichTextEditor
                  value={page.storyBody}
                  onChange={(value) => updateField("storyBody", value)}
                  placeholder={t("storyPlaceholder")}
                />
              </FieldRow>
              <FieldRow label={t("milestonesTitle")}>
                <Input
                  value={page.milestonesTitle}
                  onChange={(event) => updateField("milestonesTitle", event.target.value)}
                />
              </FieldRow>
              <ListSection
                label={t("milestones")}
                addLabel={t("addMilestone")}
                count={page.milestones.length}
                limit={LIST_LIMITS.milestones}
                onAdd={() =>
                  addItem("milestones", { id: newId("milestone"), year: "", text: "" })
                }
              >
                {page.milestones.map((item, index) => (
                  <ItemFrame
                    key={item.id}
                    label={t("milestoneLabel", { number: index + 1 })}
                    index={index}
                    count={page.milestones.length}
                    onMove={(direction) => moveItem("milestones", index, direction)}
                    onRemove={() => removeItem("milestones", item.id)}
                  >
                    <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
                      <Input
                        value={item.year}
                        onChange={(event) =>
                          patchItem("milestones", item.id, { year: event.target.value })
                        }
                        placeholder={t("yearPlaceholder")}
                      />
                      <Input
                        value={item.text}
                        onChange={(event) =>
                          patchItem("milestones", item.id, { text: event.target.value })
                        }
                        placeholder={t("whatHappenedPlaceholder")}
                      />
                    </div>
                  </ItemFrame>
                ))}
              </ListSection>
            </CardContent>
          </Card>

          {/* Team */}
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{t("teamTitle")}</CardTitle>
              <CardDescription>
                {t("teamDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SwitchRow
                label={t("showTeam")}
                checked={page.showTeam}
                onChange={(value) => updateField("showTeam", value)}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <FieldRow label={t("sectionTitle")}>
                  <Input
                    value={page.teamTitle}
                    onChange={(event) => updateField("teamTitle", event.target.value)}
                  />
                </FieldRow>
                <FieldRow label={t("sectionDescription")}>
                  <Input
                    value={page.teamDescription}
                    onChange={(event) => updateField("teamDescription", event.target.value)}
                  />
                </FieldRow>
              </div>
              <ListSection
                label={t("members")}
                addLabel={t("addMember")}
                count={page.members.length}
                limit={LIST_LIMITS.members}
                onAdd={() =>
                  addItem("members", {
                    id: newId("member"),
                    name: "",
                    role: "",
                    bio: "",
                    imageUrl: "",
                    linkUrl: "",
                  })
                }
              >
                {page.members.map((member, index) => (
                  <ItemFrame
                    key={member.id}
                    label={member.name || t("memberLabel", { number: index + 1 })}
                    index={index}
                    count={page.members.length}
                    onMove={(direction) => moveItem("members", index, direction)}
                    onRemove={() => removeItem("members", member.id)}
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        value={member.name}
                        onChange={(event) =>
                          patchItem("members", member.id, { name: event.target.value })
                        }
                        placeholder={t("namePlaceholder")}
                      />
                      <Input
                        value={member.role}
                        onChange={(event) =>
                          patchItem("members", member.id, { role: event.target.value })
                        }
                        placeholder={t("rolePlaceholder")}
                      />
                    </div>
                    <Input
                      value={member.bio}
                      onChange={(event) =>
                        patchItem("members", member.id, { bio: event.target.value })
                      }
                      placeholder={t("bioPlaceholder")}
                    />
                    <Input
                      value={member.linkUrl}
                      onChange={(event) =>
                        patchItem("members", member.id, { linkUrl: event.target.value })
                      }
                      placeholder={t("linkPlaceholder")}
                    />
                    <ImageUploadField
                      id={`about-member-${member.id}`}
                      label={t("photo")}
                      value={member.imageUrl}
                      onChange={(value) =>
                        patchItem("members", member.id, { imageUrl: value })
                      }
                      previewAlt={member.name || t("teamMemberAlt")}
                      previewClassName="h-full w-full object-cover"
                    />
                  </ItemFrame>
                ))}
              </ListSection>
            </CardContent>
          </Card>

          {/* Social proof */}
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{t("reviewsTitle")}</CardTitle>
              <CardDescription>
                {t("reviewsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SwitchRow
                label={t("showReviews")}
                checked={page.showTestimonials}
                onChange={(value) => updateField("showTestimonials", value)}
              />
              <FieldRow label={t("sectionTitle")}>
                <Input
                  value={page.testimonialsTitle}
                  onChange={(event) =>
                    updateField("testimonialsTitle", event.target.value)
                  }
                />
              </FieldRow>
              <FieldRow label={t("sectionDescription")}>
                <Input
                  value={page.testimonialsDescription}
                  onChange={(event) =>
                    updateField("testimonialsDescription", event.target.value)
                  }
                />
              </FieldRow>
              <FieldRow label={t("minRating")}>
                <NumberInput
                  min={1}
                  max={5}
                  step={1}
                  value={page.testimonialsMinRating}
                  whenEmpty="keep"
                  normalize={Math.trunc}
                  onValueChange={(next) => {
                    if (next !== undefined) updateField("testimonialsMinRating", next);
                  }}
                />
              </FieldRow>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{t("contactTitle")}</CardTitle>
              <CardDescription>
                {t("contactDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SwitchRow
                label={t("showContact")}
                checked={page.showContact}
                onChange={(value) => updateField("showContact", value)}
              />
              <FieldRow label={t("sectionTitle")}>
                <Input
                  value={page.contactTitle}
                  onChange={(event) => updateField("contactTitle", event.target.value)}
                />
              </FieldRow>
              <FieldRow label={t("sectionDescription")}>
                <Input
                  value={page.contactDescription}
                  onChange={(event) =>
                    updateField("contactDescription", event.target.value)
                  }
                  placeholder={t("contactDescriptionPlaceholder")}
                />
              </FieldRow>
            </CardContent>
          </Card>

          {/* CTA */}
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{t("ctaTitle")}</CardTitle>
              <CardDescription>{t("ctaDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FieldRow label={t("title")}>
                <Input
                  value={page.ctaTitle}
                  onChange={(event) => updateField("ctaTitle", event.target.value)}
                />
              </FieldRow>
              <FieldRow label={t("description")}>
                <Input
                  value={page.ctaDescription}
                  onChange={(event) => updateField("ctaDescription", event.target.value)}
                />
              </FieldRow>
              <div className="grid gap-3 md:grid-cols-2">
                <FieldRow label={t("primaryButton")}>
                  <Input
                    value={page.ctaPrimaryLabel}
                    onChange={(event) => updateField("ctaPrimaryLabel", event.target.value)}
                  />
                </FieldRow>
                <FieldRow label={t("secondaryLink")}>
                  <Input
                    value={page.ctaSecondaryLabel}
                    onChange={(event) =>
                      updateField("ctaSecondaryLabel", event.target.value)
                    }
                  />
                </FieldRow>
              </div>
            </CardContent>
          </Card>

          {/* SEO & visibility */}
          <Card className="gap-4">
            <CardHeader>
              <CardTitle>{t("seoTitle")}</CardTitle>
              <CardDescription>
                {t("seoDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FieldRow label={t("metaTitle")}>
                <Input
                  value={page.metaTitle}
                  onChange={(event) => updateField("metaTitle", event.target.value)}
                  placeholder={t("metaTitlePlaceholder")}
                />
              </FieldRow>
              <FieldRow label={t("metaDescription")}>
                <Textarea
                  value={page.metaDescription}
                  onChange={(event) => updateField("metaDescription", event.target.value)}
                  rows={3}
                  placeholder={t("metaDescriptionPlaceholder")}
                />
              </FieldRow>
              <SwitchRow
                label={t("visible")}
                description={t("visibleDescription")}
                checked={page.visible}
                onChange={(value) => updateField("visible", value)}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {!isDirty ? (
        <p className="text-sm text-muted-foreground">
          {t("allSaved")}
        </p>
      ) : null}
    </div>
  );
}

function ListSection({
  label,
  addLabel,
  count,
  limit,
  onAdd,
  children,
}: {
  label: string;
  addLabel: string;
  count: number;
  limit: number;
  onAdd: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("admin.hc.aboutPageEditor");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}{" "}
          <span className="font-normal normal-case tracking-normal">
            ({count}/{limit})
          </span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          disabled={count >= limit}
        >
          <Plus className="mr-2 h-4 w-4" />
          {addLabel}
        </Button>
      </div>
      {count === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-3.5 text-sm text-muted-foreground">
          {t("emptyList")}
        </p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </div>
  );
}

function ItemFrame({
  label,
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("admin.hc.aboutPageEditor");
  return (
    <div className="rounded-xl border border-border bg-background p-3.5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="truncate text-sm font-semibold text-foreground">{label}</p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => onMove("up")}
            disabled={index === 0}
            aria-label={t("moveUp")}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => onMove("down")}
            disabled={index === count - 1}
            aria-label={t("moveDown")}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8 text-rose-600 dark:text-rose-400"
            onClick={onRemove}
            aria-label={t("remove")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
