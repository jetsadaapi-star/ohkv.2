"use client";

import { ErrorFallback } from "@/components/errors/error-fallback";

/**
 * Renders outside the intl provider (it replaces the root layout), so it
 * carries its own Thai and English text and picks one from the URL's locale,
 * the page's <html lang> or the browser — Thai unless English is asked for.
 */
const TEXT = {
  th: {
    title: "เกิดข้อผิดพลาดบางอย่าง",
    description: "เกิดข้อผิดพลาดที่ไม่คาดคิด โปรดลองอีกครั้ง",
    home: "หน้าแรก",
    retry: "ลองอีกครั้ง",
  },
  en: {
    title: "Something went wrong",
    description: "An unexpected error occurred. Please try again.",
    home: "Home",
    retry: "Try again",
  },
} as const;

function pageLanguage(): keyof typeof TEXT {
  if (typeof window === "undefined") return "th";
  const fromPath = window.location.pathname.split("/")[1]?.toLowerCase() ?? "";
  const hint =
    (/^[a-z]{2}(-|$)/.test(fromPath) ? fromPath : "") ||
    document.documentElement.lang ||
    navigator.language ||
    "th";
  return hint.toLowerCase().startsWith("en") ? "en" : "th";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const lang = pageLanguage();
  const text = TEXT[lang];
  return (
    <html lang={lang}>
      <body>
        <ErrorFallback
          title={text.title}
          description={text.description}
          homeLabel={text.home}
          retryLabel={text.retry}
          homeHref={`/${lang}`}
          error={error}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
