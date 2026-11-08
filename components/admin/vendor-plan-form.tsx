"use client";

import * as z from "zod";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Check,
  Info,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/hooks/use-locale-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useCurrency } from "@/providers/currency-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast-notification";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { cn } from "@/lib/utils";
import {
  ALL_VENDOR_PACKS,
  COMMISSION_ONLY_PACKS,
  VENDOR_PERMISSION_PACKS,
  packsFromPlanCapabilities,
  type VendorPermissionPack,
  type VendorPlanCapabilityInput,
} from "@/config/permissions.config";

/** One line on what each pack buys, for the plan author rather than the vendor (message keys). */
const PACK_BLURBS: Record<VendorPermissionPack, string> = {
  catalog: "packBlurbCatalog",
  orders: "packBlurbOrders",
  storefront: "packBlurbStorefront",
  analytics: "packBlurbAnalytics",
  inbox: "packBlurbInbox",
  staff: "packBlurbStaff",
  discounts: "packBlurbDiscounts",
  pos: "packBlurbPos",
  payouts: "packBlurbPayouts",
  boosts: "packBlurbBoosts",
  aiStudio: "packBlurbAiStudio",
};

/** Message keys for the pack names (translated VENDOR_PACK_LABELS). */
const PACK_LABEL_KEYS: Record<VendorPermissionPack, string> = {
  catalog: "packLabelCatalog",
  orders: "packLabelOrders",
  storefront: "packLabelStorefront",
  analytics: "packLabelAnalytics",
  inbox: "packLabelInbox",
  staff: "packLabelStaff",
  discounts: "packLabelDiscounts",
  pos: "packLabelPos",
  payouts: "packLabelPayouts",
  boosts: "packLabelBoosts",
  aiStudio: "packLabelAiStudio",
};

/**
 * Read a plan's packs for the form, via the same rule the server resolves with.
 *
 * A row written before packs existed gated nothing except AI authoring, so it
 * loads as the baseline rather than as "sells nothing" — which would strip
 * access from every vendor on the plan the moment an admin opened and saved the
 * form. An explicitly empty list stays empty: that one IS "sells nothing".
 */
function planPacksFrom(capabilities: unknown): string[] {
  return packsFromPlanCapabilities(
    capabilities as VendorPlanCapabilityInput | null | undefined,
  );
}

const buildPlanSchema = (t: ReturnType<typeof useTranslations>) =>
  z
  .object({
    name: z
      .string()
      .min(2, t("validationNameMin"))
      .max(80, t("validationNameMax")),
    description: z
      .string()
      .max(500, t("validationDescriptionMax"))
      .optional(),
    billingInterval: z.enum(["none", "monthly", "yearly"]),
    price: z.number().min(0, t("validationPriceNegative")),
    commissionRate: z
      .number()
      .min(0, t("validationCommissionNegative"))
      .max(100, t("validationCommissionMax")),
    trialDays: z
      .number()
      .int()
      .min(0, t("validationTrialNegative"))
      .max(365, t("validationTrialMax")),
    featuresText: z.string().optional(),
    maxProducts: z.number().int().min(0).nullable(),
    maxStaff: z.number().int().min(0).nullable(),
    /** The capability packs this plan sells — the entitlement layer. */
    packs: z.array(z.string()),
    isDefault: z.boolean(),
    status: z.enum(["active", "archived"]),
    stripeProductId: z.string().max(120).optional(),
    stripePriceId: z.string().max(120).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.billingInterval !== "none" && data.price <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: t("validationPaidPriceRequired"),
      });
    }
    if (data.billingInterval === "none" && data.trialDays > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["trialDays"],
        message: t("validationFreeNoTrial"),
      });
    }
  });

type PlanFormData = z.infer<ReturnType<typeof buildPlanSchema>>;

const API_BASE = "/api/admin/vendors/plans";

interface VendorPlanFormProps {
  locale: string;
  planId?: string;
}

