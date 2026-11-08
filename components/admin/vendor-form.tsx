"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/hooks/use-locale-navigation";
import { useTranslations } from "next-intl";
import { BadgeCheck, ClipboardList, Loader2, ShieldCheck, Store, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MediaUploader } from "@/components/ui/media-uploader";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { FormPageTitle, SECTION_CARD, SectionTitle, initialsOf } from "@/components/admin/form-sections";
import { StatusBadge } from "@/components/ui/status-badge";
import { USER_ACCOUNT_STATUS, VENDOR_STATUS } from "@/config/app.config";
import { DEFAULT_VENDOR_COMMISSION_RATE } from "@/lib/orders/order-settings";
import { slugify } from "@/lib/strings";
import { DistrictSelect } from "@/components/zones/district-select";

interface VendorFormProps {
  vendorId?: string;
}

interface VendorFormValues {
  storeName: string;
  district: string;
  slug: string;
  description: string;
  logo: string;
  banner: string;
  commission: number;
  status: string;
  userStatus: "active" | "inactive" | "banned";
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
}

const defaultValues: VendorFormValues = {
  storeName: "",
  district: "",
  slug: "",
  description: "",
  logo: "",
  banner: "",
  commission: DEFAULT_VENDOR_COMMISSION_RATE,
  status: VENDOR_STATUS.PENDING,
  userStatus: USER_ACCOUNT_STATUS.ACTIVE,
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
};

