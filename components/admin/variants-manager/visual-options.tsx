import { useTranslations } from "next-intl";
import { ChevronDown, Circle, CircleDot, Square, Tag } from "lucide-react";
import type { OptionVisual } from "@/lib/products/option-visual";

/** The visual's name in the admin's language, rendered where `label` is. */
function VisualOptionLabel({ value }: { value: OptionVisual }) {
  const t = useTranslations("admin.hc.visualOptions");
  return <>{t(value)}</>;
}

/**
 * The visual choices shown in the admin variant editors (Global Variants and the
 * product option editor), with their picker icons. Kept in one place so both
 * editors stay in sync. "Image" is deliberately absent — see option-visual.ts.
 */
export const VISUAL_OPTIONS: {
  value: OptionVisual;
  label: React.ReactNode;
  icon: React.ReactNode;
}[] = [
  { value: "rectangle", label: <VisualOptionLabel value="rectangle" />, icon: <Square className="size-4" /> },
  { value: "dropdown", label: <VisualOptionLabel value="dropdown" />, icon: <ChevronDown className="size-4" /> },
  { value: "circle", label: <VisualOptionLabel value="circle" />, icon: <Circle className="size-4" /> },
  {
    value: "color",
    label: <VisualOptionLabel value="color" />,
    icon: <span className="size-3.5 rounded-full bg-rose-500" />,
  },
  { value: "color_label", label: <VisualOptionLabel value="color_label" />, icon: <Tag className="size-4" /> },
  { value: "radio", label: <VisualOptionLabel value="radio" />, icon: <CircleDot className="size-4" /> },
];
