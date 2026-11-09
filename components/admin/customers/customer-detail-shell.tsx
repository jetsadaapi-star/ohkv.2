"use client";

import { parseTagText } from "@/lib/customers/tag-text";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/hooks/use-locale-navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Eye,
  Loader2,
  Trash2,
  TriangleAlert,
  User,
  ShoppingBag,
  Activity,
  Award,
  StickyNote,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast-notification";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { DetailFormSkeleton } from "@/components/admin/detail-form-skeleton";
import { SectionCard } from "./section-card";
import { CustomerDetailHeader } from "./customer-detail-header";
import { AccountEmailButton } from "./account-email-button";
import { ProfileTab } from "./tabs/profile-tab";
import { OrdersTab } from "./tabs/orders-tab";
import { ActivityTab } from "./tabs/activity-tab";
import { LoyaltyTab } from "./tabs/loyalty-tab";
import { NotesTab } from "./tabs/notes-tab";
import { StoreCreditTab } from "./tabs/store-credit-tab";
import {
  defaultCustomerFormValues,
  defaultEmailNotifications,
  type CustomerEmailNotifications,
  type CustomerFormValues,
  type CustomerHeaderData,
  type CustomerStatus,
  type CustomerConsentInfo,
  type LoyaltyTier,
} from "./customer-detail-types";
import { USER_ACCOUNT_STATUS } from "@/config/app.config";
import {
  areCountryValuesEquivalent,
  settleCountryForPolicy,
  soleAllowedCountry,
} from "@/lib/intl/country-availability";
import { useAppSettings, useLoyaltyEnabled } from "@/providers/app-settings-provider";

interface CustomerDetailShellProps {
  locale: string;
  customerId: string;
  readOnly?: boolean;
  area?: "admin" | "staff";
  /** Set for staff viewers — see `CustomerTabProps.emailLocked`. */
  emailLocked?: boolean;
  /**
   * May send this customer a password reset or account invite: an admin, or
   * staff who may edit customers.
   */
  canSendAccountEmail?: boolean;
}

interface CustomerDetailsResponse {
  _id: string;
  loyaltyPoints?: number;
  lifetimePoints?: number;
  loyaltyTier?: LoyaltyTier;
  tags?: string[];
  notes?: string;
  acquisitionSource?: string;
  marketingOptIn?: boolean;
  emailMarketing?: {
    state?: CustomerConsentInfo["state"];
    optInLevel?: CustomerConsentInfo["optInLevel"];
    consentUpdatedAt?: string;
    source?: CustomerConsentInfo["source"];
    sourceOrderId?: string;
    sourceCountry?: string;
    confirmedAt?: string;
  };
  smsMarketing?: {
    state?: CustomerConsentInfo["state"];
    phone?: string;
    consentUpdatedAt?: string;
  };
  marketingConsentHistory?: NonNullable<CustomerConsentInfo["history"]>;
  emailNotifications?: Partial<CustomerEmailNotifications>;
  stats?: CustomerHeaderData["stats"];
  lastActiveAt?: string;
  createdAt?: string;
  /** Guest rows carry identity on the profile itself — there is no user. */
  isGuest?: boolean;
  email?: string;
  name?: string;
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
        status?: CustomerStatus;
      };
}

function getUser(profile: CustomerDetailsResponse) {
  if (profile.userId && typeof profile.userId === "object") {
    return profile.userId;
  }
  return null;
}

