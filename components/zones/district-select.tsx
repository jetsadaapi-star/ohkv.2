"use client";

import { MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { KALASIN_DISTRICTS } from "@/config/kalasin-districts";

/**
 * Picks the store's zone: one of Kalasin's 18 districts. Searchable in Thai
 * and English whichever language the page is in.
 */
export function DistrictSelect({
  id,
  value,
  onValueChange,
  disabled,
  className,
  modal,
}: {
  id?: string;
  value?: string;
  onValueChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
  /** Set inside a Dialog, see SearchableSelect. */
  modal?: boolean;
}) {
  const t = useTranslations("zones");
  const locale = useLocale();

  const options = KALASIN_DISTRICTS.map((district) => ({
    value: district.code,
    label: locale === "th" ? `อ.${district.th}` : district.en,
    keywords: `${district.th} อำเภอ${district.th} ${district.en} ${district.code}`,
  }));

  return (
    <SearchableSelect
      id={id}
      options={options}
      value={value || undefined}
      onValueChange={onValueChange}
      placeholder={t("selectDistrict")}
      searchPlaceholder={t("searchDistrict")}
      emptyText={t("noDistrict")}
      ariaLabel={t("district")}
      icon={<MapPin className="size-4 text-muted-foreground" />}
      disabled={disabled}
      className={className}
      {...(modal ? { modal: true } : {})}
    />
  );
}
