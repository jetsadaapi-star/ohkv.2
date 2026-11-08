import { getTranslations } from "next-intl/server";
import { OtopStores } from "@/components/store/sections/otop/otop-stores";
import { lt } from "../localized";
import type { LocalizedText, SectionDefinition } from "../types";

async function OtopStoresSection(props: { locale: string; settings: Record<string, unknown>; defaultLanguage: string }) {
  const t = await getTranslations({ locale: props.locale });
  const text = (key: string) => lt(props.settings[key] as LocalizedText, props.locale, props.defaultLanguage);
  return (
    <OtopStores
      locale={props.locale}
      title={text("title")}
      subtitle={text("subtitle")}
      viewAllLabel={text("viewAllLabel")}
      limit={props.settings.limit as number}
      productsLabel={(count) => t("otopTheme.productCount", { count })}
    />
  );
}

/** Maker stores, each showing photos of what it makes. */
export const otopStores: SectionDefinition = {
  type: "otop-stores",
  version: 1,
  category: "content",
  suggested: true,
  fields: [
    { key: "title", type: "text", translatable: true, default: "Maker stores" },
    { key: "subtitle", type: "text", translatable: true, default: "" },
    { key: "viewAllLabel", type: "text", translatable: true, default: "All stores" },
    { key: "limit", type: "number", default: 8, min: 2, max: 12 },
  ],
  Render({ settings, ctx }) {
    return <OtopStoresSection locale={ctx.locale} settings={settings} defaultLanguage={ctx.defaultLanguage} />;
  },
};
