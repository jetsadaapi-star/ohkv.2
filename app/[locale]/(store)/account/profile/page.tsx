import { Skeleton } from "@/components/ui/skeleton";
import { ClientSuspense } from "@/components/common/client-suspense";
import { ProfileForm } from "@/components/account/profile-form";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { AccountPageHeader } from "@/components/account/account-ui";
import { UserRound } from "lucide-react";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ProfilePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <AccountPageHeader icon={<UserRound />} title={t("profile.title")} description={t("profile.subtitle")} />

      {/* Profile Form — its loading state is this boundary's fallback. */}
      <ClientSuspense fallback={<ProfileFormSkeleton />}>
        <ProfileForm />
      </ClientSuspense>
    </div>
  );
}

function ProfileFormSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]" aria-busy="true">
      <Skeleton className="h-72 rounded-2xl" />
      <div className="space-y-4 rounded-2xl border p-6">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
