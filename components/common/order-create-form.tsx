"use client";

import { useRouter } from "@/hooks/use-locale-navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDollarSign,
  Loader2,
  MapPin,
  Package,
  Plus,
  Save,
  Search,
  StickyNote,
  Tag,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { AppImage } from "@/components/ui/app-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { joinTagText, parseTagText } from "@/lib/customers/tag-text";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast-notification";
import { useCurrency } from "@/providers/currency-provider";
import { useAppSettings } from "@/providers/app-settings-provider";
import { CountrySelect } from "@/components/common/country-multi-select";
import { ThaiAddressFields, isThailand } from "@/components/address/thai-address-fields";
import {
  defaultCountryForAddressForms,
  isCountryAllowed,
} from "@/lib/intl/country-availability";
import { cn } from "@/lib/utils";
import { useApplyOnChange } from "@/hooks/use-apply-on-change";

type ProductVariant = {
  _id?: string;
  name?: string;
  sku?: string;
  price?: number;
  stock?: number;
  image?: string;
};

type ProductSummary = {
  _id: string;
  name?: string;
  title?: string;
  sku?: string;
  price?: number;
  stock?: number;
  images?: string[];
  variants?: ProductVariant[];
};

type ProductOption = {
  key: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku: string;
  price: number;
  stock: number;
  image?: string;
};

type OrderLine = ProductOption & {
  quantity: number;
};

type Customer = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  shippingAddress?: Partial<ShippingAddress>;
};

type ShippingAddress = {
  firstName: string;
  lastName: string;
  street: string;
  apartment: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
};

type CreateCustomerFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  shippingStreet: string;
  shippingApartment: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  shippingPhone: string;
  tagsInput: string;
  notes: string;
};

type OrderCreateFormVariant = "admin" | "vendor" | "staff";

interface OrderCreateFormProps {
  locale: string;
  /**
   * Which dashboard hosts the form. Drives the API namespace
   * (`/api/admin/*` vs `/api/vendor/*`) and post-save redirects.
   */
  variant: OrderCreateFormVariant;
  /**
   * Whether the address needs a postcode: the store's checkout requires one,
   * or a carrier is connected (`isPostcodeRequired`). The server takes an order
   * without one, so a store that ships by hand and hid the field can too.
   */
  postalCodeRequired: boolean;
  canCreateCustomer?: boolean;
}

/** What a delivery address still lacks, as a toast, or null when nothing does. */
function missingAddressMessage(
  address: { street: string; city: string; postalCode: string; country: string },
  postalCodeRequired: boolean,
  t: ReturnType<typeof useTranslations>,
  locale: string,
): string | null {
  const checks: Array<[part: string, isMissing: boolean]> = [
    [t("addressPartStreet"), !address.street.trim()],
    [t("addressPartCity"), !address.city.trim()],
    [t("addressPartPostalCode"), postalCodeRequired && !address.postalCode.trim()],
    [t("addressPartCountry"), !address.country.trim()],
  ];
  const missing = checks.filter(([, isMissing]) => isMissing).map(([part]) => part);
  if (missing.length === 0) return null;
  const parts = new Intl.ListFormat(locale, { type: "conjunction" }).format(missing);
  return t("missingAddress", { parts });
}

function emptyAddress(country: string): ShippingAddress {
  return {
    firstName: "",
    lastName: "",
    street: "",
    apartment: "",
    city: "",
    state: "",
    postalCode: "",
    country,
    phone: "",
  };
}

function emptyCreateCustomerForm(country: string): CreateCustomerFormValues {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    shippingStreet: "",
    shippingApartment: "",
    shippingCity: "",
    shippingState: "",
    shippingPostalCode: "",
    shippingCountry: country,
    shippingPhone: "",
    tagsInput: "",
    notes: "",
  };
}

function readApiMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  return String(record.message || record.error || fallback);
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function mapCustomerProfileToCustomer(
  profile: unknown,
  fallbackName: string,
): Customer | null {
  const record = asRecord(profile);
  if (!record) return null;
  const user = asRecord(record.user) || asRecord(record.userId);
  const userId =
    user?._id ||
    (typeof record.userId === "string" ? record.userId : undefined);
  const id = String(userId || "");
  if (!id) return null;

  return {
    id,
    name: String(user?.name || fallbackName),
    email: String(user?.email || ""),
    phone: String(user?.phone || ""),
    shippingAddress: (() => {
      const address = asRecord(record.shippingAddress);
      if (!address) return undefined;
      return {
        firstName: String(address.firstName || ""),
        lastName: String(address.lastName || ""),
        street: String(address.street || ""),
        apartment: String(address.apartment || ""),
        city: String(address.city || ""),
        state: String(address.state || ""),
        postalCode: String(address.postalCode || ""),
        country: String(address.country || ""),
        phone: String(address.phone || ""),
      };
    })(),
  };
}

function getProductImage(product: ProductSummary, variant?: ProductVariant) {
  return variant?.image || product.images?.[0];
}

function variantLabel(variant?: ProductVariant) {
  if (!variant?.name || variant.name === "Default Title") return undefined;
  return variant.name;
}

