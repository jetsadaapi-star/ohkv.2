"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bell, MapPin, Tags, UserRound } from "lucide-react";
import { CountrySelect } from "@/components/common/country-multi-select";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { joinTagText, parseTagText } from "@/lib/customers/tag-text";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { USER_ACCOUNT_STATUS } from "@/config/app.config";
import { SectionCard } from "../section-card";
import { ThaiAddressFields, isThailand } from "@/components/address/thai-address-fields";
import type {
  CustomerEmailNotifications,
  CustomerFormValues,
  CustomerTabProps,
} from "../customer-detail-types";

const EMAIL_NOTIFICATION_OPTIONS: {
  key: keyof CustomerEmailNotifications;
  label: string;
  description: string;
}[] = [
  { key: "orderUpdates", label: "notifyOrderUpdates", description: "notifyOrderUpdatesHint" },
  { key: "promotions", label: "notifyPromotions", description: "notifyPromotionsHint" },
  { key: "newsletter", label: "notifyNewsletter", description: "notifyNewsletterHint" },
  { key: "priceDrops", label: "notifyPriceDrops", description: "notifyPriceDropsHint" },
  { key: "backInStock", label: "notifyBackInStock", description: "notifyBackInStockHint" },
];

/** Message keys (admin.hc.customerDetail) for the consent vocabulary. */
const CONSENT_STATE_LABELS: Record<string, string> = {
  subscribed: "consentSubscribed",
  pending: "consentPending",
  unsubscribed: "consentUnsubscribed",
  not_subscribed: "consentNotSubscribed",
  invalid: "consentInvalid",
  redacted: "consentRedacted",
};

const CONSENT_STATE_BADGES: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  subscribed: "default",
  pending: "secondary",
  unsubscribed: "outline",
  not_subscribed: "secondary",
  invalid: "destructive",
  redacted: "outline",
};

const CONSENT_SOURCE_LABELS: Record<string, string> = {
  checkout: "sourceCheckout",
  account: "sourceAccount",
  admin: "sourceAdmin",
  storefront_form: "sourceStorefrontForm",
  pos: "sourcePos",
  import: "sourceImport",
  unsubscribe_link: "sourceUnsubscribeLink",
  system: "sourceSystem",
};

const CONSENT_LEVEL_LABELS: Record<string, string> = {
  single_opt_in: "levelSingle",
  confirmed_opt_in: "levelConfirmed",
  unknown: "levelUnknown",
};

