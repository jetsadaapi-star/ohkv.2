"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/hooks/use-locale-navigation";
import { Crown, Loader2, Mail, MapPin, Phone, StickyNote, Trash2, UserPlus, UserRound, UserRoundCog } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { FormPageTitle, SECTION_CARD, SectionTitle, initialsOf } from "@/components/admin/form-sections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { joinTagText, parseTagText } from "@/lib/customers/tag-text";
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
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { CountrySelect } from "@/components/common/country-multi-select";
import { ThaiAddressFields, isThailand } from "@/components/address/thai-address-fields";
import { USER_ACCOUNT_STATUS } from "@/config/app.config";
import { computeLoyaltyTier, isLoyaltyEnabled } from "@/lib/customers/loyalty";

interface CustomerFormProps {
  locale: string;
  customerId?: string;
  readOnly?: boolean;
  area?: "admin" | "staff";
}

interface CustomerDetailsResponse {
  _id: string;
  loyaltyPoints?: number;
  loyaltyTier?: "bronze" | "silver" | "gold" | "platinum";
  tags?: string[];
  notes?: string;
  acquisitionSource?: string;
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    street?: string;
    apartment?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  };
  userId:
    | string
    | {
        _id: string;
        name?: string;
        email?: string;
        phone?: string;
        image?: string;
        status?: "active" | "inactive" | "banned";
      };
}

interface CustomerFormValues {
  name: string;
  email: string;
  phone: string;
  status: "active" | "inactive" | "banned";
  loyaltyPoints: number;
  acquisitionSource: string;
  tagsInput: string;
  notes: string;
  shippingFirstName: string;
  shippingLastName: string;
  shippingStreet: string;
  shippingApartment: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  shippingPhone: string;
}

const defaultValues: CustomerFormValues = {
  name: "",
  email: "",
  phone: "",
  status: USER_ACCOUNT_STATUS.ACTIVE,
  loyaltyPoints: 0,
  acquisitionSource: "",
  tagsInput: "",
  notes: "",
  shippingFirstName: "",
  shippingLastName: "",
  shippingStreet: "",
  shippingApartment: "",
  shippingCity: "",
  shippingState: "",
  shippingPostalCode: "",
  shippingCountry: "",
  shippingPhone: "",
};

function getUser(profile: CustomerDetailsResponse) {
  if (profile.userId && typeof profile.userId === "object") {
    return profile.userId;
  }

  return null;
}

function buildShippingAddressPayload(form: CustomerFormValues) {
  const address = {
    firstName: form.shippingFirstName.trim(),
    lastName: form.shippingLastName.trim(),
    street: form.shippingStreet.trim(),
    apartment: form.shippingApartment.trim(),
    city: form.shippingCity.trim(),
    state: form.shippingState.trim(),
    postalCode: form.shippingPostalCode.trim(),
    country: form.shippingCountry.trim(),
    phone: form.shippingPhone.trim(),
  };

  const hasAnyAddressValue = Object.values(address).some(Boolean);
  if (!hasAnyAddressValue) return { value: undefined as undefined, error: null as string | null };

  if (!address.street || !address.city || !address.postalCode || !address.country) {
    return {
      value: undefined,
      error: "addressIncomplete",
    };
  }

  return {
    value: {
      ...address,
      firstName: address.firstName || undefined,
      lastName: address.lastName || undefined,
      apartment: address.apartment || undefined,
      state: address.state || undefined,
      phone: address.phone || undefined,
      isDefault: true as const,
      label: "home" as const,
    },
    error: null,
  };
}

