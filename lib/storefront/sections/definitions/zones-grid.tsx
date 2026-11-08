import { getTranslations } from "next-intl/server";
import { ZonesGrid } from "@/components/store/sections/otop/zones-grid";
import { lt } from "../localized";
import type { LocalizedText, SectionDefinition } from "../types";

async function ZonesGridSection(props: {
  locale: string;
  settings: Record<string, unknown>;
  defaultLanguage: string;
}) {
  const t = await getTranslations({ locale: props.locale });
  const text = (key: string) =>
    lt(props.settings[key] as LocalizedText, props.locale, props.defaultLanguage);
  return (
    <ZonesGrid
      locale={props.locale}
      title={text("title")}
      subtitle={text("subtitle")}
      viewAllLabel={text("viewAllLabel")}
      onlyWithStores={props.settings.onlyWithStores as boolean}
      limit={props.settings.limit as number}
      labels={{
        stores: (count) => t("zones.storeCount", { count }),
        soon: t("zones.noStoresShort"),
      }}
    />
  );
}

/** Kalasin's districts as shop-by-zone tiles. */
export const zonesGrid: SectionDefinition = {
  type: "zones-grid",
  version: 1,
  category: "categories",
  suggested: true,
  fields: [
    { key: "title", type: "text", translatable: true, default: "Shop by district" },
    {
      key: "subtitle",
      type: "text",
      translatable: true,
      default: "OTOP makers from every district of Kalasin",
    },
    { key: "viewAllLabel", type: "text", translatable: true, default: "All districts" },
    { key: "limit", type: "number", default: 18, min: 1, max: 18 },
    {
      key: "onlyWithStores",
      type: "toggle",
      default: false,
      hint: "Show only districts that already have a store.",
    },
  ],
  available: (ctx) => ctx.isMultiVendorEnabled,
  Render({ settings, ctx }) {
    return (
      <ZonesGridSection
        locale={ctx.locale}
        settings={settings}
        defaultLanguage={ctx.defaultLanguage}
      />
    );
  },
};
