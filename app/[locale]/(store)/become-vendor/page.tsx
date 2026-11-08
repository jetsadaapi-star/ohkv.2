import { getLocaleRouting } from "@/lib/i18n/locale-routing";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { StoreBreadcrumb } from "@/components/store/store-breadcrumb";
import { VendorRegistrationForm } from "@/components/vendor/vendor-registration-form";
import { isMultiVendorEnabled } from "@/lib/vendors/multi-vendor";
import { resolveOnboardingConfig } from "@/lib/vendors/vendor-onboarding";
import { localeHref } from "@/lib/i18n/locale-routing";
import { Headset, Radio, ShieldCheck, Sparkles, Store, Wallet } from "lucide-react";
import {
  SILK_FORM_CONTROLS,
  SILK_GRADIENT,
  SilkBackdrop,
} from "@/components/auth/silk-pattern";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function BecomeVendorPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { storeDefault } = await getLocaleRouting();

  const multiVendorEnabled = await isMultiVendorEnabled();
  if (!multiVendorEnabled) {
    redirect(await localeHref(locale, "/"));
  }

  // Seeded server-side so the wizard renders the right number of steps with no
  // flash; the onboarding GET echoes the same shape for deep-link resume.
  const onboardingConfig = await resolveOnboardingConfig();

  const t = await getTranslations({ locale });

  const sv = await getTranslations({ locale, namespace: "vendor.registration.showcase" });
  const perks = [
    { icon: Store, label: sv("perks.storefront") },
    { icon: Radio, label: sv("perks.live") },
    { icon: Wallet, label: sv("perks.payout") },
    { icon: Headset, label: sv("perks.support") },
  ];
  const steps = [sv("steps.apply"), sv("steps.review"), sv("steps.sell")];

  return (
    <div className="pb-14">
      {/* Silk hero */}
      <section className="relative isolate overflow-hidden text-white" style={{ background: SILK_GRADIENT }}>
        <SilkBackdrop lotusClassName="-bottom-24 -right-10 size-[22rem] opacity-20" />
        <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-8 sm:px-6 sm:pb-32 sm:pt-10">
          <StoreBreadcrumb
            className="mb-8 [&_a]:text-white/75 [&_a:hover]:text-white [&_*]:text-white/90"
            locale={locale}
            storeDefault={storeDefault}
            items={[{ label: t("vendor.becomeVendor") }]}
          />
          <div className="grid items-end gap-8 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-highlight ring-1 ring-inset ring-white/20 sm:text-sm">
                <Sparkles className="size-4" />
                {sv("eyebrow")}
              </p>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                {t("vendor.registration.startSelling")}
              </h1>
              <span aria-hidden className="mt-4 block h-1.5 w-20 rounded-full bg-highlight" />
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85">
                {t("vendor.registration.joinUs")}
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-2.5">
              {perks.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2.5 rounded-2xl bg-white/10 p-3 text-sm font-medium ring-1 ring-inset ring-white/15 backdrop-blur-sm"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-highlight text-highlight-foreground">
                    <Icon className="size-4.5" />
                  </span>
                  <span className="leading-snug">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="relative mx-auto -mt-20 w-full max-w-5xl px-4 sm:px-6">
        {/* How it goes */}
        <ol className="mb-4 grid grid-cols-3 gap-2 sm:gap-2.5">
          {steps.map((label, index) => (
            <li
              key={label}
              className="flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-2 py-2.5 text-center shadow-sm sm:flex-row sm:gap-3 sm:px-4 sm:py-3 sm:text-start"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground sm:size-8 sm:text-sm">
                {index + 1}
              </span>
              <span className="text-xs font-semibold leading-snug sm:text-sm">{label}</span>
            </li>
          ))}
        </ol>

        {/* Form card */}
        <div
          className={`rounded-[28px] border bg-card p-5 shadow-[0_30px_80px_-40px_rgba(60,15,10,0.45)] sm:p-8 ${SILK_FORM_CONTROLS}`}
        >
          <Suspense fallback={<FormSkeleton />}>
            <VendorRegistrationForm
              locale={locale}
              config={onboardingConfig}
            />
          </Suspense>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" />
          {sv("footnote")}
        </p>
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
}