export function CustomerForm({
  locale,
  customerId,
  readOnly,
  area = "admin",
}: CustomerFormProps) {
  const t = useTranslations("admin.hc.customerForm");
  const router = useRouter();
  const { confirm } = useConfirmation();
  const basePath = `/${locale}/${area}`;

  const [isFetching, setIsFetching] = useState(!!customerId);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState<CustomerFormValues>(defaultValues);
  const thaiAddress = !form.shippingCountry.trim() || isThailand(form.shippingCountry);

  const pageTitle = useMemo(
    () => (customerId ? t("titleDetails") : t("titleAdd")),
    [customerId, t],
  );

  // The loyalty fields hide with the rest of loyalty (see `isLoyaltyEnabled`).
  const loyaltyEnabled = isLoyaltyEnabled();

  const pageDescription = useMemo(
    () =>
      customerId
        ? loyaltyEnabled
          ? t("descriptionEditLoyalty")
          : t("descriptionEdit")
        : t("descriptionCreate"),
    [customerId, loyaltyEnabled, t],
  );

  useEffect(() => {
    if (!customerId) return;
    let active = true;

    const loadCustomer = async () => {
      try {
        const res = await fetch(`/api/admin/customers/${customerId}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.message || "Failed to load customer");
        }

        if (!active) return;
        const profile: CustomerDetailsResponse = data.data?.profile;
        const user = getUser(profile);

        setForm({
          name: user?.name || "",
          email: user?.email || "",
          phone: user?.phone || "",
          status: user?.status || USER_ACCOUNT_STATUS.ACTIVE,
          loyaltyPoints: profile.loyaltyPoints || 0,
          acquisitionSource: profile.acquisitionSource || "",
          tagsInput: (profile.tags || []).join(", "),
          notes: profile.notes || "",
          shippingFirstName: profile.shippingAddress?.firstName || "",
          shippingLastName: profile.shippingAddress?.lastName || "",
          shippingStreet: profile.shippingAddress?.street || "",
          shippingApartment: profile.shippingAddress?.apartment || "",
          shippingCity: profile.shippingAddress?.city || "",
          shippingState: profile.shippingAddress?.state || "",
          shippingPostalCode: profile.shippingAddress?.postalCode || "",
          shippingCountry: profile.shippingAddress?.country || "",
          shippingPhone: profile.shippingAddress?.phone || "",
        });
      } catch (error) {
        if (!active) return;
        console.error("Failed to fetch customer:", error);
        toast.error(t("loadFailed"));
      } finally {
        if (active) setIsFetching(false);
      }
    };

    void loadCustomer();
    return () => {
      active = false;
    };
  }, [customerId, t]);

  const setField = <K extends keyof CustomerFormValues>(
    key: K,
    value: CustomerFormValues[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Same function the server applies on save, so the preview and the stored
  // tier cannot disagree.
  const derivedTier = computeLoyaltyTier(
    Number.isFinite(form.loyaltyPoints) ? form.loyaltyPoints : 0,
  );
  const tierLabelKeys: Record<string, string> = {
    bronze: "tierBronze",
    silver: "tierSilver",
    gold: "tierGold",
    platinum: "tierPlatinum",
  };
  const derivedTierLabel = tierLabelKeys[derivedTier]
    ? t(tierLabelKeys[derivedTier])
    : derivedTier.charAt(0).toUpperCase() + derivedTier.slice(1);

  const handleSubmit = async () => {
    if (readOnly) return;
    if (!form.name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }

    if (!form.email.trim()) {
      toast.error(t("emailRequired"));
      return;
    }

    const shippingAddressPayload = buildShippingAddressPayload(form);
    if (shippingAddressPayload.error) {
      toast.error(t(shippingAddressPayload.error));
      return;
    }
    if (!customerId && !shippingAddressPayload.value) {
      toast.error(t("addressRequired"));
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        status: form.status,
        loyaltyPoints: Number.isFinite(form.loyaltyPoints)
          ? Math.max(0, Math.floor(form.loyaltyPoints))
          : 0,
        acquisitionSource: form.acquisitionSource.trim() || undefined,
        tags: parseTagText(form.tagsInput),
        notes: form.notes.trim() || undefined,
        shippingAddress: shippingAddressPayload.value,
      };

      const isEdit = Boolean(customerId);
      const res = await fetch(
        isEdit ? `/api/admin/customers/${customerId}` : "/api/admin/customers",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || t("saveFailed"));
      }

      toast.success(
        isEdit
          ? t("updated")
          : t("created"),
      );

      if (isEdit) {
        router.refresh();
      } else {
        router.push(`${basePath}/customers`);
      }
    } catch (error) {
      console.error("Save customer failed:", error);
      toast.error(
        error instanceof Error ? error.message : t("saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!customerId) return;
    if (readOnly) return;

    const shouldDelete = await confirm({
      title: t("deleteTitle"),
      description: t("deleteDescription"),
      confirmText: t("delete"),
      cancelText: t("cancel"),
      variant: "destructive",
    });

    if (!shouldDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || t("deleteFailed"));
      }

      toast.success(t("deleted"));
      router.push(`${basePath}/customers`);
      router.refresh();
    } catch (error) {
      console.error("Delete customer failed:", error);
      toast.error(
        error instanceof Error ? error.message : t("deleteFailed"),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <AdminFormStickyHeader
        className="!mx-0 -mt-2 border-b-0 px-0 shadow-none md:px-0"
        title={
          <FormPageTitle icon={customerId ? <UserRoundCog /> : <UserPlus />} tone="sky">
            {pageTitle}
          </FormPageTitle>
        }
        description={pageDescription}
        actions={
          <>
            {!readOnly && (
              <Button
                size="sm"
                className="rounded-full bg-emerald-600 px-5 text-white hover:bg-emerald-700"
                onClick={handleSubmit}
                disabled={isSaving || isDeleting}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {customerId ? t("saveChanges") : t("createCustomer")}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => router.push(`${basePath}/customers`)}
              disabled={isSaving || isDeleting}
            >
              {t("back")}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className={SECTION_CARD}>
            <CardHeader>
              <SectionTitle icon={<UserRound />} tone="sky">{t("basicTitle")}</SectionTitle>
              <CardDescription>
                {t("basicDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer-name">{t("fullName")} *</Label>
                <Input
                  id="customer-name"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder={t("fullNamePlaceholder")}
                  disabled={readOnly}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-email">{t("email")} *</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  disabled={readOnly}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-phone">{t("phone")}</Label>
                <Input
                  id="customer-phone"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder={t("phonePlaceholder")}
                  disabled={readOnly}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("accountStatus")}</Label>
                <Select
                  value={form.status}
                  disabled={readOnly}
                  onValueChange={(value) =>
                    setField("status", value as CustomerFormValues["status"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectStatus")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={USER_ACCOUNT_STATUS.ACTIVE}>
                      {t("statusActive")}
                    </SelectItem>
                    <SelectItem value={USER_ACCOUNT_STATUS.INACTIVE}>
                      {t("statusInactive")}
                    </SelectItem>
                    <SelectItem value={USER_ACCOUNT_STATUS.BANNED}>
                      {t("statusBanned")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className={SECTION_CARD}>
            <CardHeader>
              <SectionTitle icon={<Crown />} tone="amber">
                {loyaltyEnabled ? t("segmentTitleLoyalty") : t("segmentTitle")}
              </SectionTitle>
              <CardDescription>
                {t("segmentDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loyaltyEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/*
                    The tier is derived from the points, not chosen: the server
                    recomputes it on every award and refund, so a hand-picked one
                    only survived until the customer's next order. Shown live so
                    an adjustment's effect is visible before saving.
                  */}
                  <div className="space-y-2">
                    <Label htmlFor="customer-loyalty-tier">{t("loyaltyTier")}</Label>
                    <Input
                      id="customer-loyalty-tier"
                      value={derivedTierLabel}
                      readOnly
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("loyaltyTierHint")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customer-loyalty-points">
                      {t("loyaltyPoints")}
                    </Label>
                    <NumberInput
                      id="customer-loyalty-points"
                      min={0}
                      step={1}
                      value={form.loyaltyPoints}
                      whenEmpty={0}
                      normalize={Math.trunc}
                      onValueChange={(next) => setField("loyaltyPoints", next ?? 0)}
                      disabled={readOnly}
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("loyaltyPointsHint")}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="customer-acquisition-source">
                  {t("acquisition")}
                </Label>
                <Input
                  id="customer-acquisition-source"
                  value={form.acquisitionSource}
                  onChange={(e) =>
                    setField("acquisitionSource", e.target.value)
                  }
                  placeholder={t("acquisitionPlaceholder")}
                  disabled={readOnly}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-tags">{t("tags")}</Label>
                <TagInput
                  id="customer-tags"
                  value={parseTagText(form.tagsInput)}
                  onValueChange={(tags) => setField("tagsInput", joinTagText(tags))}
                  placeholder={t("tagsPlaceholder")}
                  disabled={readOnly}
                />
                <p className="text-xs text-muted-foreground">
                  {t("tagsHint")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={SECTION_CARD}>
            <CardHeader>
              <SectionTitle icon={<MapPin />} tone="emerald">{t("addressTitle")}</SectionTitle>
              <CardDescription>
                {t("addressDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer-shipping-first-name">{t("firstName")}</Label>
                  <Input
                    id="customer-shipping-first-name"
                    value={form.shippingFirstName}
                    onChange={(e) => setField("shippingFirstName", e.target.value)}
                    placeholder={t("firstNamePlaceholder")}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-shipping-last-name">{t("lastName")}</Label>
                  <Input
                    id="customer-shipping-last-name"
                    value={form.shippingLastName}
                    onChange={(e) => setField("shippingLastName", e.target.value)}
                    placeholder={t("lastNamePlaceholder")}
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-shipping-street">{t("street")}</Label>
                <Input
                  id="customer-shipping-street"
                  value={form.shippingStreet}
                  onChange={(e) => setField("shippingStreet", e.target.value)}
                  placeholder={t("streetPlaceholder")}
                  disabled={readOnly}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-shipping-apartment">{t("apartment")}</Label>
                <Input
                  id="customer-shipping-apartment"
                  value={form.shippingApartment}
                  onChange={(e) => setField("shippingApartment", e.target.value)}
                  placeholder={t("optional")}
                  disabled={readOnly}
                />
              </div>

              {/* The store ships within Thailand: no country yet means Thailand. */}
              {thaiAddress ? (
                <ThaiAddressFields
                  idPrefix="customer-shipping"
                  value={{
                    state: form.shippingState,
                    city: form.shippingCity,
                    postalCode: form.shippingPostalCode,
                  }}
                  onChange={(next) =>
                    setForm((prev) => ({
                      ...prev,
                      shippingCountry: prev.shippingCountry.trim() ? prev.shippingCountry : "Thailand",
                      shippingState: next.state,
                      shippingCity: next.city,
                      shippingPostalCode: next.postalCode,
                    }))
                  }
                  disabled={readOnly}
                />
              ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="customer-shipping-city">{t("city")}</Label>
                  <Input
                    id="customer-shipping-city"
                    value={form.shippingCity}
                    onChange={(e) => setField("shippingCity", e.target.value)}
                    placeholder={t("city")}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-shipping-state">{t("state")}</Label>
                  <Input
                    id="customer-shipping-state"
                    value={form.shippingState}
                    onChange={(e) => setField("shippingState", e.target.value)}
                    placeholder={t("state")}
                    disabled={readOnly}
                  />
                </div>
              </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {thaiAddress ? null : (
                <div className="space-y-2">
                  <Label htmlFor="customer-shipping-postal">{t("postalCode")}</Label>
                  <Input
                    id="customer-shipping-postal"
                    value={form.shippingPostalCode}
                    onChange={(e) => setField("shippingPostalCode", e.target.value)}
                    placeholder={t("postalCode")}
                    disabled={readOnly}
                  />
                </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="customer-shipping-country">{t("country")}</Label>
                  <CountrySelect
                    id="customer-shipping-country"
                    value={form.shippingCountry}
                    onChange={(country) => setField("shippingCountry", country)}
                    placeholder={t("selectCountry")}
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-shipping-phone">{t("phone")}</Label>
                <Input
                  id="customer-shipping-phone"
                  value={form.shippingPhone}
                  onChange={(e) => setField("shippingPhone", e.target.value)}
                  placeholder={t("phonePlaceholder")}
                  disabled={readOnly}
                />
              </div>
            </CardContent>
          </Card>

          <Card className={SECTION_CARD}>
            <CardHeader>
              <SectionTitle icon={<StickyNote />} tone="violet">{t("notesTitle")}</SectionTitle>
              <CardDescription>
                {t("notesDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder={t("notesPlaceholder")}
                rows={6}
                disabled={readOnly}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-[calc(var(--dashboard-header-height,4rem)+5rem)] lg:self-start">
          {/* The customer as the list will show them, filled in as you type. */}
          <Card className="gap-0 overflow-hidden rounded-2xl p-0 shadow-sm">
            <div className="h-16 bg-linear-to-br from-sky-400 to-sky-600" />
            <div className="-mt-8 space-y-3 px-5 pb-5">
              <span className="relative z-10 flex size-16 items-center justify-center rounded-2xl bg-white text-xl font-extrabold text-sky-600 shadow-md ring-4 ring-white dark:bg-card dark:ring-card">
                {initialsOf(form.name) || <UserRound className="size-7" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{form.name.trim() || t("previewNoName")}</p>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("previewTitle")}</p>
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-4 shrink-0" />
                  <span className="truncate">{form.email.trim() || "—"}</span>
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-4 shrink-0" />
                  <span className="truncate">{form.phone.trim() || "—"}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge
                  // As the customers list colours an account: a switched-off one amber.
                  tone={form.status === USER_ACCOUNT_STATUS.BANNED ? "danger" : form.status === USER_ACCOUNT_STATUS.INACTIVE ? "warning" : "success"}
                >
                  {form.status === USER_ACCOUNT_STATUS.BANNED
                    ? t("statusBanned")
                    : form.status === USER_ACCOUNT_STATUS.INACTIVE
                      ? t("statusInactive")
                      : t("statusActive")}
                </StatusBadge>
                {loyaltyEnabled ? (
                  <StatusBadge tone="warning" icon={<Crown />}>
                    {derivedTierLabel}
                  </StatusBadge>
                ) : null}
                {parseTagText(form.tagsInput).map((tag) => (
                  <span key={tag} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {readOnly && (
            <Card className={SECTION_CARD}>
              <CardHeader>
                <CardTitle>{t("accessTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {t("viewOnly")}
                </p>
              </CardContent>
            </Card>
          )}

          {customerId && !readOnly && (
            <Card className={SECTION_CARD}>
              <CardHeader>
                <SectionTitle icon={<Trash2 />} tone="rose" className="text-destructive">{t("dangerZone")}</SectionTitle>
                <CardDescription>
                  {t("dangerDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full rounded-full"
                  onClick={handleDelete}
                  disabled={isSaving || isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  {t("deleteCustomer")}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
