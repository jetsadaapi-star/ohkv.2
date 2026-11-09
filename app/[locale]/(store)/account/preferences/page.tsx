import { getTranslations, setRequestLocale } from "next-intl/server";
import { SlidersHorizontal } from "lucide-react";
import { AccountPageHeader } from "@/components/account/account-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientSuspense } from "@/components/common/client-suspense";
import { PreferencesForm } from "@/components/account/preferences-form";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function PreferencesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <AccountPageHeader
        icon={<SlidersHorizontal />}
        title={t("customerProfile.preferences")}
        description={t("customerProfile.preferencesDesc")}
      />
      <ClientSuspense fallback={<PreferencesSkeleton />}>
        <PreferencesForm />
      </ClientSuspense>
    </div>
  );
}

/** Mirrors the form: three sections of switch rows. */
function PreferencesSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2" aria-busy="true">
      {[2, 2, 3].map((rows, group) => (
        <div key={group} className={`space-y-4 rounded-2xl border p-5 ${group === 2 ? "lg:col-span-2" : ""}`}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-5 w-32" />
          </div>
          {Array.from({ length: rows }).map((_, row) => (
            <div key={row} className="flex items-center justify-between gap-6">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </div>
              <Skeleton className="h-5 w-9 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
