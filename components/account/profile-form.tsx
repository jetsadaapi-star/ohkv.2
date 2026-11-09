"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "@/components/language/link";
import { useTranslations } from "next-intl";
import { BadgeCheck, ChevronRight, Loader2, LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KHIT_TILE, SILK_GRADIENT } from "@/components/auth/silk-pattern";
import { AccountSection, FanPlaHem } from "./account-ui";
import { toast } from "@/components/ui/toast-notification";
import { WarningBanner } from "@/components/ui/warning-banner";
import { authClient } from "@/lib/auth/auth-client";
import { normalizeDemoModeState } from "@/lib/demo-mode-shared";
import { useSuspenseResource } from "@/hooks/use-suspense-resource";
import {
  USER_PROFILE_URL,
  type UserProfilePayload,
} from "@/components/account/user-profile-resource";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  birthday: z.string().optional(),
  gender: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

function profileFormValues(user: UserProfilePayload["user"]): ProfileFormData {
  const nameParts = (user?.name || "").split(" ");
  return {
    firstName: nameParts[0] || "",
    lastName: nameParts.slice(1).join(" ") || "",
    email: user?.email || "",
    phone: user?.phone || "",
    birthday: user?.birthday || "",
    gender: user?.gender || "",
  };
}

/**
 * Suspends until the profile is known — render it inside `<ClientSuspense>`,
 * whose fallback is the loading state. A later visit fills the form from the
 * held copy without asking again (see `useSuspenseResource`).
 */
export function ProfileForm() {
  const t = useTranslations();
  const {
    data: profile,
    error: loadError,
    mutate: mutateProfile,
  } = useSuspenseResource<UserProfilePayload>(USER_PROFILE_URL);
  const [isSaving, setIsSaving] = useState(false);
  const demoMode = normalizeDemoModeState(profile?.demoMode);
  const isDemoMode = demoMode.enabled;
  const initials =
    (profile?.user?.name || profile?.user?.email || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    // Read once, on mount: a background refresh of the held profile must not
    // wipe what the shopper is typing.
    defaultValues: profileFormValues(profile?.user),
  });

  const loadFailure = loadError
    ? loadError.message || "Failed to load profile"
    : profile?.user
      ? null
      : "Failed to load";
  useEffect(() => {
    if (loadFailure) toast.error(loadFailure, { id: "profile-load-error" });
  }, [loadFailure]);

  const onProfileSubmit = async (data: ProfileFormData) => {
    if (isDemoMode) {
      toast.error(demoMode.message);
      return;
    }

    setIsSaving(true);
    try {
      const fullName = `${data.firstName} ${data.lastName}`.trim();

      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName,
          phone: data.phone,
          birthday: data.birthday,
          // "No answer" is null: the profile route takes male, female, other
          // or null, and refused the empty string, so a shopper who left
          // gender unpicked could not save their phone or birthday.
          gender: data.gender || null,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        const errors = json?.errors as Record<string, string[]> | undefined;
        if (errors?.name?.[0]) {
          profileForm.setError("firstName", {
            type: "server",
            message: errors.name[0],
          });
        }
        if (errors?.phone?.[0]) {
          profileForm.setError("phone", {
            type: "server",
            message: errors.phone[0],
          });
        }
        if (errors?.birthday?.[0]) {
          profileForm.setError("birthday", {
            type: "server",
            message: errors.birthday[0],
          });
        }
        if (errors?.gender?.[0]) {
          profileForm.setError("gender", {
            type: "server",
            message: errors.gender[0],
          });
        }
        throw new Error(json?.error || json?.message || t("common.error"));
      }

      await authClient.updateUser({ name: fullName }).catch(() => null);

      // The held copy is what the next visit fills the form from.
      mutateProfile((current) => ({
        ...current,
        user: current.user
          ? {
              ...current.user,
              name: fullName,
              phone: data.phone,
              birthday: data.birthday,
              gender: data.gender,
            }
          : current.user,
      }));
      profileForm.reset(data);
      toast.success(json?.message || t("common.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {isDemoMode && (
        <WarningBanner icon={LockKeyhole} className="shadow-sm">
          {demoMode.message}
        </WarningBanner>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      {/* Who this is, on the store's silk. */}
      <aside className="h-fit overflow-hidden rounded-2xl border bg-card">
        <div className="relative isolate h-24 overflow-hidden" style={{ background: SILK_GRADIENT }}>
          <span aria-hidden className="absolute inset-0 -z-10 opacity-[0.14]" style={{ backgroundImage: KHIT_TILE }} />
          <FanPlaHem className="absolute inset-x-0 bottom-0" />
        </div>
        <div className="relative z-10 -mt-10 px-5 pb-5 text-center">
          <span className="mx-auto flex size-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-primary text-2xl font-bold text-primary-foreground shadow-md">
            {profile?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.user.image} alt="" className="size-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <p className="mt-3 truncate text-lg font-bold">{profile?.user?.name}</p>
          <p className="truncate text-sm text-muted-foreground">{profile?.user?.email}</p>
          {profile?.user?.emailVerified ? (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <BadgeCheck className="size-3.5" />
              {t.has("account.hub.verified") ? t("account.hub.verified") : "Verified"}
            </span>
          ) : null}
          <Link
            href="/account/security"
            className="mt-5 flex items-center gap-3 rounded-xl border bg-background/60 px-3 py-2.5 text-start transition hover:border-primary/30 hover:bg-primary/[0.04]"
          >
            <ShieldCheck className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t("account.security")}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {t("account.securityDescription")}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
          </Link>
        </div>
      </aside>

      {/* Personal Information */}
      <AccountSection icon={<UserRound />} title={t("profile.personal")} className="h-fit">
          <Form {...profileForm}>
            <form
              id="customer-profile-form"
              onSubmit={profileForm.handleSubmit(onProfileSubmit)}
              className="space-y-6"
            >
              <fieldset
                disabled={isDemoMode || isSaving}
                className="space-y-6"
              >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={profileForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        {t("profile.firstName")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="given-name"
                          className="h-11 rounded-xl bg-muted/40 transition-colors focus:bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        {t("profile.lastName")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="family-name"
                          className="h-11 rounded-xl bg-muted/40 transition-colors focus:bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        {t("profile.email")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="email"
                          disabled
                          className="h-11 rounded-xl bg-muted"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        {t("profile.phone")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          autoComplete="tel"
                          inputMode="tel"
                          className="h-11 rounded-xl bg-muted/40 transition-colors focus:bg-background"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="birthday"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        {t("profile.birthday")}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type="date"
                            autoComplete="bday"
                            className="block h-11 w-full rounded-xl bg-muted/40 transition-colors focus:bg-background"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-medium">
                        {t("profile.gender")}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isDemoMode || isSaving}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full rounded-xl bg-muted/40 transition-colors focus:bg-background data-[size=default]:h-11">
                            <SelectValue
                              placeholder={t("profile.selectGender")}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="male">
                            {t("profile.male")}
                          </SelectItem>
                          <SelectItem value="female">
                            {t("profile.female")}
                          </SelectItem>
                          <SelectItem value="other">
                            {t("profile.other")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              </fieldset>
            </form>
          </Form>
      </AccountSection>
      </div>

      {profileForm.formState.isDirty && (
        <div className="fixed inset-x-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static lg:flex lg:justify-end lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <Button
            type="submit"
            form="customer-profile-form"
            disabled={isDemoMode || isSaving}
            className="h-11 w-full rounded-xl shadow-md shadow-primary/20 lg:w-auto lg:px-8"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("profile.saveChanges")}
          </Button>
        </div>
      )}
    </div>
  );
}