function formatConsentDate(value: string | undefined, locale: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ProfileTab({
  form,
  setField,
  readOnly,
  consent,
  emailLocked,
  replacedShippingCountry,
}: CustomerTabProps) {
  const t = useTranslations("admin.hc.customerDetail");
  const locale = useLocale();
  const label = (map: Record<string, string>, value: string) =>
    map[value] ? t(map[value]) : value;
  const setNotification = (
    key: keyof CustomerEmailNotifications,
    value: boolean,
  ) => {
    setField("emailNotifications", { ...form.emailNotifications, [key]: value });
  };

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <SectionCard icon={UserRound} tone="emerald" title={t("basicTitle")} description={t("basicDescription")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer-name">
                {t("fullName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder={t("fullNamePlaceholder")}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">
                {t("email")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="customer-email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder={t("emailPlaceholder")}
                disabled={readOnly || emailLocked}
              />
              {emailLocked && !readOnly ? (
                <p className="text-xs text-muted-foreground">{t("emailLocked")}</p>
              ) : null}
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
                  <SelectItem value={USER_ACCOUNT_STATUS.ACTIVE}>{t("statusActive")}</SelectItem>
                  <SelectItem value={USER_ACCOUNT_STATUS.INACTIVE}>{t("statusInactive")}</SelectItem>
                  <SelectItem value={USER_ACCOUNT_STATUS.BANNED}>{t("statusBanned")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={MapPin} tone="sky" title={t("addressTitle")} description={t("addressDescription")}>
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
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer-shipping-street">{t("street")}</Label>
              <Input
                id="customer-shipping-street"
                value={form.shippingStreet}
                onChange={(e) => setField("shippingStreet", e.target.value)}
                placeholder={t("streetPlaceholder")}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer-shipping-apartment">{t("apartment")}</Label>
              <Input
                id="customer-shipping-apartment"
                value={form.shippingApartment}
                onChange={(e) => setField("shippingApartment", e.target.value)}
                placeholder={t("optional")}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer-shipping-country">{t("country")}</Label>
              <CountrySelect
                id="customer-shipping-country"
                value={form.shippingCountry}
                onChange={(country) => setField("shippingCountry", country)}
                replacedCountry={replacedShippingCountry}
                placeholder={t("selectCountry")}
                disabled={readOnly}
              />
            </div>
            {/* The store ships within Thailand: no country yet means Thailand. */}
            {!form.shippingCountry.trim() || isThailand(form.shippingCountry) ? (
              <div className="sm:col-span-2">
                <ThaiAddressFields
                  idPrefix="customer-shipping-th"
                  value={{
                    state: form.shippingState,
                    city: form.shippingCity,
                    postalCode: form.shippingPostalCode,
                  }}
                  onChange={(next) => {
                    if (!form.shippingCountry.trim()) setField("shippingCountry", "Thailand");
                    setField("shippingState", next.state);
                    setField("shippingCity", next.city);
                    setField("shippingPostalCode", next.postalCode);
                  }}
                  disabled={readOnly}
                />
              </div>
            ) : (
              <>
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
            <div className="space-y-2">
              <Label htmlFor="customer-shipping-postal">{t("postalCode")}</Label>
              <Input
                id="customer-shipping-postal"
                value={form.shippingPostalCode}
                onChange={(e) => setField("shippingPostalCode", e.target.value)}
                placeholder={t("postalCode")}
                inputMode="numeric"
                disabled={readOnly}
              />
            </div>
              </>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="customer-shipping-phone">{t("phone")}</Label>
              <Input
                id="customer-shipping-phone"
                value={form.shippingPhone}
                onChange={(e) => setField("shippingPhone", e.target.value)}
                placeholder={t("phonePlaceholder")}
                disabled={readOnly}
              />
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-5">
        <SectionCard icon={Tags} tone="violet" title={t("segmentTitle")} description={t("segmentDescription")}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-acquisition-source">{t("acquisition")}</Label>
              <Input
                id="customer-acquisition-source"
                value={form.acquisitionSource}
                onChange={(e) => setField("acquisitionSource", e.target.value)}
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
              <p className="text-xs text-muted-foreground">{t("tagsHint")}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={Bell} tone="amber" title={t("commsTitle")} description={t("commsDescription")}>
          <div className="space-y-4">
            <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">{t("emailMarketing")}</Label>
                  <p className="text-xs text-muted-foreground">{t("emailMarketingHint")}</p>
                </div>
                <Switch
                  checked={form.marketingOptIn}
                  disabled={readOnly}
                  onCheckedChange={(value) => setField("marketingOptIn", value)}
                />
              </div>

              {consent ? (
                <div className="space-y-2 border-t pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={CONSENT_STATE_BADGES[consent.state] || "secondary"}>
                      {label(CONSENT_STATE_LABELS, consent.state)}
                    </Badge>
                    {consent.optInLevel ? (
                      <span className="text-xs text-muted-foreground">
                        {label(CONSENT_LEVEL_LABELS, consent.optInLevel)}
                      </span>
                    ) : null}
                  </div>
                  <dl className="grid gap-1 text-xs text-muted-foreground">
                    <div className="flex gap-1">
                      <dt>{t("updated")}:</dt>
                      <dd className="text-foreground">
                        {formatConsentDate(consent.consentUpdatedAt, locale) || t("never")}
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>{t("source")}:</dt>
                      <dd className="text-foreground">
                        {consent.source ? label(CONSENT_SOURCE_LABELS, consent.source) : "—"}
                      </dd>
                    </div>
                    {consent.sourceOrderId ? (
                      <div className="flex gap-1">
                        <dt>{t("order")}:</dt>
                        <dd className="text-foreground">#{consent.sourceOrderId}</dd>
                      </div>
                    ) : null}
                    {consent.sourceCountry ? (
                      <div className="flex gap-1">
                        <dt>{t("country")}:</dt>
                        <dd className="text-foreground">{consent.sourceCountry}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ) : null}

              {consent?.sms && consent.sms.state !== "not_subscribed" ? (
                <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
                  <span className="text-muted-foreground">{t("smsMarketing")}:</span>
                  <Badge variant={CONSENT_STATE_BADGES[consent.sms.state] || "secondary"}>
                    {label(CONSENT_STATE_LABELS, consent.sms.state)}
                  </Badge>
                  {consent.sms.phone ? (
                    <span className="text-muted-foreground">{consent.sms.phone}</span>
                  ) : null}
                </div>
              ) : null}

              {consent?.history && consent.history.length > 0 ? (
                <details className="border-t pt-3">
                  <summary className="cursor-pointer text-xs font-medium">
                    {t("consentHistory", { count: consent.history.length })}
                  </summary>
                  <ul className="mt-2 space-y-1.5">
                    {[...consent.history].reverse().map((entry, index) => (
                      <li
                        key={`${entry.at}-${index}`}
                        className="flex flex-wrap gap-x-2 text-xs text-muted-foreground"
                      >
                        <span className="text-foreground">{label(CONSENT_STATE_LABELS, entry.state)}</span>
                        <span>·</span>
                        <span>{formatConsentDate(entry.at, locale)}</span>
                        {entry.source ? (
                          <>
                            <span>·</span>
                            <span>{label(CONSENT_SOURCE_LABELS, entry.source)}</span>
                          </>
                        ) : null}
                        {entry.channel === "sms" ? <span>· SMS</span> : null}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>

            <div className="divide-y">
              {EMAIL_NOTIFICATION_OPTIONS.map((option) => (
                <div key={option.key} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">{t(option.label)}</Label>
                    <p className="text-xs text-muted-foreground">{t(option.description)}</p>
                  </div>
                  <Switch
                    checked={form.emailNotifications[option.key]}
                    disabled={readOnly}
                    onCheckedChange={(value) => setNotification(option.key, value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