function buildShippingAddressPayload(
  form: CustomerFormValues,
  countryAvailability: unknown,
) {
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

  // A store with one country fills that country in by itself, so on its own
  // it is no address. Counting it would demand a street from an admin who only
  // came to change a note on a customer who has none.
  const sole = soleAllowedCountry(countryAvailability);
  const countryFilledByPolicy =
    sole !== undefined && areCountryValuesEquivalent(address.country, sole.value);
  const hasAnyAddressValue = Object.entries(address).some(
    ([key, value]) =>
      Boolean(value) && !(key === "country" && countryFilledByPolicy),
  );
  if (!hasAnyAddressValue)
    return { value: undefined as undefined, error: null as string | null };

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

/** Structural placeholder so the header renders its shape before data arrives. */
const LOADING_HEADER: CustomerHeaderData = {
  name: "",
  email: "",
  status: "active",
  loyaltyTier: "bronze",
  loyaltyPoints: 0,
  lifetimePoints: 0,
  stats: {},
};

export function CustomerDetailShell({
  locale,
  customerId,
  readOnly,
  area = "admin",
  emailLocked,
  canSendAccountEmail = false,
}: CustomerDetailShellProps) {
  const t = useTranslations("admin.hc.customerDetail");
  const router = useRouter();
  const { confirm } = useConfirmation();
  const basePath = `/${locale}/${area}`;

  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [form, setForm] = useState<CustomerFormValues>(defaultCustomerFormValues);
  const [savedForm, setSavedForm] = useState<CustomerFormValues>(
    defaultCustomerFormValues,
  );
  const [header, setHeader] = useState<CustomerHeaderData | null>(null);
  const [consent, setConsent] = useState<CustomerConsentInfo | undefined>();
  /**
   * A guest row has no User behind it, so the name and email fields are not
   * the account's — they are whatever the shopper typed at checkout, and a
   * digital-only order leaves the name blank. Requiring one to save blocked an
   * admin from so much as unsubscribing that customer.
   */
  const [isGuestProfile, setIsGuestProfile] = useState(false);
  const [lifetimePoints, setLifetimePoints] = useState(0);
  /** The saved country the store's country policy replaced on load, if any. */
  const [replacedShippingCountry, setReplacedShippingCountry] = useState("");

  const { countryAvailability } = useAppSettings();
  // Read when the customer loads rather than a dependency of that load: a
  // settings refresh must never reload the record over unsaved edits.
  const countryAvailabilityRef = useRef(countryAvailability);
  useEffect(() => {
    countryAvailabilityRef.current = countryAvailability;
  }, [countryAvailability]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm],
  );
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    let active = true;

    const loadCustomer = async () => {
      try {
        const res = await fetch(`/api/admin/customers/${customerId}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.message || "load_failed");
        }

        if (!active) return;
        const profile: CustomerDetailsResponse = data.data?.profile;
        const accountEmail: CustomerHeaderData["accountEmail"] =
          data.data?.accountEmail ?? null;
        const user = getUser(profile);
        // An editable form opens on the country the locked picker will hold,
        // so the record doesn't read as changed the moment it opens. A
        // read-only view reports what is saved.
        const savedCountry = profile.shippingAddress?.country || "";
        const country = readOnly
          ? { value: savedCountry, replaced: "" }
          : settleCountryForPolicy(
              savedCountry,
              countryAvailabilityRef.current,
            );

        const loaded: CustomerFormValues = {
          // Guest profiles have no user behind them; the identity the guest
          // typed at checkout lives on the profile itself.
          name: user?.name || profile.name || "",
          email: user?.email || profile.email || "",
          phone: user?.phone || "",
          image: user?.image || "",
          status: user?.status || USER_ACCOUNT_STATUS.ACTIVE,
          loyaltyPoints: profile.loyaltyPoints || 0,
          loyaltyTier: profile.loyaltyTier || "bronze",
          acquisitionSource: profile.acquisitionSource || "",
          tagsInput: (profile.tags || []).join(", "),
          notes: profile.notes || "",
          marketingOptIn: profile.marketingOptIn ?? false,
          emailNotifications: {
            ...defaultEmailNotifications,
            ...(profile.emailNotifications || {}),
          },
          shippingFirstName: profile.shippingAddress?.firstName || "",
          shippingLastName: profile.shippingAddress?.lastName || "",
          shippingStreet: profile.shippingAddress?.street || "",
          shippingApartment: profile.shippingAddress?.apartment || "",
          shippingCity: profile.shippingAddress?.city || "",
          shippingState: profile.shippingAddress?.state || "",
          shippingPostalCode: profile.shippingAddress?.postalCode || "",
          shippingCountry: country.value,
          shippingPhone: profile.shippingAddress?.phone || "",
        };

        setForm(loaded);
        setSavedForm(loaded);
        setReplacedShippingCountry(country.replaced);
        setIsGuestProfile(Boolean(profile.isGuest) || !user);
        // Rows written before consent became a record carry only the boolean;
        // read them as the state they mean rather than as "never asked".
        setConsent({
          state:
            profile.emailMarketing?.state ??
            (profile.marketingOptIn ? "subscribed" : "not_subscribed"),
          optInLevel: profile.emailMarketing?.optInLevel,
          consentUpdatedAt: profile.emailMarketing?.consentUpdatedAt,
          source: profile.emailMarketing?.source,
          sourceOrderId: profile.emailMarketing?.sourceOrderId,
          sourceCountry: profile.emailMarketing?.sourceCountry,
          confirmedAt: profile.emailMarketing?.confirmedAt,
          history: profile.marketingConsentHistory || [],
          sms: {
            state: profile.smsMarketing?.state ?? "not_subscribed",
            phone: profile.smsMarketing?.phone,
            consentUpdatedAt: profile.smsMarketing?.consentUpdatedAt,
          },
        });
        setLifetimePoints(profile.lifetimePoints || 0);
        setHeader({
          name: loaded.name,
          email: loaded.email,
          image: user?.image,
          status: loaded.status,
          loyaltyTier: loaded.loyaltyTier,
          loyaltyPoints: loaded.loyaltyPoints,
          lifetimePoints: profile.lifetimePoints || 0,
          stats: profile.stats || {},
          lastActiveAt: profile.lastActiveAt,
          createdAt: profile.createdAt,
          accountEmail,
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
    // `t` is stable for the page's language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, readOnly]);

  // Warn on hard navigation / tab close while there are unsaved changes.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const setField = useCallback(
    <K extends keyof CustomerFormValues>(
      key: K,
      value: CustomerFormValues[K],
    ) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const confirmDiscard = useCallback(async () => {
    if (!isDirtyRef.current) return true;
    return confirm({
      title: t("discardTitle"),
      description: t("discardDescription"),
      confirmText: t("discard"),
      cancelText: t("keepEditing"),
      variant: "destructive",
    });
  }, [confirm, t]);

  const navigateBack = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    router.push(`${basePath}/customers`);
  }, [basePath, confirmDiscard, router]);

  const handleSubmit = useCallback(async () => {
    if (readOnly) return;
    if (!isGuestProfile && !form.name.trim()) {
      toast.error(t("nameRequired"));
      setActiveTab("profile");
      return;
    }
    if (!isGuestProfile && !form.email.trim()) {
      toast.error(t("emailRequired"));
      setActiveTab("profile");
      return;
    }

    const shippingAddressPayload = buildShippingAddressPayload(
      form,
      countryAvailability,
    );
    if (shippingAddressPayload.error) {
      toast.error(t(shippingAddressPayload.error));
      setActiveTab("profile");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        // Name, email, image, phone and status belong to the User record. A
        // guest row has none, the API ignores them for one, and sending the
        // empty strings the form holds for a guest fails validation — which
        // is what used to make a nameless guest unsaveable.
        ...(isGuestProfile
          ? {}
          : {
              name: form.name.trim(),
              email: form.email.trim(),
              image: form.image.trim(),
              phone: form.phone.trim() || undefined,
              status: form.status,
            }),
        loyaltyPoints: Number.isFinite(form.loyaltyPoints)
          ? Math.max(0, Math.floor(form.loyaltyPoints))
          : 0,
        loyaltyTier: form.loyaltyTier,
        acquisitionSource: form.acquisitionSource.trim() || undefined,
        tags: parseTagText(form.tagsInput),
        notes: form.notes.trim() || undefined,
        marketingOptIn: form.marketingOptIn,
        emailNotifications: form.emailNotifications,
        shippingAddress: shippingAddressPayload.value,
      };

      const res = await fetch(`/api/admin/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || t("saveFailed"));
      }

      toast.success(t("saved"));
      setSavedForm(form);
      setReplacedShippingCountry("");
      setHeader((prev) =>
        prev
          ? {
              ...prev,
              name: form.name,
              email: form.email,
              image: form.image || undefined,
              status: form.status,
              loyaltyTier: form.loyaltyTier,
              loyaltyPoints: form.loyaltyPoints,
            }
          : prev,
      );
      router.refresh();
    } catch (error) {
      console.error("Save customer failed:", error);
      toast.error(error instanceof Error ? error.message : t("saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }, [countryAvailability, customerId, form, isGuestProfile, readOnly, router, t]);

  const handleDelete = useCallback(async () => {
    if (!customerId || readOnly) return;

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
      setSavedForm(form); // suppress the unsaved-changes guard on navigation
      router.push(`${basePath}/customers`);
      router.refresh();
    } catch (error) {
      console.error("Delete customer failed:", error);
      toast.error(error instanceof Error ? error.message : t("deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  }, [basePath, confirm, customerId, form, readOnly, router, t]);

  // The Loyalty tab hides with the rest of loyalty (see `useLoyaltyEnabled`).
  const loyaltyEnabled = useLoyaltyEnabled();

  const tabs = [
    { value: "profile", label: t("tabProfile"), icon: User },
    { value: "orders", label: t("tabOrders"), icon: ShoppingBag, count: header?.stats?.totalOrders },
    { value: "activity", label: t("tabActivity"), icon: Activity },
    ...(loyaltyEnabled ? [{ value: "loyalty", label: t("tabLoyalty"), icon: Award }] : []),
    { value: "store-credit", label: t("tabStoreCredit"), icon: Wallet },
    { value: "notes", label: t("tabNotes"), icon: StickyNote },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-10">
      {/* Top bar: where we are, and saving */}
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-3 bg-background/85 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 shrink-0 rounded-xl"
          onClick={navigateBack}
          disabled={isSaving || isDeleting}
          aria-label={t("back")}
          title={t("back")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <nav className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          <button
            type="button"
            onClick={navigateBack}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("breadcrumb")}
          </button>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
          <span className="truncate font-semibold">{header?.name || (isFetching ? "…" : t("unknownCustomer"))}</span>
        </nav>
        {readOnly ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Eye className="size-3.5" />
            {t("viewOnly")}
          </span>
        ) : (
          <div className="flex items-center gap-2">
            {isDirty ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
                {t("unsaved")}
              </span>
            ) : !isFetching ? (
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                {t("allSaved")}
              </span>
            ) : null}
            <Button
              size="sm"
              className="h-9 rounded-xl px-4"
              onClick={handleSubmit}
              disabled={isFetching || isSaving || isDeleting || !isDirty}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("saveChanges")}
            </Button>
          </div>
        )}
      </div>

      <CustomerDetailHeader
        data={header ?? LOADING_HEADER}
        phone={form.phone}
        loading={isFetching}
        actions={
          canSendAccountEmail && header?.accountEmail && header.email ? (
            <AccountEmailButton
              customerId={customerId}
              kind={header.accountEmail}
              email={header.email}
            />
          ) : null
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-5">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl border bg-muted/50 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="h-9 flex-none gap-1.5 rounded-xl border-0 px-3.5 text-sm font-medium text-muted-foreground shadow-none transition-all hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {typeof tab.count === "number" && tab.count > 0 ? (
                <span className="rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
                  {tab.count}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="profile">
          {isFetching ? (
            <DetailFormSkeleton />
          ) : (
            <ProfileTab
              form={form}
              setField={setField}
              readOnly={readOnly}
              consent={consent}
              emailLocked={emailLocked}
              replacedShippingCountry={replacedShippingCountry}
            />
          )}
        </TabsContent>

        <TabsContent value="orders">
          <OrdersTab
            customerId={customerId}
            basePath={basePath}
            stats={header?.stats ?? {}}
          />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTab
            customerId={customerId}
            acquisitionSource={form.acquisitionSource}
            lastActiveAt={header?.lastActiveAt}
            createdAt={header?.createdAt}
            stats={header?.stats ?? {}}
          />
        </TabsContent>

        {loyaltyEnabled && (
          <TabsContent value="loyalty">
            {isFetching ? (
              <DetailFormSkeleton />
            ) : (
              <LoyaltyTab
                form={form}
                setField={setField}
                readOnly={readOnly}
                lifetimePoints={lifetimePoints}
              />
            )}
          </TabsContent>
        )}

        <TabsContent value="store-credit">
          <StoreCreditTab customerId={customerId} />
        </TabsContent>

        <TabsContent value="notes" className="space-y-6">
          {isFetching ? (
            <DetailFormSkeleton cards={1} />
          ) : (
            <NotesTab form={form} setField={setField} readOnly={readOnly} />
          )}

          {!isFetching && !readOnly && (
            <SectionCard
              icon={TriangleAlert}
              tone="rose"
              title={<span className="text-destructive">{t("dangerZone")}</span>}
              description={t("dangerDescription")}
              className="border-destructive/30"
            >
              <Button
                type="button"
                variant="destructive"
                className="rounded-xl"
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
            </SectionCard>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}
