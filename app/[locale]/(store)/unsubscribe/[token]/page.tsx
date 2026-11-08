import type { Metadata } from "next";
import Link from "@/components/language/link";
import { LinkIcon } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { type Locale } from "@/config/i18n.config";
import { getSettings } from "@/models/settings.model";
import { Button } from "@/components/ui/button";
import { DEFAULT_STORE_NAME } from "@/config/branding.config";
import { getUnsubscribePageState } from "@/lib/customers/marketing-consent";
import { UnsubscribeView } from "@/components/store/unsubscribe-view";

/**
 * Leaving the marketing list, from the link at the foot of an email.
 *
 * Most people this store emails are guests with no account to sign into, so
 * the token in the URL is the whole credential — a customer record's own, or a
 * sealed one carrying the address of someone with no record at all. It is read
 * here only to say whose preferences these are; changing them is the POST the
 * view makes.
 *
 * Deliberately narrow, like the pre-order balance link: a leaked URL exposes
 * one email address and can do one thing.
 */

interface PageProps {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "storeText.unsubscribePage" });
  return {
    title: t("metaTitle"),
    // A capability URL has no business in a search index.
    robots: { index: false, follow: false },
  };
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto max-w-lg px-4 py-12 sm:py-16">
      {children}
    </div>
  );
}

export default async function UnsubscribePage({ params }: PageProps) {
  const { locale, token } = await params;
  setRequestLocale(locale as Locale);

  const [link, settings, t] = await Promise.all([
    getUnsubscribePageState(token),
    getSettings(),
    getTranslations({ locale, namespace: "storeText.unsubscribePage" }),
  ]);
  const storeName = settings.general?.storeName || DEFAULT_STORE_NAME;

  if (!link) {
    // One message for a forged token and for a retired one alike: telling
    // them apart would make this page a way to test whether an address is on
    // the list.
    return (
      <Shell>
        <div className="rounded-2xl border bg-card p-6 sm:p-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
            <LinkIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <h1 className="mt-4 text-xl font-semibold">
            {t("invalidTitle")}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("invalidBody")}
          </p>
          <div className="mt-6">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/">{t("backToStore")}</Link>
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <UnsubscribeView
        token={token}
        email={link.email}
        initialState={link.state}
        storeName={storeName}
      />
    </Shell>
  );
}
