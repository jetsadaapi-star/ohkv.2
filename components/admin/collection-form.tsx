"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/hooks/use-locale-navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import { MediaUploader, UploadedMedia } from "@/components/ui/media-uploader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast-notification";
import { CollectionConditionBuilder } from "./collection-condition-builder";
import { CollectionProductSelector } from "./collection-product-selector";
import { CollectionFormSkeleton } from "@/components/admin/collection-form-skeleton";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { SearchEngineListingPreview } from "@/components/admin/search-engine-listing-preview";
import { AiGenerateMenu } from "@/components/ai-authoring/ai-generate-menu";
import { AiStudioImageField } from "@/components/ai-authoring/ai-studio-image-field";
import { useAiAuthoring } from "@/components/ai-authoring/use-ai-authoring";
import type {
  AIAuthoringRequest,
  AIAuthoringSeoDraft,
} from "@/lib/ai-authoring/types";
import type { CollectionCondition } from "@/types";
import type { ProductPickerItem } from "@/types/product-list";

const makeCollectionSchema = (titleRequired: string) =>
  z.object({
  title: z.string().min(1, titleRequired).max(255),
  description: z.string().max(5000).optional(),
  collectionType: z.enum(["manual", "automated"]),
  kind: z.enum(["collection", "look"]),
  status: z.enum(["active", "draft"]),
  sortOrder: z.enum([
    "manual",
    "best-selling",
    "title-asc",
    "title-desc",
    "price-asc",
    "price-desc",
    "created-asc",
    "created-desc",
  ]),
  position: z.number().int().min(0),
  publishOnlineStore: z.boolean(),
  publishPointOfSale: z.boolean(),
  seoPageTitle: z.string().max(70).optional(),
  seoMetaDescription: z.string().max(320).optional(),
  seoHandle: z.string().optional(),
  imageUrl: z.string().optional(),
  imageAlt: z.string().optional(),
  });

// AI authoring bounds — mirror the collection schema above so a generated value
// never trips zod validation on save. The lower bound is a quality floor.
const DESCRIPTION_MIN_CHARS = 50;
const DESCRIPTION_MAX_CHARS = 5000;

type CollectionFormData = z.infer<ReturnType<typeof makeCollectionSchema>>;

interface CollectionFormProps {
  collectionId?: string;
}

