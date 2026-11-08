import { LiveRail } from "@/components/store/sections/otop/live-rail";
import { lt } from "../localized";
import type { LocalizedText, SectionDefinition } from "../types";

/** Stores live now and upcoming lives, each opening its live room. */
export const liveRail: SectionDefinition = {
  type: "live-rail",
  version: 1,
  category: "products",
  suggested: true,
  fields: [
    { key: "title", type: "text", translatable: true, default: "Live now" },
    {
      key: "subtitle",
      type: "text",
      translatable: true,
      default: "Watch the makers live and buy at live-only prices",
    },
    { key: "viewAllLabel", type: "text", translatable: true, default: "All lives" },
    { key: "limit", type: "number", default: 8, min: 1, max: 12 },
  ],
  Render({ settings, ctx }) {
    const text = (key: string) =>
      lt(settings[key] as LocalizedText, ctx.locale, ctx.defaultLanguage);
    return (
      <LiveRail
        locale={ctx.locale}
        title={text("title")}
        subtitle={text("subtitle")}
        viewAllLabel={text("viewAllLabel")}
        limit={settings.limit as number}
        preview={ctx.preview}
      />
    );
  },
};
