import { getTranslations } from "next-intl/server";
import { OtopJoin } from "@/components/store/sections/otop/otop-join";
import { lt } from "../localized";
import type { LocalizedText, SectionDefinition } from "../types";

async function OtopJoinSection(props: { locale: string; settings: Record<string, unknown>; defaultLanguage: string }) {
  const t = await getTranslations({ locale: props.locale, namespace: "otopTheme.join" });
  const text = (key: string) => lt(props.settings[key] as LocalizedText, props.locale, props.defaultLanguage);
  return (
    <OtopJoin
      title={text("title")}
      subtitle={text("subtitle")}
      buttonLabel={text("buttonLabel")}
      buttonHref={props.settings.buttonHref as string}
      perks={{ store: t("store"), live: t("live"), clips: t("clips"), payout: t("payout") }}
    />
  );
}

/** The invitation to open a store, with what a store gets. */
export const otopJoin: SectionDefinition = {
  type: "otop-join",
  version: 1,
  category: "promotions",
  suggested: true,
  fields: [
    { key: "title", type: "text", translatable: true, default: "Open your OTOP store with us" },
    { key: "subtitle", type: "textarea", translatable: true, default: "" },
    { key: "buttonLabel", type: "text", translatable: true, default: "Open a store" },
    { key: "buttonHref", type: "url", default: "/become-vendor" },
  ],
  Render({ settings, ctx }) {
    return <OtopJoinSection locale={ctx.locale} settings={settings} defaultLanguage={ctx.defaultLanguage} />;
  },
};