export function VendorPlanForm({ locale, planId }: VendorPlanFormProps) {
  const t = useTranslations("admin.hc.vendorPlanForm");
  const planSchema = useMemo(() => buildPlanSchema(t), [t]);
  const router = useRouter();
  const basePath = `/${locale}/admin/vendors/plans`;
  // Plans are billed in the store currency, so the price field is prefixed with
  // that symbol rather than an assumed "$".
  const { currency } = useCurrency();
  const currencySymbol = currency?.symbol || currency?.code || "";

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(!!planId);

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: "",
      description: "",
      billingInterval: "none",
      price: 0,
      commissionRate: 0,
      trialDays: 0,
      featuresText: "",
      maxProducts: null,
      maxStaff: null,
      packs: [...COMMISSION_ONLY_PACKS],
      isDefault: false,
      status: "active",
      stripeProductId: "",
      stripePriceId: "",
    },
  });

  useEffect(() => {
    if (!planId) return;

    async function fetchPlan() {
      setIsFetching(true);
      try {
        const res = await fetch(`${API_BASE}/${planId}`);
        const data = await res.json();
        if (data.success && data.data) {
          const plan = data.data;
          form.reset({
            name: plan.name,
            description: plan.description || "",
            billingInterval: plan.billingInterval || "none",
            price: plan.price ?? 0,
            commissionRate: plan.commissionRate ?? 0,
            trialDays: plan.trialDays ?? 0,
            featuresText: Array.isArray(plan.features)
              ? plan.features.join("\n")
              : "",
            maxProducts:
              typeof plan.limits?.products === "number"
                ? plan.limits.products
                : null,
            maxStaff:
              typeof plan.limits?.staff === "number" ? plan.limits.staff : null,
            packs: planPacksFrom(plan.capabilities),
            isDefault: Boolean(plan.isDefault),
            status: plan.status || "active",
            stripeProductId: plan.stripeProductId || "",
            stripePriceId: plan.stripePriceId || "",
          });
        }
      } catch (error) {
        console.error("Failed to fetch plan:", error);
        toast.error(t("toastLoadFailed"));
      } finally {
        setIsFetching(false);
      }
    }

    fetchPlan();
  }, [planId, form, t]);

  const onSubmit = async (data: PlanFormData) => {
    setIsLoading(true);
    try {
      const url = planId ? `${API_BASE}/${planId}` : API_BASE;
      const method = planId ? "PUT" : "POST";

      const features = (data.featuresText || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const payload = {
        name: data.name,
        description: data.description || undefined,
        billingInterval: data.billingInterval,
        price: data.billingInterval === "none" ? 0 : data.price,
        commissionRate: data.commissionRate,
        trialDays:
          data.billingInterval === "none" ? 0 : data.trialDays,
        features,
        limits: {
          products: data.maxProducts,
          staff: data.maxStaff,
        },
        capabilities: {
          packs: data.packs,
          // The plan PUT `$set`s `capabilities` wholesale, which replaces the
          // subdocument — so omitting the deprecated flag here would reset it
          // to its schema default and silently revoke AI from every subscriber
          // of a plan an admin merely renamed. Kept in step with the pack until
          // the last reader of the flag is gone.
          aiAuthoring: data.packs.includes("aiStudio"),
        },
        isDefault: data.isDefault,
        status: data.status,
        stripeProductId: data.stripeProductId || undefined,
        stripePriceId: data.stripePriceId || undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok && result.success) {
        toast.success(
          planId ? t("toastUpdated") : t("toastCreated"),
        );
        router.push(basePath);
      } else {
        toast.error(result.message || t("toastSaveFailed"));
      }
    } catch {
      toast.error(t("toastError"));
    } finally {
      setIsLoading(false);
    }
  };

  const watchedName = useWatch({ control: form.control, name: "name" }) || "";
  const watchedInterval =
    useWatch({ control: form.control, name: "billingInterval" }) || "none";
  const watchedStatus =
    useWatch({ control: form.control, name: "status" }) || "active";
  const watchedDefault =
    useWatch({ control: form.control, name: "isDefault" }) ?? false;
  const watchedPacks =
    useWatch({ control: form.control, name: "packs" }) ?? [];
  // Only a PAID plan can invert against the free baseline; a free plan selling
  // less than commission-only is a legitimate "restricted tier".
  const inversionCount =
    watchedInterval !== "none" &&
    watchedPacks.length < COMMISSION_ONLY_PACKS.length
      ? COMMISSION_ONLY_PACKS.length - watchedPacks.length
      : 0;

  const isFree = watchedInterval === "none";

  // Switching a plan to the free cadence drops its trial, the same way it drops
  // its price — there is no charge left to defer.
  useEffect(() => {
    if (isFree && form.getValues("trialDays") !== 0) {
      form.setValue("trialDays", 0, { shouldValidate: true });
    }
  }, [form, isFree]);

  if (isFetching) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mx-auto w-full max-w-6xl space-y-6"
      >
        <AdminFormStickyHeader
          className="!mx-0 -mt-2 border-b-0 px-0 shadow-none md:px-0"
          title={watchedName || (planId ? t("editPlan") : t("addPlan"))}
          status={
            <>
              <Badge
                variant={watchedStatus === "active" ? "default" : "outline"}
                className="shrink-0 capitalize"
              >
                {watchedStatus === "archived" ? t("statusArchived") : t("statusActive")}
              </Badge>
              {watchedDefault ? (
                <Badge variant="secondary" className="shrink-0">
                  {t("defaultBadge")}
                </Badge>
              ) : null}
            </>
          }
          actions={
            <>
              <Button type="submit" disabled={isLoading} size="sm">
                {isLoading ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                {t("save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.back()}
                className="shrink-0"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("back")}
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card className="gap-2">
              <CardHeader>
                <CardTitle>{t("detailsTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("nameLabel")} *</FormLabel>
                      <FormControl>
                        <Input placeholder={t("namePlaceholder")} {...field} />
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
                      <FormLabel>{t("descriptionLabel")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("descriptionPlaceholder")}
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("charactersCount", { count: field.value?.length || 0, max: 500 })}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="featuresText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("featuresLabel")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t("featuresPlaceholder")}
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("featuresHelp")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="gap-2">
              <CardHeader>
                <CardTitle>{t("pricingTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="billingInterval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("billingLabel")}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full text-start">
                            <SelectValue placeholder={t("billingPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem
                            value="none"
                            description={t("billingFreeDescription")}
                          >
                            {t("billingFree")}
                          </SelectItem>
                          <SelectItem
                            value="monthly"
                            description={t("billingMonthlyDescription")}
                          >
                            {t("billingMonthly")}
                          </SelectItem>
                          <SelectItem
                            value="yearly"
                            description={t("billingYearlyDescription")}
                          >
                            {t("billingYearly")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isFree ? (
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("priceLabel", { currency: currency.code })}</FormLabel>
                        <FormControl>
                          <CurrencyInput
                            currencySymbol={currencySymbol}
                            min={0}
                            step="0.01"
                            {...field}
                            onChange={(event) =>
                              field.onChange(
                                parseFloat(event.target.value) || 0,
                              )
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          {t("priceHelp")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                <FormField
                  control={form.control}
                  name="commissionRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("commissionLabel")} *</FormLabel>
                      <FormControl>
                        <NumberInput
                          min={0}
                          max={100}
                          step="0.01"
                          {...field}
                          whenEmpty={0}
                          onValueChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("commissionHelp")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="trialDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("trialDaysLabel")}</FormLabel>
                      <FormControl>
                        <NumberInput
                          min={0}
                          max={365}
                          step={1}
                          disabled={isFree}
                          {...field}
                          whenEmpty={0}
                          normalize={Math.trunc}
                          onValueChange={field.onChange}
                        />
                      </FormControl>
                      <FormDescription>
                        {isFree
                          ? t("trialFreeHelp")
                          : t("trialPaidHelp")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="gap-2">
              <CardHeader>
                <CardTitle>{t("limitsTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="maxProducts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("maxProductsLabel")}</FormLabel>
                      <FormControl>
                        <NumberInput
                          min={0}
                          step={1}
                          placeholder={t("unlimited")}
                          value={field.value}
                          normalize={Math.trunc}
                          onValueChange={(next) => field.onChange(next ?? null)}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("maxProductsHelp")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxStaff"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("maxStaffLabel")}</FormLabel>
                      <FormControl>
                        <NumberInput
                          min={0}
                          step={1}
                          placeholder={t("unlimited")}
                          value={field.value}
                          normalize={Math.trunc}
                          onValueChange={(next) => field.onChange(next ?? null)}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("maxStaffHelp")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="gap-2">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle>{t("packsTitle")}</CardTitle>
                  <Badge
                    variant="outline"
                    className="border-primary/30 bg-primary/10 text-primary"
                  >
                    {t("packsCount", { selected: watchedPacks.length, total: ALL_VENDOR_PACKS.length })}
                  </Badge>
                </div>
                <FormDescription>
                  {t("packsHelp")}
                </FormDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="packs"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <div className="space-y-2">
                        {ALL_VENDOR_PACKS.map((pack) => {
                          const checked = field.value.includes(pack);
                          return (
                            <button
                              key={pack}
                              type="button"
                              onClick={() =>
                                field.onChange(
                                  checked
                                    ? field.value.filter(
                                        (item) => item !== pack,
                                      )
                                    : [...field.value, pack],
                                )
                              }
                              className={cn(
                                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                                checked
                                  ? "border-primary/35 bg-accent"
                                  : "hover:bg-muted/40",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs",
                                  checked
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-input",
                                )}
                              >
                                {checked && <Check className="size-3.5" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium">
                                  {t(PACK_LABEL_KEYS[pack])}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {t(PACK_BLURBS[pack])}
                                </span>
                              </span>
                              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                                {t("permsCount", { count: VENDOR_PERMISSION_PACKS[pack].length })}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/*
                  A paid plan selling fewer packs than the free commission-only
                  baseline inverts the business model: the vendor paying nothing
                  would hold more than the vendor paying monthly. Flag it before
                  the plan ships rather than after a customer notices.
                */}
                {inversionCount > 0 && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-destructive/35 bg-destructive/5 p-3 text-[13px] leading-relaxed text-destructive">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <p className="text-pretty">
                      {t("inversionWarning", {
                        selected: watchedPacks.length,
                        baseline: COMMISSION_ONLY_PACKS.length,
                      })}
                    </p>
                  </div>
                )}

                {watchedPacks.includes("aiStudio") && (
                  <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-[13px] leading-relaxed text-muted-foreground">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    <p className="text-pretty">
                      {t("aiStudioNotice")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="gap-2">
              <CardHeader>
                <CardTitle>{t("statusTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("statusLabel")}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full text-start">
                            <SelectValue placeholder={t("statusPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem
                            value="active"
                            description={t("statusActiveDescription")}
                          >
                            {t("statusActive")}
                          </SelectItem>
                          <SelectItem
                            value="archived"
                            description={t("statusArchivedDescription")}
                          >
                            {t("statusArchived")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isDefault"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>{t("defaultPlanLabel")}</FormLabel>
                        <FormDescription>
                          {t("defaultPlanHelp")}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card className="gap-2">
              <CardHeader>
                <CardTitle>Stripe</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="stripeProductId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("stripeProductIdLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder="prod_..." {...field} />
                      </FormControl>
                      <FormDescription>
                        {t("stripeProductIdHelp")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stripePriceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("stripePriceIdLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder="price_..." {...field} />
                      </FormControl>
                      <FormDescription>
                        {t("stripePriceIdHelp")}
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
