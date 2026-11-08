import { LiveTopRanking } from "@/components/live/live-top-ranking";
import { lt } from "../localized";
import type { LocalizedText, SectionDefinition } from "../types";

/** The five most-watched lives of the last 30 days, ranked by viewers. */
export const liveTop: SectionDefinition = {
  type: "live-top",
  version: 1,
  category: "products",
  suggested: true,
  fields: [
    { key: "title", type: "text", translatable: true, default: "Top 5 lives" },
    { key: "subtitle", type: "text", translatable: true, default: "The most-watched lives of the last 30 days" },
    { key: "limit", type: "number", default: 5, min: 3, max: 10 },
  ],
  Render({ settings, ctx }) {
    const text = (key: string) => lt(settings[key] as LocalizedText, ctx.locale, ctx.defaultLanguage);
    return (
      <LiveTopRanking
        locale={ctx.locale}
        title={text("title")}
        subtitle={text("subtitle")}
        limit={settings.limit as number}
        preview={ctx.preview}
      />
    );
  },
};
