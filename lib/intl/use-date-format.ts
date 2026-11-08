"use client";

import { useLocale } from "next-intl";
import { formatInLocale, type DateStyle } from "./date-locale";

/**
 * Dates in the page's language. Replaces date-fns `format(…, "MMM d, yyyy")`
 * patterns, which always printed English month names and "at".
 */
export function useDateFormat() {
  const locale = useLocale();
  return (value: Date | string | number, style: DateStyle = "date") => formatInLocale(value, locale, style);
}
