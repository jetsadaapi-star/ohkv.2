import { getTranslations } from "next-intl/server";
import { OtopCategories } from "@/components/store/sections/otop/otop-categories";
import { lt } from "../localized";
import type { LocalizedText, SectionDefinition } from "../types";

async function OtopCategoriesSection(props: { locale: string; settings: Record<string, unknown>; defaultLanguage: string }) {
  const t = await getTranslations({ locale: props.locale });
  const text = (key: string) => lt(props.settings[key] as LocalizedText, props.locale, props.defaultLanguage);
  return (
    <OtopCategories
      title={text("title")}
      subtitle={text("subtitle")}
      viewAllLabel={text("viewAllLabel")}
      limit={props.settings.limit as number}
      productsLabel={(count) => t("otopTheme.productCount", { count })}
    />
  );
}

/** Top-level categories as soft coloured photo tiles. */
export const otopCategories: SectionDefinition = {
  type: "otop-categories",
  version: 1,
  category: "categories",
  suggested: true,
  fields: [
    { key: "title", type: "text", translatable: true, default: "Shop by category" },
    { key: "subtitle", type: "text", translatable: true, default: "" },
    { key: "viewAllLabel", type: "text", translatable: true, default: "All categories" },
    { key: "limit", type: "number", default: 6, min: 2, max: 12 },
  ],
  Render({ settings, ctx }) {
    return <OtopCategoriesSection locale={ctx.locale} settings={settings} defaultLanguage={ctx.defaultLanguage} />;
  },
};
