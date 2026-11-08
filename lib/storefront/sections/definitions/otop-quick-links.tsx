import { OtopQuickLinks } from "@/components/store/sections/otop/otop-quick-links";
import type { SectionDefinition } from "../types";

/** Six big shortcuts: live, review clips, districts, deals, premium, stores. */
export const otopQuickLinks: SectionDefinition = {
  type: "otop-quick-links",
  version: 1,
  category: "content",
  suggested: true,
  fields: [],
  Render({ ctx }) {
    return <OtopQuickLinks locale={ctx.locale} />;
  },
};
