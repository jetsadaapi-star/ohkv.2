"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  findProvince,
  formatThaiCity,
  loadThaiAddressData,
  parseThaiCity,
  type ThaiAddressData,
  type ThaiSubdistrict,
} from "@/lib/thai-address/thai-address";
import { cn } from "@/lib/utils";

export interface ThaiAddressValue {
  /** Province (จังหวัด), Thai name. */
  state: string;
  /** "ต.<sub-district> อ.<district>" (Bangkok: "แขวง… เขต…"). */
  city: string;
  postalCode: string;
}

/** True for the values a form may hold for Thailand. */
export function isThailand(country?: string | null) {
  const c = (country || "").trim().toLowerCase();
  return c === "th" || c === "tha" || c === "thailand" || c === "ประเทศไทย" || c === "ไทย";
}

/**
 * Province → district → sub-district → postcode for a Thai address, chosen
 * from the official list (kongvut/thai-province-data) instead of typed.
 * Choosing a sub-district fills its postcode; typing a postcode fills the
 * province, district and sub-district (or offers the few that share it).
 *
 * Writes into the store's existing address fields — see lib/thai-address.
 */
export function ThaiAddressFields({
  value,
  onChange,
  disabled,
  idPrefix = "thai-address",
  required,
  errors,
  className,
  columns = 2,
  modal = false,
}: {
  value: ThaiAddressValue;
  onChange: (next: ThaiAddressValue) => void;
  disabled?: boolean;
  idPrefix?: string;
  required?: Partial<Record<"state" | "city" | "postalCode", boolean>>;
  errors?: Partial<Record<"state" | "city" | "postalCode", string | undefined>>;
  className?: string;
  /** 2 on wide forms, 1 in narrow sidebars. */
  columns?: 1 | 2;
  /** Set inside a Dialog, so the lists scroll with the mouse wheel there. */
  modal?: boolean;
}) {
  const t = useTranslations("storeText.thaiAddress");
  const [data, setData] = useState<ThaiAddressData | null>(null);
  const [failed, setFailed] = useState(false);
  const [zipChoices, setZipChoices] = useState<ThaiSubdistrict[]>([]);

  useEffect(() => {
    let active = true;
    loadThaiAddressData()
      .then((d) => active && setData(d))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  // What the saved text points at.
  const province = useMemo(() => (data ? findProvince(data, value.state) : null), [data, value.state]);
  const { district, subdistrict } = useMemo(
    () => (data && province ? parseThaiCity(data, province.id, value.city) : { district: null, subdistrict: null }),
    [data, province, value.city],
  );

  const provinceOptions = useMemo(
    () => (data?.provinces ?? []).map((p) => ({ value: String(p.id), label: p.th, keywords: p.en })),
    [data],
  );
  const districtOptions = useMemo(
    () =>
      data && province
        ? (data.districtsByProvince.get(province.id) ?? []).map((d) => ({
            value: String(d.id),
            label: `${d.prefix}${d.th}`,
            keywords: `${d.th} ${d.en}`,
          }))
        : [],
    [data, province],
  );
  const subdistrictOptions = useMemo(
    () =>
      data && district
        ? (data.subdistrictsByDistrict.get(district.id) ?? []).map((s) => ({
            value: String(s.id),
            label: `${s.prefix}${s.th}`,
            keywords: `${s.th} ${s.en} ${s.zip}`,
          }))
        : [],
    [data, district],
  );

  const pickProvince = (id: string) => {
    if (!data) return;
    const p = data.provinceById.get(Number(id));
    if (!p || p.id === province?.id) return;
    setZipChoices([]);
    onChange({ state: p.th, city: "", postalCode: "" });
  };

  const pickDistrict = (id: string) => {
    if (!data || !province) return;
    const d = data.districtById.get(Number(id));
    if (!d) return;
    const subs = data.subdistrictsByDistrict.get(d.id) ?? [];
    // One postcode for the whole district: fill it now.
    const zips = [...new Set(subs.map((s) => s.zip))];
    setZipChoices([]);
    onChange({ state: province.th, city: formatThaiCity(d), postalCode: zips.length === 1 ? zips[0] : "" });
  };

  const applySubdistrict = (s: ThaiSubdistrict) => {
    if (!data) return;
    const d = data.districtById.get(s.districtId);
    const p = d ? data.provinceById.get(d.provinceId) : undefined;
    if (!d || !p) return;
    setZipChoices([]);
    onChange({ state: p.th, city: formatThaiCity(d, s), postalCode: s.zip });
  };

  const pickSubdistrict = (id: string) => {
    if (!data || !district) return;
    const s = (data.subdistrictsByDistrict.get(district.id) ?? []).find((x) => String(x.id) === id);
    if (s) applySubdistrict(s);
  };

  // A typed postcode fills in the rest.
  const typePostcode = (raw: string) => {
    const zip = raw.replace(/\D/g, "").slice(0, 5);
    onChange({ ...value, postalCode: zip });
    if (!data || zip.length !== 5) {
      setZipChoices([]);
      return;
    }
    const matches = data.subdistrictsByZip.get(zip) ?? [];
    // Already pointing at one of them: keep it.
    if (subdistrict && matches.some((m) => m.id === subdistrict.id)) {
      setZipChoices([]);
      return;
    }
    if (matches.length === 1) {
      applySubdistrict(matches[0]);
    } else if (matches.length > 1) {
      // Fill what every match agrees on (province, often the district too),
      // and let the shopper pick the sub-district.
      const districtIds = [...new Set(matches.map((m) => m.districtId))];
      const firstDistrict = data.districtById.get(matches[0].districtId);
      const provinceIds = [...new Set(matches.map((m) => data.districtById.get(m.districtId)?.provinceId))];
      const sharedProvince =
        provinceIds.length === 1 && provinceIds[0] ? data.provinceById.get(provinceIds[0]) : undefined;
      if (sharedProvince) {
        onChange({
          state: sharedProvince.th,
          city: districtIds.length === 1 && firstDistrict ? formatThaiCity(firstDistrict) : "",
          postalCode: zip,
        });
      }
      setZipChoices(matches.slice(0, 40));
    } else {
      setZipChoices([]);
    }
  };

  const describe = (s: ThaiSubdistrict) => {
    if (!data) return "";
    const d = data.districtById.get(s.districtId);
    const p = d ? data.provinceById.get(d.provinceId) : undefined;
    return `${s.prefix}${s.th} · ${d ? `${d.prefix}${d.th}` : ""} · ${p?.th ?? ""}`;
  };

  const req = (key: "state" | "city" | "postalCode") =>
    required?.[key] ? <span className="text-destructive"> *</span> : null;
  const err = (key: "state" | "city" | "postalCode") =>
    errors?.[key] ? <p className="text-xs text-destructive">{errors[key]}</p> : null;

  if (failed) {
    // The list could not load: plain inputs keep the form usable.
    return (
      <div className={cn("grid gap-4", columns === 2 && "sm:grid-cols-2", className)}>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-state`}>{t("province")}{req("state")}</Label>
          <Input id={`${idPrefix}-state`} value={value.state} disabled={disabled} onChange={(e) => onChange({ ...value, state: e.target.value })} />
          {err("state")}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-city`}>{t("districtAndSub")}{req("city")}</Label>
          <Input id={`${idPrefix}-city`} value={value.city} disabled={disabled} onChange={(e) => onChange({ ...value, city: e.target.value })} />
          {err("city")}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-zip`}>{t("postcode")}{req("postalCode")}</Label>
          <Input id={`${idPrefix}-zip`} value={value.postalCode} inputMode="numeric" disabled={disabled} onChange={(e) => onChange({ ...value, postalCode: e.target.value })} />
          {err("postalCode")}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className={cn("grid gap-4", columns === 2 && "sm:grid-cols-2")}>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-zip`}>{t("postcode")}{req("postalCode")}</Label>
          <div className="relative">
            <Input
              id={`${idPrefix}-zip`}
              value={value.postalCode}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              placeholder={t("postcodePlaceholder")}
              disabled={disabled}
              onChange={(e) => typePostcode(e.target.value)}
            />
            {!data ? <Loader2 className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
          </div>
          <p className="text-[11px] text-muted-foreground">{t("postcodeHint")}</p>
          {err("postalCode")}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-province`}>{t("province")}{req("state")}</Label>
          <SearchableSelect
            id={`${idPrefix}-province`}
            options={provinceOptions}
            value={province ? String(province.id) : ""}
            onValueChange={pickProvince}
            placeholder={t("selectProvince")}
            searchPlaceholder={t("search")}
            emptyText={t("noResults")}
            modal={modal}
            disabled={disabled || !data}
          />
          {err("state")}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-district`}>{t("district")}{req("city")}</Label>
          <SearchableSelect
            id={`${idPrefix}-district`}
            options={districtOptions}
            value={district ? String(district.id) : ""}
            onValueChange={pickDistrict}
            placeholder={province ? t("selectDistrict") : t("selectProvinceFirst")}
            searchPlaceholder={t("search")}
            emptyText={t("noResults")}
            modal={modal}
            disabled={disabled || !province}
          />
          {err("city")}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-subdistrict`}>{t("subdistrict")}{req("city")}</Label>
          <SearchableSelect
            id={`${idPrefix}-subdistrict`}
            options={subdistrictOptions}
            value={subdistrict ? String(subdistrict.id) : ""}
            onValueChange={pickSubdistrict}
            placeholder={district ? t("selectSubdistrict") : t("selectDistrictFirst")}
            searchPlaceholder={t("search")}
            emptyText={t("noResults")}
            modal={modal}
            disabled={disabled || !district}
          />
        </div>
      </div>

      {zipChoices.length > 0 ? (
        <div className="rounded-xl border bg-muted/30 p-2">
          <p className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">{t("pickArea", { count: zipChoices.length })}</p>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {zipChoices.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => applySubdistrict(s)}
                className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs hover:border-primary hover:text-primary"
              >
                <MapPin className="size-3" />
                {describe(s)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
