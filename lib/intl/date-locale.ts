/**
 * Dates in a language, usable on the server and in the browser alike.
 * (The hook version lives in use-date-format.ts.)
 */
export type DateStyle = "date" | "longDate" | "dateTime" | "longDateTime";

const OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  date: { dateStyle: "medium" },
  longDate: { dateStyle: "long" },
  dateTime: { dateStyle: "medium", timeStyle: "short" },
  longDateTime: { dateStyle: "long", timeStyle: "short" },
};

/** Format a date or ISO string in a language, e.g. "6 พ.ย. 2569 18:00" in Thai. */
export function formatInLocale(value: Date | string | number, locale: string, style: DateStyle = "date") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, OPTIONS[style]).format(date);
}

/**
 * The page's language outside React: `<html lang>` in the browser, the
 * store's default language (Thai) while rendering on the server.
 */
export function pageLocale(fallback = "th") {
  return typeof document !== "undefined" && document.documentElement.lang
    ? document.documentElement.lang
    : fallback;
}