function flattenProductOptions(
  products: ProductSummary[],
  untitledName: string,
): ProductOption[] {
  return products.flatMap((product) => {
    const name = product.title || product.name || untitledName;
    const variants = product.variants || [];

    if (variants.length > 0) {
      return variants.map((variant) => ({
        key: `${product._id}:${variant._id || variant.name || "variant"}`,
        productId: product._id,
        variantId: variant._id,
        productName: name,
        variantName: variantLabel(variant),
        sku: variant.sku || product.sku || "",
        price: Number(variant.price ?? product.price ?? 0),
        stock: Number(variant.stock ?? 0),
        image: getProductImage(product, variant),
      }));
    }

    return [
      {
        key: `${product._id}:default`,
        productId: product._id,
        productName: name,
        sku: product.sku || "",
        price: Number(product.price ?? 0),
        stock: Number(product.stock ?? 0),
        image: getProductImage(product),
      },
    ];
  });
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

export function OrderCreateForm({
  locale,
  variant,
  postalCodeRequired,
  canCreateCustomer = true,
}: OrderCreateFormProps) {
  const t = useTranslations("admin.hc.orderCreateForm");
  const router = useRouter();
  const { formatPrice, currency } = useCurrency();
  const { countryAvailability, shippingOriginCountry } = useAppSettings();
  const defaultCountry = useMemo(() => {
    return defaultCountryForAddressForms(
      countryAvailability,
      shippingOriginCountry,
    );
  }, [countryAvailability, shippingOriginCountry]);
  const apiBase = `/api/${variant === "staff" ? "admin" : variant}`;
  const ordersPath = `/${locale}/${variant}/orders`;
  const tc = useTranslations("admin.hc.orderCreate");

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [selectedProductKeys, setSelectedProductKeys] = useState<string[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  const [customerQuery, setCustomerQuery] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [createCustomerDialogOpen, setCreateCustomerDialogOpen] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [createCustomerForm, setCreateCustomerForm] = useState<CreateCustomerFormValues>(
    () => emptyCreateCustomerForm(defaultCountry),
  );

  const [lines, setLines] = useState<OrderLine[]>([]);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>(() =>
    emptyAddress(defaultCountry),
  );
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [discount, setDiscount] = useState("0");
  const [shippingCost, setShippingCost] = useState("0");
  // "auto" taxes each line at its product's rate (Settings → Tax Settings),
  // as a checkout does; "custom" is one typed rate for the whole order.
  const [taxMode, setTaxMode] = useState<"auto" | "custom">("auto");
  const [taxRate, setTaxRate] = useState("0");
  const [paymentDueLater, setPaymentDueLater] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const productOptions = useMemo(
    () => flattenProductOptions(products, t("untitledProduct")),
    [products, t],
  );
  const subtotal = useMemo(
    () => lines.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [lines],
  );
  const numericDiscount = Math.min(Number(discount) || 0, subtotal);
  const numericShipping = Number(shippingCost) || 0;
  const numericTaxRate = Number(taxRate) || 0;
  const taxableSubtotal = Math.max(subtotal - numericDiscount, 0);
  const typedTax = Math.round(taxableSubtotal * (numericTaxRate / 100) * 100) / 100;
  const preview = useOrderPreview(apiBase, {
    items: lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
    })),
    discount: numericDiscount,
    shippingCost: numericShipping,
    ...(taxMode === "custom" ? { taxRate: numericTaxRate } : {}),
  });
  // The server's figures are what the save charges; until they arrive a typed
  // rate is worked out here, and automatic tax shows as pending.
  const tax = preview.totals?.tax ?? (taxMode === "custom" ? typedTax : null);
  const total =
    preview.totals?.total ??
    Math.round((taxableSubtotal + numericShipping + (tax ?? 0)) * 100) / 100;
  const hasDraftChanges =
    lines.length > 0 ||
    Boolean(selectedCustomer) ||
    notes.trim().length > 0 ||
    tags.trim().length > 0;

  // Typing in either picker fires a request per debounce window, and those can
  // come back out of order — a slow response for "sh" landing after "shirt"
  // would leave the list showing results for a query the admin has moved past.
  // Each fetch claims a ticket and only the newest one may touch state.
  const productRequestRef = useRef(0);
  const customerRequestRef = useRef(0);

  useApplyOnChange([countryAvailability, defaultCountry], () => {
    setShippingAddress((current) =>
      current.country.trim() &&
      isCountryAllowed(current.country, countryAvailability)
        ? current
        : { ...current, country: defaultCountry },
    );
    setCreateCustomerForm((current) =>
      current.shippingCountry.trim() &&
      isCountryAllowed(current.shippingCountry, countryAvailability)
        ? current
        : { ...current, shippingCountry: defaultCountry },
    );
  });

  const fetchProducts = useCallback(async (search: string) => {
    const requestId = ++productRequestRef.current;
    setIsLoadingProducts(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "50",
        status: "active",
        sortOrder: "desc",
      });
      if (search.trim()) params.set("search", search.trim());
      const path = variant === "staff" ? `${apiBase}/orders/form-options?resource=products&` : `${apiBase}/products?`;
      const response = await fetch(`${path}${params.toString()}`);
      const data = await response.json();
      if (requestId !== productRequestRef.current) return;
      if (!response.ok || data.success === false) {
        throw new Error(readApiMessage(data, t("somethingWentWrong")));
      }
      setProducts(data.data?.data || []);
    } catch (error) {
      if (requestId !== productRequestRef.current) return;
      toast.error(error instanceof Error ? error.message : t("productsLoadFailed"));
    } finally {
      if (requestId === productRequestRef.current) setIsLoadingProducts(false);
    }
  }, [apiBase, variant, t]);

  const fetchCustomers = useCallback(async (search: string) => {
    const requestId = ++customerRequestRef.current;
    setIsLoadingCustomers(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "8",
        sortOrder: "desc",
      });
      if (search.trim()) params.set("search", search.trim());
      const path = variant === "staff" ? `${apiBase}/orders/form-options?resource=customers&` : `${apiBase}/customers?`;
      const response = await fetch(`${path}${params.toString()}`);
      const data = await response.json();
      if (requestId !== customerRequestRef.current) return;
      if (!response.ok || data.success === false) {
        throw new Error(readApiMessage(data, t("somethingWentWrong")));
      }

      const customerProfiles: unknown[] = Array.isArray(data.data?.data)
        ? data.data.data
        : [];
      const nextCustomers = customerProfiles
        .map((profile: unknown) =>
          mapCustomerProfileToCustomer(profile, t("customerFallbackName")),
        )
        .filter((customer: Customer | null): customer is Customer =>
          Boolean(customer?.id),
        );
      setCustomers(nextCustomers);
    } catch (error) {
      if (requestId !== customerRequestRef.current) return;
      toast.error(error instanceof Error ? error.message : t("customersLoadFailed"));
    } finally {
      if (requestId === customerRequestRef.current) setIsLoadingCustomers(false);
    }
  }, [apiBase, variant, t]);

  useEffect(() => {
    if (!productDialogOpen) return;
    const timer = window.setTimeout(() => {
      void fetchProducts(productSearch);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [fetchProducts, productDialogOpen, productSearch]);

  useEffect(() => {
    if (!customerMenuOpen) return;
    const timer = window.setTimeout(() => {
      void fetchCustomers(customerQuery);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerMenuOpen, customerQuery, fetchCustomers]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerQuery(customer.name);
    setCustomerMenuOpen(false);
    const name = splitName(customer.name);
    setShippingAddress((current) => {
      const customerCountry = customer.shippingAddress?.country || "";
      return {
        ...current,
      firstName:
        current.firstName || customer.shippingAddress?.firstName || name.firstName,
      lastName:
        current.lastName || customer.shippingAddress?.lastName || name.lastName,
      street: current.street || customer.shippingAddress?.street || "",
      apartment: current.apartment || customer.shippingAddress?.apartment || "",
      city: current.city || customer.shippingAddress?.city || "",
      state: current.state || customer.shippingAddress?.state || "",
      postalCode: current.postalCode || customer.shippingAddress?.postalCode || "",
      country:
        customerCountry.trim() &&
        isCountryAllowed(customerCountry, countryAvailability)
        ? customerCountry
        : current.country.trim() &&
            isCountryAllowed(current.country, countryAvailability)
          ? current.country
          : defaultCountry,
      phone:
        current.phone ||
        customer.shippingAddress?.phone ||
        customer.phone ||
        "",
      };
    });
  };

  const setCreateCustomerField = <K extends keyof CreateCustomerFormValues>(
    key: K,
    value: CreateCustomerFormValues[K],
  ) => {
    setCreateCustomerForm((current) => ({ ...current, [key]: value }));
  };

  const openCreateCustomerModal = () => {
    const trimmedQuery = customerQuery.trim();
    const fromQuery = splitName(
      trimmedQuery.includes("@") ? "" : trimmedQuery,
    );
    setCreateCustomerForm((current) => ({
      ...current,
      firstName: current.firstName || fromQuery.firstName,
      lastName: current.lastName || fromQuery.lastName,
      email:
        current.email || (trimmedQuery.includes("@") ? trimmedQuery : ""),
    }));
    setCustomerMenuOpen(false);
    setCreateCustomerDialogOpen(true);
  };

  const handleCreateCustomer = async () => {
    const firstName = createCustomerForm.firstName.trim();
    const lastName = createCustomerForm.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const email = createCustomerForm.email.trim().toLowerCase();
    const phone = createCustomerForm.phone.trim();
    const shippingStreet = createCustomerForm.shippingStreet.trim();
    const shippingCity = createCustomerForm.shippingCity.trim();
    const shippingPostalCode = createCustomerForm.shippingPostalCode.trim();
    const shippingCountry = createCustomerForm.shippingCountry.trim();
    const notesValue = createCustomerForm.notes.trim();
    const tags = parseTagText(createCustomerForm.tagsInput);
    const shippingAddress = {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      street: shippingStreet,
      apartment: createCustomerForm.shippingApartment.trim() || undefined,
      city: shippingCity,
      state: createCustomerForm.shippingState.trim() || undefined,
      postalCode: shippingPostalCode,
      country: shippingCountry,
      phone: (createCustomerForm.shippingPhone.trim() || phone || undefined),
      isDefault: true,
      label: "home",
    };

    if (!fullName) {
      toast.error(t("nameRequired"));
      return;
    }
    if (!email) {
      toast.error(t("emailRequired"));
      return;
    }
    const addressProblem = missingAddressMessage(
      {
        street: shippingStreet,
        city: shippingCity,
        postalCode: shippingPostalCode,
        country: shippingCountry,
      },
      postalCodeRequired,
      t,
      locale,
    );
    if (addressProblem) {
      toast.error(addressProblem);
      return;
    }

    setIsCreatingCustomer(true);
    try {
      const response = await fetch(`${apiBase}/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          email,
          phone: phone || undefined,
          status: "active",
          tags,
          notes: notesValue || undefined,
          shippingAddress,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success === false) {
        throw new Error(readApiMessage(data, t("somethingWentWrong")));
      }

      const createdCustomer = mapCustomerProfileToCustomer(
        data?.data?.profile,
        t("customerFallbackName"),
      ) || {
        id: "",
        name: fullName,
        email,
        phone,
      };
      if (!createdCustomer.id) {
        throw new Error(t("customerCreatedNotSelected"));
      }

      setCustomers((current) => [
        createdCustomer,
        ...current.filter((item) => item.id !== createdCustomer.id),
      ]);
      handleSelectCustomer(createdCustomer);
      setCreateCustomerForm(emptyCreateCustomerForm(defaultCountry));
      setCreateCustomerDialogOpen(false);
      toast.success(t("customerCreated"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("customerCreateFailed"),
      );
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const handleAddSelectedProducts = () => {
    const selected = productOptions.filter((option) =>
      selectedProductKeys.includes(option.key),
    );

    setLines((current) => {
      const next = [...current];
      for (const option of selected) {
        const existing = next.find((line) => line.key === option.key);
        if (existing) {
          existing.quantity += 1;
        } else {
          next.push({ ...option, quantity: 1 });
        }
      }
      return next;
    });

    setSelectedProductKeys([]);
    setProductDialogOpen(false);
  };

  const updateLineQuantity = (key: string, quantity: number) => {
    setLines((current) =>
      current.map((line) =>
        line.key === key
          ? { ...line, quantity: Math.max(1, Math.min(999, quantity || 1)) }
          : line,
      ),
    );
  };

  const removeLine = (key: string) => {
    setLines((current) => current.filter((line) => line.key !== key));
  };

  const updateAddress = (field: keyof ShippingAddress, value: string) => {
    setShippingAddress((current) => ({ ...current, [field]: value }));
  };

  const saveOrder = async (markAsPaid: boolean) => {
    if (!selectedCustomer) {
      toast.error(t("selectCustomerFirst"));
      return;
    }
    if (lines.length === 0) {
      toast.error(t("addAtLeastOneProduct"));
      return;
    }
    const addressProblem = missingAddressMessage(
      shippingAddress,
      postalCodeRequired,
      t,
      locale,
    );
    if (addressProblem) {
      toast.error(addressProblem);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${apiBase}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          items: lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.quantity,
          })),
          shippingAddress,
          paymentMethod: markAsPaid ? "manual" : "manual_pending",
          paymentStatus: markAsPaid ? "paid" : "pending",
          shippingCost: numericShipping,
          discount: numericDiscount,
          // Left out, the server taxes each line at its product's rate.
          ...(taxMode === "custom" ? { taxRate: numericTaxRate } : {}),
          notes: notes.trim() || undefined,
          tags: parseTagText(tags),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success === false) {
        throw new Error(readApiMessage(data, t("somethingWentWrong")));
      }
      toast.success(markAsPaid ? t("orderMarkedPaid") : t("draftOrderSaved"));
      router.push(`${ordersPath}/${data.data?._id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("orderCreateFailed"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void saveOrder(false);
      }}
      className={cn(
        "mx-auto max-w-6xl space-y-5 pb-24 md:pb-0",
        // One card language: rounded, soft, tinted headers.
        "[&_[data-slot=card]]:gap-0 [&_[data-slot=card]]:overflow-hidden [&_[data-slot=card]]:rounded-2xl [&_[data-slot=card]]:py-0 [&_[data-slot=card]]:shadow-sm",
        "[&_[data-slot=card-header]]:border-b [&_[data-slot=card-header]]:bg-muted/30 [&_[data-slot=card-header]]:py-4 [&_[data-slot=card-content]]:py-4",
      )}
    >
      {/* Sticky bar: the three steps, the running total, and both ways to save. */}
      <div className="sticky top-[var(--dashboard-header-height,4rem)] z-30 overflow-hidden rounded-2xl border bg-background/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-full"
            onClick={() => router.push(ordersPath)}
            disabled={isSaving}
            aria-label={t("back")}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              {tc("breadcrumb")}
              <ChevronRight className="size-3" />
              {t("createOrderTitle")}
            </p>
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-bold sm:text-lg">{t("createOrderTitle")}</h1>
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                {hasDraftChanges ? t("unsavedDraftOrder") : t("draftBadge")}
              </span>
            </div>
          </div>
          <div className="hidden text-end sm:block">
            <p className="text-[11px] text-muted-foreground">{t("total")}</p>
            <p className="text-lg font-extrabold tabular-nums">{formatPrice(total)}</p>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={isSaving || lines.length === 0}
              title={tc("savePendingHint")}
            >
              <Save className="size-4" />
              {tc("savePending")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-full bg-emerald-600 px-4 text-white hover:bg-emerald-700"
              onClick={() => void saveOrder(true)}
              disabled={isSaving || lines.length === 0}
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CircleDollarSign className="size-4" />}
              {t("markAsPaid")}
            </Button>
          </div>
        </div>
        {/* Steps */}
        <ol className="flex gap-1 overflow-x-auto border-t px-3 py-2 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
          {[
            { label: tc("stepProducts"), done: lines.length > 0, icon: Package },
            { label: tc("stepCustomer"), done: Boolean(selectedCustomer), icon: UserRound },
            { label: tc("stepAddress"), done: Boolean(selectedCustomer) && !missingAddressMessage(shippingAddress, postalCodeRequired, t, locale), icon: MapPin },
          ].map((step, index) => (
            <li
              key={step.label}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                step.done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-muted text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[10px]",
                  step.done ? "bg-emerald-500 text-white" : "bg-background",
                )}
              >
                {step.done ? <Check className="size-3" strokeWidth={3} /> : index + 1}
              </span>
              {step.label}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <Card className="gap-2">
            <CardHeader>
              <StepTitle step={1} icon={Package} title={t("productsTitle")} done={lines.length > 0} />
              <CardAction className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setProductDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  {t("addProduct")}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {lines.length > 0 ? (
                lines.map((line) => (
                  <div
                    key={line.key}
                    className="grid gap-3 rounded-xl border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_92px_120px_32px] sm:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                        <AppImage
                          src={line.image}
                          alt={line.productName}
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {line.productName}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          {line.variantName ? (
                            <Badge variant="secondary" className="rounded-sm px-1.5">
                              {line.variantName}
                            </Badge>
                          ) : null}
                          {line.sku ? <span>{line.sku}</span> : null}
                        </div>
                      </div>
                    </div>
                    <NumberInput
                      min={1}
                      max={999}
                      step={1}
                      value={line.quantity}
                      whenEmpty="keep"
                      normalize={Math.trunc}
                      onValueChange={(next) => {
                        if (next !== undefined) updateLineQuantity(line.key, next);
                      }}
                      aria-label={t("quantityFor", { name: line.productName })}
                    />
                    <div className="text-right text-sm">
                      <div className="font-medium">
                        {formatPrice(line.price * line.quantity)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("priceEach", { price: formatPrice(line.price) })}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeLine(line.key)}
                      aria-label={t("removeProduct", { name: line.productName })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <button
                  type="button"
                  onClick={() => setProductDialogOpen(true)}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center text-muted-foreground transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-700 dark:hover:bg-emerald-500/5"
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                    <Plus className="size-6" />
                  </span>
                  <span className="text-sm font-semibold">{t("addProduct")}</span>
                  <span className="text-xs">{t("noProductsAdded")}</span>
                </button>
              )}
            </CardContent>
          </Card>

          <Card className="gap-2">
            <CardHeader>
              <StepTitle icon={CircleDollarSign} title={t("paymentTitle")} />
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-xl border">
                <PaymentRow label={t("subtotal")} detail={t("itemsCount", { count: lines.length })} value={formatPrice(subtotal)} />
                <PaymentInputRow label={t("addDiscount")} value={discount} onChange={setDiscount} prefix={currency.symbol} />
                <PaymentInputRow label={t("addShipping")} value={shippingCost} onChange={setShippingCost} prefix={currency.symbol} />
                <PaymentTaxRow
                  mode={taxMode}
                  onModeChange={setTaxMode}
                  rate={taxRate}
                  onRateChange={setTaxRate}
                  value={
                    tax !== null
                      ? formatPrice(tax)
                      : lines.length > 0 && preview.loading
                        ? t("calculating")
                        : "-"
                  }
                />
                {preview.error ? (
                  <p className="px-4 pb-2 text-xs text-destructive">{preview.error}</p>
                ) : null}
                <PaymentRow label={t("total")} value={formatPrice(total)} strong />
                <div className="flex items-center gap-2 border-t px-4 py-3 text-sm">
                  <Checkbox
                    checked={paymentDueLater}
                    onCheckedChange={setPaymentDueLater}
                  />
                  <span>{t("paymentDueLater")}</span>
                </div>
              </div>
            </CardContent>
            <div className="flex flex-col gap-3 px-6 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {lines.length > 0
                  ? t("paymentHintReady")
                  : t("paymentHintEmpty")}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full bg-emerald-600 px-4 text-white hover:bg-emerald-700"
                  onClick={() => void saveOrder(!paymentDueLater)}
                  disabled={isSaving || lines.length === 0}
                >
                  {paymentDueLater ? t("saveOrder") : t("markAsPaid")}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <SideCard title={t("customer")} icon={UserRound} step={2} done={Boolean(selectedCustomer)}>
            <div className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={customerQuery}
                  onFocus={() => setCustomerMenuOpen(true)}
                  onChange={(event) => {
                    setCustomerQuery(event.target.value);
                    setCustomerMenuOpen(true);
                    setSelectedCustomer(null);
                  }}
                  placeholder={canCreateCustomer ? t("searchOrCreateCustomer") : t("searchCustomers")}
                  className="pl-9"
                />
              </div>
              {customerMenuOpen ? (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-md border bg-popover shadow-lg">
                  {canCreateCustomer && <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={openCreateCustomerModal}
                    className="flex w-full items-center gap-2 bg-muted px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <Plus className="h-4 w-4" />
                    {t("createNewCustomer")}
                  </button>}
                  <div className="max-h-64 overflow-auto py-1">
                    {isLoadingCustomers ? (
                      <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("loadingCustomers")}
                      </div>
                    ) : customers.length > 0 ? (
                      customers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSelectCustomer(customer)}
                          className="block w-full px-3 py-2 text-left hover:bg-accent"
                        >
                          <div className="text-sm font-medium">{customer.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {customer.email}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-3 text-sm text-muted-foreground">
                        {t("noCustomersFound")}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            {selectedCustomer ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-sm ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/30">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 font-bold text-white">
                  {selectedCustomer.name?.charAt(0).toUpperCase() || "?"}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{selectedCustomer.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{selectedCustomer.email}</div>
                </div>
              </div>
            ) : null}
          </SideCard>

          {!selectedCustomer ? (
            <p className="rounded-2xl border border-dashed px-4 py-3 text-xs text-muted-foreground">
              <MapPin className="me-1 inline size-3.5" />
              {tc("addressAfterCustomer")}
            </p>
          ) : null}
          {selectedCustomer ? (
            <SideCard
              title={t("shippingAddress")}
              icon={MapPin}
              step={3}
              done={!missingAddressMessage(shippingAddress, postalCodeRequired, t, locale)}
            >
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={t("firstName")} value={shippingAddress.firstName} onChange={(event) => updateAddress("firstName", event.target.value)} />
                <Input placeholder={t("lastName")} value={shippingAddress.lastName} onChange={(event) => updateAddress("lastName", event.target.value)} />
              </div>
              <Input placeholder={t("streetAddress")} value={shippingAddress.street} onChange={(event) => updateAddress("street", event.target.value)} />
              <Input placeholder={t("apartment")} value={shippingAddress.apartment} onChange={(event) => updateAddress("apartment", event.target.value)} />
              {isThailand(shippingAddress.country) ? (
                <ThaiAddressFields
                  idPrefix="order-shipping"
                  columns={1}
                  value={{
                    state: shippingAddress.state,
                    city: shippingAddress.city,
                    postalCode: shippingAddress.postalCode,
                  }}
                  onChange={(next) => setShippingAddress((current) => ({ ...current, ...next }))}
                />
              ) : (
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder={t("city")} value={shippingAddress.city} onChange={(event) => updateAddress("city", event.target.value)} />
                <Input placeholder={t("state")} value={shippingAddress.state} onChange={(event) => updateAddress("state", event.target.value)} />
              </div>
              )}
              <div className={isThailand(shippingAddress.country) ? undefined : "grid grid-cols-2 gap-2"}>
                {isThailand(shippingAddress.country) ? null : (
                <Input placeholder={t("postalCode")} value={shippingAddress.postalCode} onChange={(event) => updateAddress("postalCode", event.target.value)} />
                )}
                <CountrySelect
                  value={shippingAddress.country}
                  onChange={(country) => updateAddress("country", country)}
                  placeholder={t("selectCountry")}
                />
              </div>
              <Input placeholder={t("phone")} value={shippingAddress.phone} onChange={(event) => updateAddress("phone", event.target.value)} />
            </SideCard>
          ) : null}

          <SideCard title={t("notes")} icon={StickyNote}>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("noNotes")}
              className="min-h-20 resize-none rounded-xl"
            />
          </SideCard>

          <SideCard title={t("tags")} icon={Tag}>
            <TagInput
              value={parseTagText(tags)}
              onValueChange={(next) => setTags(joinTagText(next))}
              placeholder={t("tagsPlaceholder")}
              aria-label={t("tags")}
            />
          </SideCard>
        </div>
      </div>

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-4 py-4">
            <DialogTitle className="text-base">{t("selectProducts")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 border-b p-4">
            <div className="grid gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder={t("searchProducts")}
                  className="pl-9"
                />
              </div>

            </div>

          </div>
          <div className="grid grid-cols-[1fr_120px_120px] border-b px-4 py-2 text-xs text-muted-foreground">
            <span>{t("colProduct")}</span>
            <span className="text-right">{t("colAvailable")}</span>
            <span className="text-right">{t("colPrice")}</span>
          </div>
          <div className="h-[390px] overflow-auto">
            {isLoadingProducts ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("loadingProducts")}
              </div>
            ) : productOptions.length > 0 ? (
              productOptions.map((option) => {
                const checked = selectedProductKeys.includes(option.key);
                return (
                  <div
                    key={option.key}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setSelectedProductKeys((current) =>
                        checked
                          ? current.filter((key) => key !== option.key)
                          : [...current, option.key],
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setSelectedProductKeys((current) =>
                        checked
                          ? current.filter((key) => key !== option.key)
                          : [...current, option.key],
                      );
                    }}
                    className={cn(
                      "grid w-full cursor-pointer grid-cols-[1fr_120px_120px] items-center border-b px-4 py-2 text-left outline-none hover:bg-accent focus-visible:bg-accent",
                      checked && "bg-accent",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Checkbox checked={checked} className="pointer-events-none" />
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted">
                        <AppImage
                          src={option.image}
                          alt={option.productName}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {option.productName}
                        </span>
                        {option.variantName ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {option.variantName}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="text-right text-sm">{option.stock}</span>
                    <span className="text-right text-sm">
                      {formatPrice(option.price)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t("noProductsFound")}
              </div>
            )}
          </div>
          <DialogFooter className="border-t p-4">
            <div className="mr-auto rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {t("variantsSelected", { count: selectedProductKeys.length })}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setProductDialogOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleAddSelectedProducts}
              disabled={selectedProductKeys.length === 0}
            >
              {t("add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createCustomerDialogOpen}
        onOpenChange={(open) => {
          if (isCreatingCustomer) return;
          setCreateCustomerDialogOpen(open);
          if (!open) {
            setCreateCustomerForm(emptyCreateCustomerForm(defaultCountry));
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{t("newCustomer")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-customer-first-name">{t("firstName")}</Label>
                  <Input
                    id="new-customer-first-name"
                    value={createCustomerForm.firstName}
                    onChange={(event) =>
                      setCreateCustomerField("firstName", event.target.value)
                    }
                    placeholder={t("firstName")}
                    disabled={isCreatingCustomer}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-customer-last-name">{t("lastName")}</Label>
                  <Input
                    id="new-customer-last-name"
                    value={createCustomerForm.lastName}
                    onChange={(event) =>
                      setCreateCustomerField("lastName", event.target.value)
                    }
                    placeholder={t("lastName")}
                    disabled={isCreatingCustomer}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-customer-email">{t("email")}</Label>
                <Input
                  id="new-customer-email"
                  type="email"
                  value={createCustomerForm.email}
                  onChange={(event) =>
                    setCreateCustomerField("email", event.target.value)
                  }
                  placeholder="customer@example.com"
                  disabled={isCreatingCustomer}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-customer-phone">{t("phoneNumber")}</Label>
                <Input
                  id="new-customer-phone"
                  value={createCustomerForm.phone}
                  onChange={(event) =>
                    setCreateCustomerField("phone", event.target.value)
                  }
                  placeholder={t("phonePlaceholder")}
                  disabled={isCreatingCustomer}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-customer-shipping-street">{t("shippingStreet")}</Label>
                <Input
                  id="new-customer-shipping-street"
                  value={createCustomerForm.shippingStreet}
                  onChange={(event) =>
                    setCreateCustomerField("shippingStreet", event.target.value)
                  }
                  placeholder={t("streetPlaceholder")}
                  disabled={isCreatingCustomer}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-customer-shipping-apartment">{t("apartment")}</Label>
                <Input
                  id="new-customer-shipping-apartment"
                  value={createCustomerForm.shippingApartment}
                  onChange={(event) =>
                    setCreateCustomerField("shippingApartment", event.target.value)
                  }
                  placeholder={t("optional")}
                  disabled={isCreatingCustomer}
                />
              </div>
            </div>
            <div className="space-y-4">
              {isThailand(createCustomerForm.shippingCountry) ? (
                <ThaiAddressFields
                  modal
                  idPrefix="new-customer-shipping"
                  columns={1}
                  value={{
                    state: createCustomerForm.shippingState,
                    city: createCustomerForm.shippingCity,
                    postalCode: createCustomerForm.shippingPostalCode,
                  }}
                  onChange={(next) =>
                    setCreateCustomerForm((current) => ({
                      ...current,
                      shippingState: next.state,
                      shippingCity: next.city,
                      shippingPostalCode: next.postalCode,
                    }))
                  }
                  disabled={isCreatingCustomer}
                />
              ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-customer-shipping-city">{t("shippingCity")}</Label>
                  <Input
                    id="new-customer-shipping-city"
                    value={createCustomerForm.shippingCity}
                    onChange={(event) =>
                      setCreateCustomerField("shippingCity", event.target.value)
                    }
                    placeholder={t("city")}
                    disabled={isCreatingCustomer}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-customer-shipping-state">{t("shippingState")}</Label>
                  <Input
                    id="new-customer-shipping-state"
                    value={createCustomerForm.shippingState}
                    onChange={(event) =>
                      setCreateCustomerField("shippingState", event.target.value)
                    }
                    placeholder={t("state")}
                    disabled={isCreatingCustomer}
                  />
                </div>
              </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {isThailand(createCustomerForm.shippingCountry) ? null : (
                <div className="space-y-2">
                  <Label htmlFor="new-customer-shipping-postal">{t("postalCode")}</Label>
                  <Input
                    id="new-customer-shipping-postal"
                    value={createCustomerForm.shippingPostalCode}
                    onChange={(event) =>
                      setCreateCustomerField("shippingPostalCode", event.target.value)
                    }
                    placeholder={postalCodeRequired ? t("postalCode") : t("optional")}
                    disabled={isCreatingCustomer}
                  />
                </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new-customer-shipping-country">{t("country")}</Label>
                  <CountrySelect
                    id="new-customer-shipping-country"
                    value={createCustomerForm.shippingCountry}
                    onChange={(country) =>
                      setCreateCustomerField("shippingCountry", country)
                    }
                    placeholder={t("selectCountry")}
                    searchPlaceholder={t("searchCountries")}
                    disabled={isCreatingCustomer}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-customer-shipping-phone">{t("shippingPhone")}</Label>
                <Input
                  id="new-customer-shipping-phone"
                  value={createCustomerForm.shippingPhone}
                  onChange={(event) =>
                    setCreateCustomerField("shippingPhone", event.target.value)
                  }
                  placeholder={t("phonePlaceholder")}
                  disabled={isCreatingCustomer}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-customer-tags">{t("tags")}</Label>
                <TagInput
                  id="new-customer-tags"
                  value={parseTagText(createCustomerForm.tagsInput)}
                  onValueChange={(tags) =>
                    setCreateCustomerField("tagsInput", joinTagText(tags))
                  }
                  placeholder={t("tagsPlaceholder")}
                  disabled={isCreatingCustomer}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-customer-notes">{t("notes")}</Label>
                <Textarea
                  id="new-customer-notes"
                  value={createCustomerForm.notes}
                  onChange={(event) =>
                    setCreateCustomerField("notes", event.target.value)
                  }
                  placeholder={t("privateNotes")}
                  className="min-h-28"
                  disabled={isCreatingCustomer}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateCustomerDialogOpen(false)}
              disabled={isCreatingCustomer}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateCustomer()}
              disabled={isCreatingCustomer}
            >
              {isCreatingCustomer ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("createCustomer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phones: the total and save actions stay at the bottom. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur md:hidden">
        <div className="me-auto">
          <p className="text-[10px] text-muted-foreground">{t("total")}</p>
          <p className="text-base font-extrabold tabular-nums">{formatPrice(total)}</p>
        </div>
        <Button type="submit" variant="outline" className="rounded-full" disabled={isSaving || lines.length === 0}>
          {tc("savePendingShort")}
        </Button>
        <Button
          type="button"
          className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => void saveOrder(true)}
          disabled={isSaving || lines.length === 0}
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CircleDollarSign className="size-4" />}
          {tc("paidShort")}
        </Button>
      </div>
    </form>
  );
}

/** A card title with its step number (or a tick once done) and an icon. */
function StepTitle({
  step,
  icon: Icon,
  title,
  done,
}: {
  step?: number;
  icon: LucideIcon;
  title: string;
  done?: boolean;
}) {
  const tc = useTranslations("admin.hc.orderCreate");
  return (
    <CardTitle className="flex items-center gap-2.5 text-sm">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-xl",
          done ? "bg-emerald-500 text-white" : "bg-background text-muted-foreground ring-1 ring-border",
        )}
      >
        {done ? <Check className="size-4" strokeWidth={3} /> : <Icon className="size-4" />}
      </span>
      <span className="flex flex-col">
        {step ? <span className="text-[10px] font-semibold text-muted-foreground">{tc("step", { n: step })}</span> : null}
        {title}
      </span>
    </CardTitle>
  );
}

function SideCard({
  title,
  icon,
  step,
  done,
  children,
}: {
  title: string;
  icon: LucideIcon;
  step?: number;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="gap-2">
      <CardHeader>
        <StepTitle step={step} icon={icon} title={title} done={done} />
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function PaymentRow({
  label,
  detail,
  value,
  strong,
}: {
  label: string;
  detail?: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_120px_120px] items-center gap-3 px-4 py-2 text-sm">
      <span className={strong ? "font-semibold" : undefined}>{label}</span>
      <span className="text-muted-foreground">{detail || "-"}</span>
      <span className={cn("text-right", strong && "font-semibold")}>{value}</span>
    </div>
  );
}

type OrderPreviewRequest = {
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
  discount: number;
  shippingCost: number;
  taxRate?: number;
};

type OrderPreviewTotals = {
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  total: number;
  automaticTax: boolean;
};

/**
 * The order's totals as the save will charge them (`…/orders/preview`): tax
 * by each product's class needs the store's tax settings, which only the
 * server reads. Asked again, a moment after the lines or money fields stop
 * changing; an answer for an older form is dropped.
 */
function useOrderPreview(apiBase: string, request: OrderPreviewRequest) {
  const t = useTranslations("admin.hc.orderCreateForm");
  const key = JSON.stringify(request);
  const empty = request.items.length === 0;
  const [answer, setAnswer] = useState<{
    key: string;
    totals: OrderPreviewTotals | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (empty) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${apiBase}/orders/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: key,
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || data?.success === false) throw new Error(readApiMessage(data, t("somethingWentWrong")));
        setAnswer({ key, totals: data.data as OrderPreviewTotals, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        setAnswer({
          key,
          totals: null,
          error: error instanceof Error ? error.message : t("taxCalcFailed"),
        });
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [apiBase, key, empty, t]);

  const current = !empty && answer?.key === key ? answer : null;
  return {
    totals: current?.totals ?? null,
    error: current?.error ?? null,
    loading: !empty && !current,
  };
}

/**
 * Tax: automatic (each product's class, as a checkout charges it) or one
 * typed rate for the whole order.
 */
function PaymentTaxRow({
  mode,
  onModeChange,
  rate,
  onRateChange,
  value,
}: {
  mode: "auto" | "custom";
  onModeChange: (mode: "auto" | "custom") => void;
  rate: string;
  onRateChange: (value: string) => void;
  value: string;
}) {
  const t = useTranslations("admin.hc.orderCreateForm");
  return (
    <div className="grid grid-cols-[1fr_120px_120px] items-center gap-3 px-4 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span>{t("tax")}</span>
        <Select value={mode} onValueChange={(next) => onModeChange(next as "auto" | "custom")}>
          <SelectTrigger className="h-8 w-auto min-w-36" aria-label={t("taxModeLabel")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">{t("taxModeAuto")}</SelectItem>
            <SelectItem value="custom">{t("taxModeCustom")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === "custom" ? (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            max={100}
            value={rate}
            onChange={(event) => onRateChange(event.target.value)}
            className="h-8 text-right"
            aria-label={t("taxRate")}
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      )}
      <span className="text-right">{value}</span>
    </div>
  );
}

function PaymentInputRow({
  label,
  value,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_120px_120px] items-center gap-3 px-4 py-2 text-sm">
      <span className="text-primary">{label}</span>
      <span className="text-muted-foreground">-</span>
      <div className="flex items-center gap-1">
        {prefix ? <span className="text-xs text-muted-foreground">{prefix}</span> : null}
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 text-right"
        />
        {suffix ? <span className="text-xs text-muted-foreground">{suffix}</span> : null}
      </div>
    </div>
  );
}