export function CollectionForm({ collectionId }: CollectionFormProps) {
  const t = useTranslations("admin.hc.collectionForm");
  const collectionSchema = useMemo(
    () => makeCollectionSchema(t("titleRequired")),
    [t],
  );
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const locale = typeof params.locale === "string" ? params.locale : "en";
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(!!collectionId);

  // Manual collection products — the id array drives ordering and the save
  // payload; the populated rows beside it only seed the picker's display.
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [initialProducts, setInitialProducts] = useState<ProductPickerItem[]>(
    [],
  );

  // Automated collection conditions
  const [conditions, setConditions] = useState<CollectionCondition[]>([]);
  const [conditionMatch, setConditionMatch] = useState<"all" | "any">("all");

  const form = useForm<CollectionFormData>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      title: "",
      description: "",
      collectionType: "manual",
      kind: "collection",
      status: "draft",
      sortOrder: "manual",
      position: 0,
      publishOnlineStore: true,
      publishPointOfSale: false,
      seoPageTitle: "",
      seoMetaDescription: "",
      seoHandle: "",
      imageUrl: "",
      imageAlt: "",
    },
  });

  const collectionType =
    useWatch({
      control: form.control,
      name: "collectionType",
    }) || "manual";
  const watchedTitle = useWatch({ control: form.control, name: "title" }) || "";
  const watchedDescription =
    useWatch({ control: form.control, name: "description" }) || "";
  const watchedSeoPageTitle =
    useWatch({ control: form.control, name: "seoPageTitle" }) || "";
  const watchedSeoMetaDescription =
    useWatch({ control: form.control, name: "seoMetaDescription" }) || "";
  const watchedSeoHandle =
    useWatch({ control: form.control, name: "seoHandle" }) || "";
  const watchedImageAlt =
    useWatch({ control: form.control, name: "imageAlt" }) || "";

  // Fetch collection data if editing
  useEffect(() => {
    if (!collectionId) return;

    async function fetchCollection() {
      setIsFetching(true);
      try {
        const res = await fetch(`/api/admin/collections/${collectionId}`);
        const data = await res.json();

        if (data.success && data.data) {
          const collection = data.data;
          form.reset({
            title: collection.title,
            description: collection.description || "",
            collectionType: collection.collectionType,
            kind: collection.kind === "look" ? "look" : "collection",
            status: collection.status,
            sortOrder: collection.sortOrder,
            position: collection.position || 0,
            publishOnlineStore: collection.publishing?.onlineStore ?? true,
            publishPointOfSale: collection.publishing?.pointOfSale ?? false,
            seoPageTitle: collection.seo?.pageTitle || "",
            seoMetaDescription: collection.seo?.metaDescription || "",
            seoHandle: collection.seo?.handle || "",
            imageUrl: collection.image?.url || "",
            imageAlt: collection.image?.alt || "",
          });

          // Set products for manual collection. The response populates each
          // product with exactly the fields the picker renders, so hand those
          // through instead of discarding them and making it look each one up.
          if (collection.products && Array.isArray(collection.products)) {
            const products = collection.products as (ProductPickerItem | string)[];
            setSelectedProducts(
              products.map((p) => (typeof p === "string" ? p : p._id)),
            );
            setInitialProducts(
              products.filter(
                (p): p is ProductPickerItem => typeof p !== "string",
              ),
            );
          }

          // Set conditions for automated collection
          if (collection.conditions && Array.isArray(collection.conditions)) {
            setConditions(collection.conditions);
          }
          setConditionMatch(collection.conditionMatch || "all");
        }
      } catch (error) {
        console.error("Failed to fetch collection:", error);
        toast.error(t("loadFailed"));
      } finally {
        setIsFetching(false);
      }
    }

    fetchCollection();
  }, [collectionId, form]);

  const onSubmit = async (data: CollectionFormData) => {
    setIsLoading(true);
    try {
      const url = collectionId
        ? `/api/admin/collections/${collectionId}`
        : "/api/admin/collections";
      const method = collectionId ? "PUT" : "POST";

      const payload = {
        title: data.title,
        description: data.description,
        collectionType: data.collectionType,
        kind: data.kind,
        status: data.status,
        sortOrder: data.sortOrder,
        position: data.position,
        publishing: {
          onlineStore: data.publishOnlineStore,
          pointOfSale: data.publishPointOfSale,
        },
        seo: {
          pageTitle: data.seoPageTitle || undefined,
          metaDescription: data.seoMetaDescription || undefined,
          handle: data.seoHandle || undefined,
        },
        image: data.imageUrl
          ? {
              url: data.imageUrl,
              alt: data.imageAlt || data.title,
            }
          : undefined,
        // Include products or conditions based on type
        products: data.collectionType === "manual" ? selectedProducts : [],
        conditions: data.collectionType === "automated" ? conditions : [],
        conditionMatch:
          data.collectionType === "automated" ? conditionMatch : "all",
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        toast.success(
          collectionId
            ? t("updatedSuccess")
            : t("createdSuccess"),
        );
        router.back();
      } else {
        toast.error(result.message || t("saveFailed"));
      }
    } catch {
      toast.error(t("errorOccurred"));
    } finally {
      setIsLoading(false);
    }
  };

  // Collections are admin-only, so the content endpoint is always the admin one
  // (no vendor variant like the product form has).
  const aiAuthoring = useAiAuthoring({
    contentEndpoint: "/api/admin/ai-authoring/content",
  });

  // Context handed to the model on every generate — read fresh so edits made
  // just before opening the menu are included.
  const getCollectionAuthoringFields = () => ({
    title: watchedTitle,
    description: watchedDescription,
  });

  const ensureTitleForAI = () => {
    if (watchedTitle.trim()) return true;
    toast.error(t("aiTitleRequired"));
    return false;
  };

  const descriptionRequest: AIAuthoringRequest = {
    entity: "collection",
    operation: "description",
    locale,
    targetField: "description",
    fields: getCollectionAuthoringFields(),
    constraints: {
      maxLength: DESCRIPTION_MAX_CHARS,
      audience: "shopper",
    },
  };

  const seoRequest: AIAuthoringRequest = {
    entity: "collection",
    operation: "seo",
    locale,
    targetField: "seo",
    fields: getCollectionAuthoringFields(),
    constraints: {
      audience: "shopper",
    },
  };

  const generateDescriptionDraft = async (request: AIAuthoringRequest) => {
    const draft = await aiAuthoring.generateContent(
      "collection-description",
      request,
    );
    if (typeof draft?.fields.description === "string")
      return draft.fields.description;
    if (typeof draft?.fields.content === "string") return draft.fields.content;
    return null;
  };

  const generateSeoDraft = async (request: AIAuthoringRequest) => {
    const draft = await aiAuthoring.generateContent("collection-seo", request);
    return draft?.seo ?? null;
  };

  // Edit only — `isFetching` starts false when there is no collection to load,
  // so creating a collection still paints the real form immediately.
  if (isFetching) {
    return (
      <CollectionFormSkeleton />
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto w-full max-w-6xl space-y-4"
      >
        <AdminFormStickyHeader
          className="!mx-0 -mt-2 border-b-0 px-0 shadow-none md:px-0"
          title={collectionId ? t("editTitle") : t("newTitle")}
          description={
            collectionId
              ? t("editDescription")
              : t("newDescription")
          }
          actions={
            <>
              <Button type="submit" disabled={isLoading} size="sm">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {collectionId ? t("updateCollection") : t("createCollection")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.back()}
              >
                {t("cancel")}
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Basic Info */}
            <Card className="gap-2">
              <CardHeader>
                <CardTitle>{t("detailsTitle")}</CardTitle>
                <CardDescription>
                  {t("detailsDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("titleLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("titlePlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>{t("descriptionLabel")}</FormLabel>
                        <AiGenerateMenu
                          label={t("aiGenerate")}
                          placeholder={t("aiDescriptionPlaceholder")}
                          minChars={DESCRIPTION_MIN_CHARS}
                          maxChars={DESCRIPTION_MAX_CHARS}
                          request={descriptionRequest}
                          loading={aiAuthoring.isLoading(
                            "collection-description",
                          )}
                          canOpen={ensureTitleForAI}
                          onGenerate={generateDescriptionDraft}
                          onApply={(value) =>
                            form.setValue("description", value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        />
                      </div>
                      <FormControl>
                        <Textarea
                          placeholder={t("descriptionPlaceholder")}
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Image */}
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("imageLabel")}</FormLabel>
                      <MediaUploader
                        maxFiles={1}
                        acceptTypes={["image"]}
                        value={
                          field.value
                            ? [
                                {
                                  _id: "existing",
                                  url: field.value,
                                  type: "image",
                                  mimeType: "image/*",
                                  alt: form.getValues("imageAlt") || undefined,
                                  position: 0,
                                } as UploadedMedia,
                              ]
                            : []
                        }
                        onChange={(items) => {
                          const img = items.find((m) => m.type === "image");
                          form.setValue("imageUrl", img?.url || "");
                          if (img?.alt !== undefined) {
                            form.setValue("imageAlt", img.alt);
                          }
                        }}
                        aiGenerateAction={
                          <AiStudioImageField
                            entity="collection"
                            scope="admin"
                            locale={locale}
                            targetField="image"
                            audience="shopper"
                            getFields={getCollectionAuthoringFields}
                            value={field.value || ""}
                            alt={watchedImageAlt || watchedTitle || undefined}
                            onChange={(url, alt) => {
                              field.onChange(url);
                              // The stored alt describes the image it came with,
                              // so it must never outlive it. Clearing it lets
                              // onSubmit fall back to the collection title.
                              form.setValue("imageAlt", url ? (alt ?? "") : "", {
                                shouldDirty: true,
                              });
                            }}
                            breadcrumbRoot={
                              collectionId ? t("breadcrumbEdit") : t("breadcrumbNew")
                            }
                            breadcrumbLeaf={t("breadcrumbImage")}
                            savedMessage={t("imageSaved")}
                            subjectNoun="collection"
                            posHref="/admin/pos"
                            browseHref="/"
                            persistKey={`collection:admin:${collectionId ?? "new"}:image`}
                          />
                        }
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Collection Type */}
            <Card className="gap-2">
              <CardHeader>
                <CardTitle>{t("kindTitle")}</CardTitle>
                <CardDescription>
                  {t("kindDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="kind"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="grid grid-cols-2 gap-4">
                          {(
                            [
                              {
                                value: "collection",
                                titleKey: "kindCollection",
                                hintKey: "kindCollectionHint",
                              },
                              {
                                value: "look",
                                titleKey: "kindLook",
                                hintKey: "kindLookHint",
                              },
                            ] as const
                          ).map((option) => (
                            <div
                              key={option.value}
                              className={`rounded-lg border-2 p-3 hover:bg-accent ${
                                field.value === option.value
                                  ? "border-primary"
                                  : "border-muted"
                              }`}
                            >
                              <input
                                type="radio"
                                id={`kind-${option.value}`}
                                value={option.value}
                                name="kind"
                                checked={field.value === option.value}
                                onChange={() => field.onChange(option.value)}
                                className="sr-only"
                              />
                              <Label
                                htmlFor={`kind-${option.value}`}
                                className="flex flex-col items-center justify-center cursor-pointer gap-1 w-full"
                              >
                                <span className="text-sm font-medium">
                                  {t(option.titleKey)}
                                </span>
                                <span className="text-xs text-muted-foreground text-center">
                                  {t(option.hintKey)}
                                </span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="gap-2">
              <CardHeader>
                <CardTitle>{t("typeTitle")}</CardTitle>
                <CardDescription>
                  {t("typeDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="collectionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="grid grid-cols-2 gap-4">
                          <div
                            className={`rounded-lg border-2 p-3 hover:bg-accent ${
                              field.value === "manual"
                                ? "border-primary"
                                : "border-muted"
                            }`}
                          >
                            <input
                              type="radio"
                              id="manual"
                              value="manual"
                              name="collectionType"
                              checked={field.value === "manual"}
                              onChange={() => field.onChange("manual")}
                              className="sr-only"
                            />
                            <Label
                              htmlFor="manual"
                              className="flex flex-col items-center justify-center cursor-pointer gap-1 w-full"
                            >
                              <span className="text-sm font-medium">
                                {t("typeManual")}
                              </span>
                              <span className="text-xs text-muted-foreground text-center">
                                {t("typeManualHint")}
                              </span>
                            </Label>
                          </div>
                          <div
                            className={`rounded-lg border-2 p-3 hover:bg-accent ${
                              field.value === "automated"
                                ? "border-primary"
                                : "border-muted"
                            }`}
                          >
                            <input
                              type="radio"
                              id="automated"
                              value="automated"
                              name="collectionType"
                              checked={field.value === "automated"}
                              onChange={() => field.onChange("automated")}
                              className="sr-only"
                            />
                            <Label
                              htmlFor="automated"
                              className="flex flex-col items-center justify-center cursor-pointer gap-1 w-full"
                            >
                              <span className="text-sm font-medium">
                                {t("typeAutomated")}
                              </span>
                              <span className="text-xs text-muted-foreground text-center">
                                {t("typeAutomatedHint")}
                              </span>
                            </Label>
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Products or Conditions based on type */}
            {collectionType === "manual" ? (
              <CollectionProductSelector
                selectedProducts={selectedProducts}
                onChange={setSelectedProducts}
                initialProducts={initialProducts}
              />
            ) : (
              <CollectionConditionBuilder
                conditions={conditions}
                onChange={setConditions}
                matchType={conditionMatch}
                onMatchTypeChange={setConditionMatch}
              />
            )}

            <SearchEngineListingPreview
              pageTitle={watchedSeoPageTitle}
              metaDescription={watchedSeoMetaDescription}
              handle={watchedSeoHandle}
              title={watchedTitle}
              description={watchedDescription}
              entityLabel="collection"
              emptyTitle={t("untitledCollection")}
              emptyHandle="collection-handle"
              pathPrefix="collections"
              titlePlaceholder={watchedTitle || t("seoTitlePlaceholder")}
              handlePlaceholder="summer-collection"
              defaultEditing
              aiGenerateAction={
                <AiGenerateMenu<AIAuthoringSeoDraft>
                  label={t("aiImproveSeo")}
                  placeholder={t("aiSeoPlaceholder")}
                  allowAttachment={false}
                  request={seoRequest}
                  loading={aiAuthoring.isLoading("collection-seo")}
                  canOpen={ensureTitleForAI}
                  onGenerate={generateSeoDraft}
                  previewText={(draft) =>
                    [draft.pageTitle, draft.metaDescription]
                      .filter(Boolean)
                      .join("\n")
                  }
                  onApply={(draft) => {
                    if (draft.pageTitle) {
                      form.setValue("seoPageTitle", draft.pageTitle, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                    if (draft.metaDescription) {
                      form.setValue("seoMetaDescription", draft.metaDescription, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                    // The model names this either way; the form field is `handle`.
                    const handle = draft.handle || draft.slug;
                    if (handle) {
                      form.setValue("seoHandle", handle, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                />
              }
              onPageTitleChange={(value) =>
                form.setValue("seoPageTitle", value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              onMetaDescriptionChange={(value) =>
                form.setValue("seoMetaDescription", value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              onHandleChange={(value) =>
                form.setValue("seoHandle", value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            />
          </div>

          {/* Right Column - Settings */}
          <div className="space-y-4">
            {/* Status */}
            <Card className="gap-2">
              <CardHeader>
                <CardTitle>{t("statusTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <NativeSelect
                          value={field.value}
                          onChange={field.onChange}
                        >
                          <option value="draft">{t("statusDraft")}</option>
                          <option value="active">{t("statusActive")}</option>
                        </NativeSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Publishing */}
            <Card className="gap-2">
              <CardHeader>
                <CardTitle>{t("publishingTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="publishOnlineStore"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>{t("onlineStore")}</FormLabel>
                      </div>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="publishPointOfSale"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>{t("pointOfSale")}</FormLabel>
                      </div>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Sort Order */}
            <Card className="gap-2">
              <CardHeader>
                <CardTitle>{t("sortOrderTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <NativeSelect
                          value={field.value}
                          onChange={field.onChange}
                        >
                          <option value="manual">{t("sortManual")}</option>
                          <option value="best-selling">{t("sortBestSelling")}</option>
                          <option value="title-asc">{t("sortTitleAsc")}</option>
                          <option value="title-desc">
                            {t("sortTitleDesc")}
                          </option>
                          <option value="price-asc">{t("sortPriceAsc")}</option>
                          <option value="price-desc">{t("sortPriceDesc")}</option>
                          <option value="created-desc">{t("sortCreatedDesc")}</option>
                          <option value="created-asc">{t("sortCreatedAsc")}</option>
                        </NativeSelect>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Position */}
            <Card className="gap-2">
              <CardHeader>
                <CardTitle>{t("positionTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <NumberInput
                          min={0}
                          step={1}
                          {...field}
                          whenEmpty={0}
                          normalize={Math.trunc}
                          onValueChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("positionHint")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