const VENDOR_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp";
const VENDOR_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export function VendorForm({ vendorId }: VendorFormProps) {
  const router = useRouter();
  const t = useTranslations();
  const th = useTranslations("admin.hc.vendorForm");
  const { confirm } = useConfirmation();

  const [isFetching, setIsFetching] = useState(Boolean(vendorId));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState<VendorFormValues>(defaultValues);
  // Read-only answers to admin-defined custom onboarding fields (self-describing
  // {label, value}), captured when the vendor applied.
  const [onboardingResponses, setOnboardingResponses] = useState<
    Array<{ key: string; label: string; value: string | boolean }>
  >([]);

  const isEdit = Boolean(vendorId);
  const pageTitle = useMemo(
    () => (isEdit ? th("titleEdit") : th("titleCreate")),
    [isEdit, th],
  );

  const fetchVendor = useCallback(async () => {
    if (!vendorId) return;
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || th("fetchFailed"));
      }
      const vendor = data.data;
      setForm({
        storeName: vendor.storeName || "",
        district: vendor.district || "",
        slug: vendor.slug || "",
        description: vendor.description || "",
        logo: vendor.logo || "",
        banner: vendor.banner || "",
        commission:
          typeof vendor.commission === "number"
            ? vendor.commission
            : DEFAULT_VENDOR_COMMISSION_RATE,
        status: vendor.status || VENDOR_STATUS.PENDING,
        userStatus: vendor.user?.status || USER_ACCOUNT_STATUS.ACTIVE,
        ownerName: vendor.user?.name || "",
        ownerEmail: vendor.user?.email || "",
        ownerPhone: vendor.user?.phone || "",
      });
      const respObj =
        vendor.onboardingResponses &&
        typeof vendor.onboardingResponses === "object"
          ? (vendor.onboardingResponses as Record<
              string,
              { label?: string; value?: string | boolean }
            >)
          : {};
      setOnboardingResponses(
        Object.entries(respObj).map(([key, v]) => ({
          key,
          label: v?.label || key,
          value: v?.value ?? "",
        })),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : th("fetchFailed"),
      );
    } finally {
      setIsFetching(false);
    }
  }, [vendorId, th]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchVendor();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchVendor]);

  useEffect(() => {
    if (vendorId) return;
    let active = true;
    void fetch("/api/admin/settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        const rate = payload?.data?.orders?.commission?.vendorRate;
        if (active && typeof rate === "number" && Number.isFinite(rate)) {
          setForm((current) => ({ ...current, commission: rate }));
        }
      })
      .catch(() => {
        // The API applies the configured default if settings cannot be loaded.
      });
    return () => {
      active = false;
    };
  }, [vendorId]);

  const setField = <K extends keyof VendorFormValues>(
    key: K,
    value: VendorFormValues[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.storeName.trim()) return toast.error(th("storeNameRequired"));
    if (!form.district) {
      return toast.error(t("zones.districtRequired"));
    }
    if (!form.ownerName.trim()) return toast.error(th("ownerNameRequired"));
    if (!form.ownerEmail.trim()) return toast.error(th("ownerEmailRequired"));

    setIsSaving(true);
    try {
      const payload = {
        storeName: form.storeName.trim(),
        district: form.district,
        slug: slugify(form.slug || form.storeName),
        description: form.description.trim() || undefined,
        logo: form.logo.trim() || undefined,
        banner: form.banner.trim() || undefined,
        commission: Math.max(0, Math.min(100, Number(form.commission) || 0)),
        status: form.status,
        userStatus: form.userStatus,
        ownerName: form.ownerName.trim(),
        ownerEmail: form.ownerEmail.trim().toLowerCase(),
        ownerPhone: form.ownerPhone.trim() || undefined,
      };

      const res = await fetch(
        isEdit ? `/api/admin/vendors/${vendorId}` : "/api/admin/vendors",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || th("saveFailed"));
      }
      toast.success(
        isEdit ? th("updated") : th("created"),
      );
      if (isEdit) {
        router.refresh();
      } else {
        router.push("/admin/vendors");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : th("saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!vendorId) return;
    const ok = await confirm({
      title: th("deleteTitle"),
      description: th("deleteDescription"),
      confirmText: th("deleteConfirm"),
      variant: "destructive",
    });
    if (!ok) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || th("deleteFailed"));
      }
      toast.success(th("deleted"));
      router.push("/admin/vendors");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : th("deleteFailed"),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const vendorStatusLabel =
    {
      [VENDOR_STATUS.PENDING]: th("statusPending"),
      [VENDOR_STATUS.PAYMENT_REQUIRED]: th("statusPaymentRequired"),
      [VENDOR_STATUS.APPROVED]: th("statusApproved"),
      [VENDOR_STATUS.SUSPENDED]: th("statusSuspended"),
      [VENDOR_STATUS.REJECTED]: th("statusRejected"),
    }[form.status] ?? form.status;

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <AdminFormStickyHeader
        className="!mx-0 -mt-2 border-b-0 px-0 shadow-none md:px-0"
        title={
          <FormPageTitle icon={<Store />} tone="emerald">
            {pageTitle}
          </FormPageTitle>
        }
        description={
          isEdit ? th("descriptionEdit") : th("descriptionCreate")
        }
        actions={
          <>
            <Button
              size="sm"
              className="rounded-full bg-emerald-600 px-5 text-white hover:bg-emerald-700"
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {isEdit ? th("saveChanges") : th("createVendor")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => router.push("/admin/vendors")}
            >
              {th("backToVendors")}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className={SECTION_CARD}>
            <CardHeader>
              <SectionTitle icon={<Store />} tone="emerald">{th("storeProfileTitle")}</SectionTitle>
              <CardDescription>{th("storeProfileDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">{th("storeNameLabel")}</Label>
                <Input
                  id="storeName"
                  value={form.storeName}
                  onChange={(e) => setField("storeName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">{t("zones.districtField")} *</Label>
                <DistrictSelect
                  id="district"
                  value={form.district}
                  onValueChange={(code) => setField("district", code)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("zones.districtHint")}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">{th("storeSlugLabel")}</Label>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(e) => setField("slug", e.target.value)}
                  placeholder={th("storeSlugPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{th("descriptionLabel")}</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{th("storeLogo")}</Label>
                  <MediaUploader
                    value={
                      form.logo
                        ? [
                            {
                              _id: "logo",
                              url: form.logo,
                              type: "image",
                              mimeType: "image/*",
                              alt: th("logoAlt", { name: form.storeName || th("storeFallback") }),
                              position: 0,
                            },
                          ]
                        : []
                    }
                    onChange={(items) => {
                      const logo = items.find((item) => item.type === "image");
                      setField("logo", logo?.url || "");
                    }}
                    maxFiles={1}
                    acceptTypes={["image"]}
                    accept={VENDOR_IMAGE_ACCEPT}
                    allowedFileExtensions={VENDOR_IMAGE_EXTENSIONS}
                    uploadTitle={th("uploadTitle")}
                    uploadDescription={th("uploadDescription")}
                    sizeGuide={th("logoSizeGuide")}
                    mediaGridClassName="grid-cols-1 md:grid-cols-1 max-w-32"
                    previewAspectRatio="1 / 1"
                    previewFit="contain"
                    previewTileClassName="bg-slate-50"
                    showCoverBadge={false}
                    coverHint={false}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{th("storeBanner")}</Label>
                  <MediaUploader
                    value={
                      form.banner
                        ? [
                            {
                              _id: "banner",
                              url: form.banner,
                              type: "image",
                              mimeType: "image/*",
                              alt: th("bannerAlt", { name: form.storeName || th("storeFallback") }),
                              position: 0,
                            },
                          ]
                        : []
                    }
                    onChange={(items) => {
                      const banner = items.find(
                        (item) => item.type === "image",
                      );
                      setField("banner", banner?.url || "");
                    }}
                    maxFiles={1}
                    acceptTypes={["image"]}
                    accept={VENDOR_IMAGE_ACCEPT}
                    allowedFileExtensions={VENDOR_IMAGE_EXTENSIONS}
                    uploadTitle={th("uploadTitle")}
                    uploadDescription={th("uploadDescription")}
                    sizeGuide={th("bannerSizeGuide")}
                    mediaGridClassName="grid-cols-1 md:grid-cols-1"
                    previewAspectRatio="1360 / 314"
                    previewFit="contain"
                    previewTileClassName="bg-slate-50"
                    showCoverBadge={false}
                    coverHint={false}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={SECTION_CARD}>
            <CardHeader>
              <SectionTitle icon={<ShieldCheck />} tone="sky">{th("accessTitle")}</SectionTitle>
              <CardDescription>
                {th("accessDescription")}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className={SECTION_CARD}>
            <CardHeader>
              <SectionTitle icon={<UserRound />} tone="violet">{th("ownerAccountTitle")}</SectionTitle>
              <CardDescription>
                {th("ownerAccountDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ownerName">{th("ownerNameLabel")}</Label>
                <Input
                  id="ownerName"
                  value={form.ownerName}
                  onChange={(e) => setField("ownerName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerEmail">{th("ownerEmailLabel")}</Label>
                <Input
                  id="ownerEmail"
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) => setField("ownerEmail", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerPhone">{th("ownerPhoneLabel")}</Label>
                <Input
                  id="ownerPhone"
                  value={form.ownerPhone}
                  onChange={(e) => setField("ownerPhone", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {isEdit && onboardingResponses.length > 0 ? (
            <Card className={SECTION_CARD}>
              <CardHeader>
                <SectionTitle icon={<ClipboardList />} tone="amber">{th("onboardingTitle")}</SectionTitle>
                <CardDescription>
                  {th("onboardingDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2">
                  {onboardingResponses.map((r) => (
                    <div key={r.key} className="flex gap-3 text-sm">
                      <dt className="w-40 shrink-0 text-muted-foreground">
                        {r.label}
                      </dt>
                      <dd className="min-w-0 flex-1 break-words">
                        {typeof r.value === "boolean"
                          ? r.value
                            ? th("yes")
                            : th("no")
                          : r.value || "—"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {/* The shop as its storefront header will look, filled in as you type. */}
          <Card className="gap-0 overflow-hidden rounded-2xl p-0 shadow-sm">
            <div className="relative h-20 bg-linear-to-br from-emerald-400 to-teal-600">
              {form.banner ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.banner} alt="" className="absolute inset-0 size-full object-cover" />
              ) : null}
            </div>
            <div className="-mt-8 space-y-3 px-5 pb-5">
              <span className="relative z-10 flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-white text-xl font-extrabold text-emerald-600 shadow-md ring-4 ring-white dark:bg-card dark:ring-card">
                {form.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logo} alt="" className="size-full object-contain" />
                ) : (
                  initialsOf(form.storeName) || <Store className="size-7" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{form.storeName.trim() || th("previewNoName")}</p>
                <p className="truncate text-xs text-muted-foreground">/{form.slug.trim() || "…"}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge status={form.status}>{vendorStatusLabel}</StatusBadge>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
                  {th("previewCommission", { rate: form.commission })}
                </span>
              </div>
            </div>
          </Card>

          <Card className={SECTION_CARD}>
            <CardHeader>
              <SectionTitle icon={<BadgeCheck />} tone="indigo">{th("statusTitle")}</SectionTitle>
              <CardDescription>{th("statusDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{th("vendorStatus")}</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setField("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VENDOR_STATUS.PENDING}>
                      {th("statusPending")}
                    </SelectItem>
                    <SelectItem
                      value={VENDOR_STATUS.PAYMENT_REQUIRED}
                      disabled={form.status !== VENDOR_STATUS.PAYMENT_REQUIRED}
                    >
                      {th("statusPaymentRequired")}
                    </SelectItem>
                    <SelectItem value={VENDOR_STATUS.APPROVED}>
                      {th("statusApproved")}
                    </SelectItem>
                    <SelectItem value={VENDOR_STATUS.SUSPENDED}>
                      {th("statusSuspended")}
                    </SelectItem>
                    <SelectItem value={VENDOR_STATUS.REJECTED}>
                      {th("statusRejected")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{th("ownerAccountStatus")}</Label>
                <Select
                  value={form.userStatus}
                  onValueChange={(value) =>
                    setField(
                      "userStatus",
                      value as VendorFormValues["userStatus"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={USER_ACCOUNT_STATUS.ACTIVE}>
                      {th("userActive")}
                    </SelectItem>
                    <SelectItem value={USER_ACCOUNT_STATUS.INACTIVE}>
                      {th("userInactive")}
                    </SelectItem>
                    <SelectItem value={USER_ACCOUNT_STATUS.BANNED}>
                      {th("userBanned")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission">{th("commissionLabel")}</Label>
                <NumberInput
                  id="commission"
                  min={0}
                  max={100}
                  value={form.commission}
                  whenEmpty={0}
                  onValueChange={(next) => setField("commission", next ?? 0)}
                />
              </div>
            </CardContent>
          </Card>

          {isEdit ? (
            <Card className={SECTION_CARD}>
              <CardHeader>
                <SectionTitle icon={<Trash2 />} tone="rose" className="text-destructive">{th("dangerZone")}</SectionTitle>
                <CardDescription>{th("dangerZoneDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  className="w-full rounded-full"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  {th("deleteTitle")}
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
