import { getTranslations } from "next-intl/server";
import { OtopHero } from "@/components/store/sections/otop/otop-hero";
import { lt } from "../localized";
import type { LocalizedText, SectionDefinition } from "../types";

async function OtopHeroSection(props: {
  locale: string;
  settings: Record<string, unknown>;
  defaultLanguage: string;
}) {
  const t = await getTranslations({ locale: props.locale, namespace: "otopTheme" });
  const text = (key: string) =>
    lt(props.settings[key] as LocalizedText, props.locale, props.defaultLanguage);
  return (
    <OtopHero
      locale={props.locale}
      eyebrow={text("eyebrow")}
      title={text("title")}
      subtitle={text("subtitle")}
      primaryLabel={text("primaryLabel")}
      primaryHref={props.settings.primaryHref as string}
      secondaryLabel={text("secondaryLabel")}
      secondaryHref={props.settings.secondaryHref as string}
      image={(props.settings.image as string) || undefined}
      showStats={props.settings.showStats as boolean}
      labels={{
        stores: t("statStores"),
        products: t("statProducts"),
        districts: t("statDistricts"),
      }}
    />
  );
}

/** The OTOP theme's opening banner: headline, two calls to action, live numbers. */
export const otopHero: SectionDefinition = {
  type: "otop-hero",
  version: 1,
  category: "promotions",
  suggested: true,
  fields: [
    { key: "eyebrow", type: "text", translatable: true, default: "OTOP Kalasin · Straight from local makers" },
    { key: "title", type: "text", translatable: true, default: "Authentic OTOP from all 18 districts of Kalasin" },
    {
      key: "subtitle",
      type: "textarea",
      translatable: true,
      default: "Hand-woven Praewa silk, local food and crafts — bought directly from the makers, delivered to your door.",
    },
    { key: "primaryLabel", type: "text", translatable: true, default: "Shop now" },
    { key: "primaryHref", type: "url", default: "/products" },
    { key: "secondaryLabel", type: "text", translatable: true, default: "Shop by district" },
    { key: "secondaryHref", type: "url", default: "/zones" },
    { key: "image", type: "image" },
    { key: "showStats", type: "toggle", default: true },
  ],
  Render({ settings, ctx }) {
    return (
      <OtopHeroSection
        locale={ctx.locale}
        settings={settings}
        defaultLanguage={ctx.defaultLanguage}
      />
    );
  },
};
