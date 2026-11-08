"use client";

import { BadgeCheck, Images, MapPin, Percent, ShieldCheck, Store, UserRound } from "lucide-react";
import { SectionCard } from "@/components/admin/customers/section-card";
import { RequiredLegend, RequiredMark } from "@/components/admin/ui/required-mark";
import { useTranslations } from "next-intl";
import { DistrictSelect } from "@/components/zones/district-select";
import { CountrySelect } from "@/components/common/country-multi-select";
import { ThaiAddressFields, isThailand } from "@/components/address/thai-address-fields";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MediaUploader } from "@/components/ui/media-uploader";
import { Switch } from "@/components/ui/switch";
import { USER_ACCOUNT_STATUS, VENDOR_STATUS } from "@/config/app.config";
import type { VendorFormValues, VendorTabProps } from "../vendor-detail-types";

const VENDOR_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp";
const VENDOR_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export function ProfileTab({
  form,
  setField,
  readOnly,
  replacedAddressCountry,
}: VendorTabProps) {
  const t = useTranslations();
  const tp = useTranslations("admin.hc.profileTab");
  const tv = useTranslations("admin.hc.vendorPage");
  return (
    <div className="space-y-4">
      <RequiredLegend text={tv("requiredLegend")} />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <SectionCard icon={Store} tone="emerald" title={tp("storeProfileTitle")} description={tp("storeProfileDescription")}>
            <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storeName">{tp("storeNameLabel")}<RequiredMark /></Label>
            <Input
              id="storeName"
              value={form.storeName}
              onChange={(e) => setField("storeName", e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="district">{t("zones.districtField")}<RequiredMark /></Label>
            <DistrictSelect
              id="district"
              value={form.district}
              onValueChange={(code) => setField("district", code)}
              disabled={readOnly}
            />
            {!form.district ? (
              <p className="text-xs text-amber-600">{t("zones.districtMissing")}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">{tp("storeSlugLabel")}</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => setField("slug", e.target.value)}
              placeholder="auto-from-store-name"
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">{tp("descriptionLabel")}</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={4}
              disabled={readOnly}
            />
          </div>
            </div>
          </SectionCard>

          <SectionCard icon={Images} tone="violet" title={tv("imagesTitle")} description={tv("imagesDescription")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{tp("storeLogoLabel")}</Label>
              <MediaUploader
                value={
                  form.logo
                    ? [
                        {
                          _id: "logo",
                          url: form.logo,
                          type: "image",
                          mimeType: "image/*",
                          alt: tp("logoAlt", { name: form.storeName || tp("storeFallback") }),
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
                uploadTitle={tp("uploadTitle")}
                uploadDescription={tp("uploadDescription")}
                sizeGuide={tp("logoSizeGuide")}
                mediaGridClassName="grid-cols-1 md:grid-cols-1 max-w-32"
                previewAspectRatio="1 / 1"
                previewFit="contain"
                previewTileClassName="bg-slate-50"
                showCoverBadge={false}
                coverHint={false}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>{tp("storeBannerLabel")}</Label>
              <MediaUploader
                value={
                  form.banner
                    ? [
                        {
                          _id: "banner",
                          url: form.banner,
                          type: "image",
                          mimeType: "image/*",
                          alt: tp("bannerAlt", { name: form.storeName || tp("storeFallback") }),
                          position: 0,
                        },
                      ]
                    : []
                }
                onChange={(items) => {
                  const banner = items.find((item) => item.type === "image");
                  setField("banner", banner?.url || "");
                }}
                maxFiles={1}
                acceptTypes={["image"]}
                accept={VENDOR_IMAGE_ACCEPT}
                allowedFileExtensions={VENDOR_IMAGE_EXTENSIONS}
                uploadTitle={tp("uploadTitle")}
                uploadDescription={tp("uploadDescription")}
                sizeGuide={tp("bannerSizeGuide")}
                mediaGridClassName="grid-cols-1 md:grid-cols-1"
                previewAspectRatio="1360 / 314"
                previewFit="contain"
                previewTileClassName="bg-slate-50"
                showCoverBadge={false}
                coverHint={false}
                disabled={readOnly}
              />
            </div>
          </div>
          </SectionCard>

          <SectionCard icon={MapPin} tone="sky" title={tp("storeAddressTitle")} description={tp("storeAddressDescription")}>
            <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vendor-address-street">{tp("streetLabel")}</Label>
            <Input
              id="vendor-address-street"
              value={form.addressStreet}
              onChange={(e) => setField("addressStreet", e.target.value)}
              placeholder={tp("streetPlaceholder")}
              disabled={readOnly}
            />
          </div>

          {isThailand(form.addressCountry) ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
              <Label htmlFor="vendor-address-country">{tp("countryLabel")}</Label>
              <CountrySelect
                id="vendor-address-country"
                value={form.addressCountry}
                onChange={(country) => setField("addressCountry", country)}
                // Where the seller is, not where the store delivers.
                lockedHint={false}
                replacedCountry={replacedAddressCountry}
                placeholder={tp("countryPlaceholder")}
                disabled={readOnly}
              />
            </div>
            </div>
          ) : null}
          {isThailand(form.addressCountry) ? (
            <ThaiAddressFields
              idPrefix="vendor-address"
              value={{
                state: form.addressState,
                city: form.addressCity,
                postalCode: form.addressPostalCode,
              }}
              onChange={(next) => {
                setField("addressState", next.state);
                setField("addressCity", next.city);
                setField("addressPostalCode", next.postalCode);
              }}
              disabled={readOnly}
            />
          ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vendor-address-city">{tp("cityLabel")}</Label>
              <Input
                id="vendor-address-city"
                value={form.addressCity}
                onChange={(e) => setField("addressCity", e.target.value)}
                placeholder={tp("cityLabel")}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-address-state">{tp("stateLabel")}</Label>
              <Input
                id="vendor-address-state"
                value={form.addressState}
                onChange={(e) => setField("addressState", e.target.value)}
                placeholder={tp("stateLabel")}
                disabled={readOnly}
              />
            </div>
          </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {isThailand(form.addressCountry) ? null : (
            <div className="space-y-2">
              <Label htmlFor="vendor-address-postal">{tp("postalCodeLabel")}</Label>
              <Input
                id="vendor-address-postal"
                value={form.addressPostalCode}
                onChange={(e) => setField("addressPostalCode", e.target.value)}
                placeholder={tp("postalCodeLabel")}
                disabled={readOnly}
              />
            </div>
            )}
            {isThailand(form.addressCountry) ? null : (
            <div className="space-y-2">
              <Label htmlFor="vendor-address-country">{tp("countryLabel")}</Label>
              <CountrySelect
                id="vendor-address-country"
                value={form.addressCountry}
                onChange={(country) => setField("addressCountry", country)}
                // Where the seller is, not where the store delivers.
                lockedHint={false}
                replacedCountry={replacedAddressCountry}
                placeholder={tp("countryPlaceholder")}
                disabled={readOnly}
              />
            </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor-address-phone">{tp("phoneLabel")}</Label>
            <Input
              id="vendor-address-phone"
              value={form.addressPhone}
              onChange={(e) => setField("addressPhone", e.target.value)}
              placeholder={tp("phonePlaceholder")}
              disabled={readOnly}
            />
          </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard icon={ShieldCheck} tone="amber" title={tp("statusTitle")} description={tp("statusDescription")}>
            <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor-status">{tp("vendorStatusLabel")}</Label>
              <Select
                value={form.status}
                disabled={readOnly}
                onValueChange={(value) => setField("status", value)}
              >
                {/* w-full: the trigger is w-fit by default, so each control
                    used to size itself to its own longest option and the
                    column read as a ragged edge. */}
                <SelectTrigger id="vendor-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={VENDOR_STATUS.PENDING}>{tp("statusPending")}</SelectItem>
                  <SelectItem
                    value={VENDOR_STATUS.PAYMENT_REQUIRED}
                    disabled={form.status !== VENDOR_STATUS.PAYMENT_REQUIRED}
                  >
                    {tp("statusPaymentRequired")}
                  </SelectItem>
                  <SelectItem value={VENDOR_STATUS.APPROVED}>
                    {tp("statusApproved")}
                  </SelectItem>
                  <SelectItem value={VENDOR_STATUS.SUSPENDED}>
                    {tp("statusSuspended")}
                  </SelectItem>
                  <SelectItem value={VENDOR_STATUS.REJECTED}>
                    {tp("statusRejected")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="owner-status">{tp("ownerAccountStatusLabel")}</Label>
              <Select
                value={form.userStatus}
                disabled={readOnly}
                onValueChange={(value) =>
                  setField("userStatus", value as VendorFormValues["userStatus"])
                }
              >
                <SelectTrigger id="owner-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={USER_ACCOUNT_STATUS.ACTIVE}>
                    {tp("userStatusActive")}
                  </SelectItem>
                  <SelectItem value={USER_ACCOUNT_STATUS.INACTIVE}>
                    {tp("userStatusInactive")}
                  </SelectItem>
                  <SelectItem value={USER_ACCOUNT_STATUS.BANNED}>
                    {tp("userStatusBanned")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.status === VENDOR_STATUS.REJECTED ? (
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">{tp("rejectionReasonLabel")}</Label>
              <Textarea
                id="rejection-reason"
                value={form.rejectionReason}
                onChange={(e) => setField("rejectionReason", e.target.value)}
                placeholder={tp("rejectionReasonPlaceholder")}
                maxLength={1000}
                rows={3}
                disabled={readOnly}
              />
              <p className="text-xs text-muted-foreground">
                {tp("rejectionReasonHelp")}
              </p>
            </div>
          ) : null}

          {/* The storefront badge, and the only thing that grants it. Kept a
              separate switch rather than a side effect of "Approved": approval
              says a seller may trade here, verification says the platform has
              checked who they are — and buyers read the badge as the second.
              Boxed because it is the one control here that changes what a
              shopper sees. */}
          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/40 p-4">
            <div className="min-w-0 space-y-1">
              <Label
                htmlFor="vendor-verified"
                className="flex items-center gap-1.5 font-medium"
              >
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
                {tp("verifiedVendorLabel")}
              </Label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {tp("verifiedVendorHelp")}
              </p>
            </div>
            <Switch
              id="vendor-verified"
              checked={form.verified}
              onCheckedChange={(value) => setField("verified", value)}
              disabled={readOnly}
              className="mt-0.5 shrink-0"
            />
          </div>

            </div>
          </SectionCard>

          <SectionCard icon={Percent} tone="rose" title={tv("moneyTitle")} description={tv("moneyDescription")}>
            <div className="space-y-4">
          {/* Commission and COD sit on one row because they answer the same
              question — what this vendor owes the store, and who is holding the
              cash while it is owed. COD is deliberately administered here and
              absent from the vendor's own settings: a vendor who could set it
              to "the vendor" would be granting themselves the right to mark
              their own COD orders paid. */}
          {/* items-end: "Cash on delivery collected by" wraps to two lines in
              this half-width card, and without it the two fields sat at
              different heights. */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="commission">{tp("commissionLabel")}</Label>
              <NumberInput
                id="commission"
                min={0}
                max={100}
                value={form.commission}
                whenEmpty={0}
                onValueChange={(next) => setField("commission", next ?? 0)}
                disabled={readOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="codCollectedBy">
                {tp("codCollectedByLabel")}
              </Label>
              <Select
                value={form.codCollectedBy}
                onValueChange={(value) => setField("codCollectedBy", value)}
                disabled={readOnly}
              >
                <SelectTrigger id="codCollectedBy" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">{tp("codStoreDefault")}</SelectItem>
                  <SelectItem value="vendor">
                    {tp("codVendor")}
                  </SelectItem>
                  <SelectItem value="platform">
                    {tp("codPlatform")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Under the pair, not under the select: at half width this ran to
              five cramped lines beside an empty column. */}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {tp("codHelp")}
          </p>
            </div>
          </SectionCard>

          <SectionCard icon={UserRound} tone="slate" title={tp("ownerAccountTitle")} description={tp("ownerAccountDescription")}>
            <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ownerName">{tp("ownerNameLabel")}<RequiredMark /></Label>
            <Input
              id="ownerName"
              value={form.ownerName}
              onChange={(e) => setField("ownerName", e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerEmail">{tp("ownerEmailLabel")}<RequiredMark /></Label>
            <Input
              id="ownerEmail"
              type="email"
              value={form.ownerEmail}
              onChange={(e) => setField("ownerEmail", e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ownerPhone">{tp("ownerPhoneLabel")}</Label>
            <Input
              id="ownerPhone"
              value={form.ownerPhone}
              onChange={(e) => setField("ownerPhone", e.target.value)}
              disabled={readOnly}
            />
          </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
