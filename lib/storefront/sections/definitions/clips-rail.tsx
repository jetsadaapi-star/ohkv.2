import { getTranslations } from "next-intl/server";
import { ClipsRail } from "@/components/store/sections/otop/clips-rail";
import { lt } from "../localized";
import type { LocalizedText, SectionDefinition } from "../types";

async function ClipsRailSection(props: {
  locale: string;
  settings: Record<string, unknown>;
  defaultLanguage: string;
  preview?: boolean;
}) {
  const t = await getTranslations({ locale: props.locale });
  const text = (key: string) =>
    lt(props.settings[key] as LocalizedText, props.locale, props.defaultLanguage);
  return (
    <ClipsRail
      title={text("title")}
      subtitle={text("subtitle")}
      viewAllLabel={text("viewAllLabel")}
      limit={props.settings.limit as number}
      preview={props.preview}
      labels={{
        products: (count) => t("clips.pinnedCount", { count }),
        empty: t("otopTheme.clipsEmpty"),
      }}
    />
  );
}

/** Product review clips — the newest, each opening the clip feed. */
export const clipsRail: SectionDefinition = {
  type: "clips-rail",
  version: 1,
  category: "products",
  suggested: true,
  fields: [
    { key: "title", type: "text", translatable: true, default: "Product review clips" },
    {
      key: "subtitle",
      type: "text",
      translatable: true,
      default: "Watch the makers, then add what you see to your cart",
    },
    { key: "viewAllLabel", type: "text", translatable: true, default: "Watch all" },
    { key: "limit", type: "number", default: 8, min: 1, max: 12 },
  ],
  Render({ settings, ctx }) {
    return (
      <ClipsRailSection
        locale={ctx.locale}
        settings={settings}
        defaultLanguage={ctx.defaultLanguage}
        preview={ctx.preview}
      />
    );
  },
};
