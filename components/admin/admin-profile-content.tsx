"use client";

import * as z from "zod";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "@/hooks/use-locale-navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  Eye,
  EyeOff,
  Camera,
  Mail,
  Phone,
  Calendar,
  User,
  Shield,
  KeyRound,
  Check,
  LockKeyhole,
  CircleCheck,
  Circle,
  Sparkles,
} from "lucide-react";
import { ActiveSessionsCard } from "@/components/account/active-sessions-card";
import { SectionTitle } from "@/components/admin/form-sections";
import { cn } from "@/lib/utils";
import { WarningBanner } from "@/components/ui/warning-banner";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast-notification";
import { authClient } from "@/lib/auth/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import { TwoFactorManagementCard } from "@/components/account/two-factor-management-card";
import {
  DEFAULT_PROFILE_DEMO_MODE,
  normalizeDemoModeState,
} from "@/lib/demo-mode-shared";
import { apiClient, ApiClientError } from "@/lib/api/client";

type Tx = (key: string) => string;

const buildProfileSchema = (tx: Tx) =>
  z.object({
    firstName: z.string().min(1, tx("firstNameRequired")),
    lastName: z.string().min(1, tx("lastNameRequired")),
    email: z.string().email(tx("invalidEmail")),
    phone: z.string().optional(),
    birthday: z.string().optional(),
    gender: z.string().optional(),
  });

const buildPasswordSchema = (tx: Tx) =>
  z
    .object({
      oldPassword: z.string().optional(),
      newPassword: z.string().min(8, tx("passwordMinLength")),
      confirmPassword: z.string().min(1, tx("confirmPasswordRequired")),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: tx("passwordsDontMatch"),
      path: ["confirmPassword"],
    });

type ProfileFormData = z.infer<ReturnType<typeof buildProfileSchema>>;
type PasswordFormData = z.infer<ReturnType<typeof buildPasswordSchema>>;

interface UserProfile {
  name: string;
  email: string;
  image?: string;
  phone?: string;
  birthday?: string;
  gender?: string;
  twoFactorEnabled?: boolean;
}

/** 0–4: length, longer length, mixed case, digits and symbols. */
function passwordScore(value: string) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(score, 4);
}

const STRENGTH = [
  { key: "weak", bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  { key: "weak", bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  { key: "fair", bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  { key: "good", bar: "bg-sky-500", text: "text-sky-600 dark:text-sky-400" },
  { key: "strong", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
] as const;

const FIELD_INPUT =
  "h-11 pl-10 rounded-xl bg-muted/30 border-border/50 focus:bg-background transition-colors";
const FIELD_LABEL = "text-xs font-medium text-muted-foreground uppercase tracking-wider";

interface AdminProfileContentProps {
  allowEmailEdit?: boolean;
}

export function AdminProfileContent({
  allowEmailEdit = false,
}: AdminProfileContentProps) {
  const t = useTranslations();
  const hc = useTranslations("admin.hc.adminProfileContent");
  const profileSchema = useMemo(() => buildProfileSchema(hc), [hc]);
  const passwordSchema = useMemo(() => buildPasswordSchema(hc), [hc]);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [demoMode, setDemoMode] = useState(DEFAULT_PROFILE_DEMO_MODE);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const isDemoMode = demoMode.enabled;

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      birthday: "",
      gender: "",
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const data = await apiClient.get<{
          user?: UserProfile;
          demoMode?: unknown;
        }>("/api/user/profile");
        const userData = data?.user;
        if (!userData) {
          throw new Error(hc("loadFailed"));
        }
        const loadedDemoMode = data?.demoMode;
        setDemoMode(normalizeDemoModeState(loadedDemoMode));
        setUser(userData);
        const nameParts = (userData.name || "").split(" ");
        profileForm.reset({
          firstName: nameParts[0] || "",
          lastName: nameParts.slice(1).join(" ") || "",
          email: userData.email || "",
          phone: userData.phone || "",
          birthday: userData.birthday || "",
          gender: userData.gender || "",
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : hc("loadProfileFailed")
        );
      } finally {
        setIsLoading(false);
      }
    }
    fetchProfile();
  }, [profileForm, hc]);

  const handleAvatarUpload = async (fileList: FileList | null) => {
    if (isDemoMode) {
      toast.error(demoMode.message);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }
    const file = fileList?.[0];
    if (!file) return;
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
    if (!file.type.startsWith("image/")) {
      toast.error(hc("notAnImage", { name: file.name }));
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadJson = await uploadRes.json().catch(() => null);
      if (!uploadRes.ok || !uploadJson?.success) {
        // Surface the server's exact reason (size limit, disallowed type,
        // storage misconfiguration, …) instead of a generic failure.
        const serverError =
          Array.isArray(uploadJson?.errors) && uploadJson.errors.length > 0
            ? uploadJson.errors.join(", ")
            : uploadJson?.message;
        throw new Error(
          serverError ||
            hc("uploadFailed", { name: file.name, size: fileSizeMB }),
        );
      }
      const items = Array.isArray(uploadJson.data) ? uploadJson.data : [];
      const url = items[0]?.url;
      if (!url) {
        throw new Error(hc("uploadNoUrl"));
      }

      await apiClient.put("/api/user/profile", { image: url });

      await authClient.updateUser({ image: url }).catch(() => null);
      setUser((prev) => (prev ? { ...prev, image: url } : prev));
      toast.success(t("adminProfile.avatarUpdated"));
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("adminProfile.avatarError"),
      );
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const onProfileSubmit = async (data: ProfileFormData) => {
    if (isDemoMode) {
      toast.error(demoMode.message);
      return;
    }
    setIsSaving(true);
    try {
      const fullName = `${data.firstName} ${data.lastName}`.trim();
      const email = data.email.trim().toLowerCase();
      let result: { user?: Partial<UserProfile> } | undefined;
      try {
        result = await apiClient.put<{ user?: Partial<UserProfile> }>(
          "/api/user/profile",
          {
            name: fullName,
            ...(allowEmailEdit ? { email } : {}),
            phone: data.phone,
            birthday: data.birthday,
            // "No answer" is null: the profile route takes male, female, other
            // or null, and refused the empty string, so an admin who left
            // gender unpicked could not save their phone or birthday (the
            // storefront's profile form had the same fix, 959389d5).
            gender: data.gender || null,
          },
        );
      } catch (error) {
        if (error instanceof ApiClientError) {
          if (error.errors?.name?.[0]) {
            profileForm.setError("firstName", {
              type: "server",
              message: error.errors.name[0],
            });
          }
          if (error.errors?.email?.[0]) {
            profileForm.setError("email", {
              type: "server",
              message: error.errors.email[0],
            });
          }
          if (error.code === "CONFLICT") {
            profileForm.setError("email", {
              type: "server",
              message: error.message || t("profile.emailInUse"),
            });
          }
        }
        throw error;
      }
      const updatedUser = result?.user;
      await authClient.updateUser({ name: fullName }).catch(() => null);
      setUser((prev) =>
        prev
          ? {
              ...prev,
              ...updatedUser,
              name: updatedUser?.name || fullName,
              email: updatedUser?.email || (allowEmailEdit ? email : prev.email),
              phone: updatedUser?.phone ?? data.phone,
              birthday: updatedUser?.birthday ?? data.birthday,
              gender: updatedUser?.gender ?? data.gender,
            }
          : prev,
      );
      profileForm.reset({
        ...data,
        email: updatedUser?.email || email,
      });
      router.refresh();
      toast.success(t("common.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setIsSaving(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    if (isDemoMode) {
      toast.error(demoMode.message);
      return;
    }
    setIsChangingPassword(true);
    try {
      const currentPassword = data.oldPassword?.trim();
      try {
        const result = await apiClient.request<unknown>(
          "POST",
          "/api/user/change-password",
          {
            currentPassword:
              currentPassword && currentPassword.length > 0
                ? currentPassword
                : undefined,
            newPassword: data.newPassword,
          },
        );
        toast.success(result.message || hc("passwordChanged"));
        passwordForm.reset();
      } catch (error) {
        if (error instanceof ApiClientError) {
          if (error.errors?.currentPassword?.[0]) {
            passwordForm.setError("oldPassword", {
              type: "server",
              message: error.errors.currentPassword[0],
            });
          }
          if (error.errors?.newPassword?.[0]) {
            passwordForm.setError("newPassword", {
              type: "server",
              message: error.errors.newPassword[0],
            });
          }
        }
        throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : hc("genericError"));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const tp = useTranslations("adminProfile");
  const watchedNew = passwordForm.watch("newPassword") || "";
  const score = passwordScore(watchedNew);
  const strength = STRENGTH[score];
  const watched = profileForm.watch();

  // What a complete team profile has: the people working with this account
  // recognise it, can reach it, and it is protected.
  const checklist = [
    { key: "photo", done: Boolean(user?.image) },
    { key: "name", done: Boolean(watched.firstName?.trim() && watched.lastName?.trim()) },
    { key: "phone", done: Boolean(watched.phone?.trim()) },
    { key: "birthday", done: Boolean(watched.birthday) },
    { key: "twoFactor", done: Boolean(user?.twoFactorEnabled) },
  ] as const;
  const completed = checklist.filter((item) => item.done).length;
  const percent = Math.round((completed / checklist.length) * 100);

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  const passwordField = (
    name: "oldPassword" | "newPassword" | "confirmPassword",
    label: string,
    show: boolean,
    toggle: () => void,
  ) => (
    <FormField
      control={passwordForm.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className={FIELD_LABEL}>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                {...field}
                type={show ? "text" : "password"}
                autoComplete={name === "oldPassword" ? "current-password" : "new-password"}
                className="h-11 pl-10 pr-10 rounded-xl bg-muted/30 border-border/50 focus:bg-background transition-colors"
              />
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full hover:bg-transparent"
                onClick={toggle}
                aria-label={show ? tp("hidePassword") : tp("showPassword")}
              >
                {show ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const iconField = (
    name: "firstName" | "lastName" | "email" | "phone" | "birthday",
    label: string,
    Icon: typeof User,
    type?: string,
  ) => (
    <FormField
      control={profileForm.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className={FIELD_LABEL}>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input {...field} type={type} className={FIELD_INPUT} />
              <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <AdminFormStickyHeader
        title={t("adminProfile.title")}
        description={t("adminProfile.subtitle")}
        className="!mx-0 -mt-2 border-b-0 px-0 shadow-none md:px-0"
        actions={
          <Button
            type="submit"
            form="staff-profile-form"
            size="sm"
            className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={isDemoMode || isSaving}
          >
            {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {t("profile.saveChanges")}
          </Button>
        }
      />

      {isDemoMode && (
        <WarningBanner icon={LockKeyhole} title={hc("demoMode")}>
          {demoMode.message}
        </WarningBanner>
      )}

      {/* Identity */}
      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="h-24 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 sm:h-28" aria-hidden />
        <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="relative -mt-12 w-fit group">
              <Avatar className="h-24 w-24 border-4 border-card shadow-lg sm:h-28 sm:w-28">
                <AvatarImage src={user?.image} alt={user?.name} />
                <AvatarFallback className="text-2xl font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                  {getInitials(user?.name || "U")}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isDemoMode || isUploadingAvatar}
                aria-label={tp("changePhoto")}
                className="absolute bottom-1 right-1 flex size-9 items-center justify-center rounded-full border-2 border-card bg-emerald-600 text-white shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void handleAvatarUpload(e.target.files)}
                className="hidden"
              />
            </div>
            <div className="min-w-0 space-y-1.5 sm:pb-1">
              <h2 className="truncate text-xl font-extrabold tracking-tight">{user?.name}</h2>
              <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <Mail className="size-3.5 shrink-0" />
                {user?.email}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <Shield className="h-3 w-3" />
                  {t("adminProfile.administrator")}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    user?.twoFactorEnabled
                      ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                  )}
                >
                  {user?.twoFactorEnabled ? <Check className="h-3 w-3" /> : <LockKeyhole className="h-3 w-3" />}
                  {user?.twoFactorEnabled ? t("adminProfile.twoFactorActive") : tp("twoFactorOff")}
                </span>
              </div>
            </div>
          </div>
          {/* Profile completeness */}
          <div className="flex items-center gap-3 rounded-2xl border bg-muted/20 px-4 py-3 sm:min-w-56">
            <div
              className="relative size-12 shrink-0 rounded-full"
              style={{
                background: `conic-gradient(rgb(16 185 129) ${percent * 3.6}deg, color-mix(in oklab, currentColor 12%, transparent) 0deg)`,
              }}
              aria-hidden
            >
              <div className="absolute inset-1 flex items-center justify-center rounded-full bg-card text-xs font-bold tabular-nums">
                {percent}%
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">{tp("completeTitle")}</p>
              <p className="text-xs text-muted-foreground">
                {tp("completeCount", { done: completed, total: checklist.length })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        <div className="space-y-5 lg:col-span-2">
          {/* Personal info */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="mb-6 space-y-1.5">
              <SectionTitle icon={<User />} tone="emerald">
                {t("adminProfile.personalInfo")}
              </SectionTitle>
              <p className="text-sm text-muted-foreground">{t("adminProfile.personalInfoDesc")}</p>
            </div>

            <Form {...profileForm}>
              <form
                id="staff-profile-form"
                onSubmit={profileForm.handleSubmit(onProfileSubmit)}
                className="space-y-5"
              >
                <fieldset disabled={isDemoMode} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {iconField("firstName", t("profile.firstName"), User)}
                    {iconField("lastName", t("profile.lastName"), User)}
                    {allowEmailEdit ? iconField("email", t("profile.email"), Mail, "email") : null}
                    {iconField("phone", t("profile.phone"), Phone, "tel")}
                    {iconField("birthday", t("profile.birthday"), Calendar, "date")}
                    <FormField
                      control={profileForm.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className={FIELD_LABEL}>{t("profile.gender")}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isDemoMode}>
                            <FormControl>
                              <SelectTrigger className="h-11 w-full rounded-xl bg-muted/30 border-border/50 focus:bg-background transition-colors">
                                <SelectValue placeholder={t("profile.selectGender")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">{t("profile.male")}</SelectItem>
                              <SelectItem value="female">{t("profile.female")}</SelectItem>
                              <SelectItem value="other">{t("profile.other")}</SelectItem>
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
          </div>

          {/* Password */}
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="mb-6 space-y-1.5">
              <SectionTitle icon={<KeyRound />} tone="amber">
                {t("profile.changePassword")}
              </SectionTitle>
              <p className="text-sm text-muted-foreground">{t("adminProfile.passwordDesc")}</p>
            </div>

            <Form {...passwordForm}>
              <form
                id="staff-password-form"
                onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                className="space-y-4"
              >
                <fieldset disabled={isDemoMode} className="space-y-4">
                  <div className="sm:max-w-[calc(50%-0.5rem)]">
                    {passwordField("oldPassword", t("profile.oldPassword"), showOldPassword, () => setShowOldPassword(!showOldPassword))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {passwordField("newPassword", t("profile.newPassword"), showNewPassword, () => setShowNewPassword(!showNewPassword))}
                    {passwordField("confirmPassword", t("profile.confirmPassword"), showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword))}
                  </div>

                  {watchedNew ? (
                    <div className="space-y-2" aria-live="polite">
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4].map((step) => (
                          <span
                            key={step}
                            className={cn(
                              "h-1.5 flex-1 rounded-full transition-colors",
                              step <= Math.max(score, 1) ? strength.bar : "bg-muted",
                            )}
                          />
                        ))}
                      </div>
                      <p className={cn("text-xs font-semibold", strength.text)}>
                        {tp(`strength.${strength.key}`)}
                      </p>
                    </div>
                  ) : null}
                  <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
                    {(
                      [
                        ["length", watchedNew.length >= 8],
                        ["case", /[a-z]/.test(watchedNew) && /[A-Z]/.test(watchedNew)],
                        ["number", /\d/.test(watchedNew)],
                        ["symbol", /[^A-Za-z0-9]/.test(watchedNew)],
                      ] as const
                    ).map(([key, ok]) => (
                      <li
                        key={key}
                        className={cn(
                          "flex items-center gap-1.5",
                          ok ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
                        )}
                      >
                        {ok ? <CircleCheck className="size-3.5" /> : <Circle className="size-3.5" />}
                        {tp(`rules.${key}`)}
                      </li>
                    ))}
                  </ul>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="outline"
                      className="gap-2 rounded-full"
                      disabled={isDemoMode || isChangingPassword}
                      aria-busy={isChangingPassword}
                    >
                      {isChangingPassword ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      {t("adminProfile.updatePassword")}
                    </Button>
                  </div>
                </fieldset>
              </form>
            </Form>
          </div>
        </div>

        {/* Completeness checklist */}
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 space-y-1.5">
            <SectionTitle icon={<Sparkles />} tone="sky">
              {tp("checklistTitle")}
            </SectionTitle>
            <p className="text-sm text-muted-foreground">{tp("checklistHint")}</p>
          </div>
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li
                key={item.key}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-sm",
                  item.done ? "border-emerald-500/25 bg-emerald-500/[0.04]" : "border-dashed",
                )}
              >
                {item.done ? (
                  <CircleCheck className="size-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground/60" />
                )}
                <span className={cn("flex-1", item.done ? "" : "text-muted-foreground")}>
                  {tp(`checklist.${item.key}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ActiveSessionsCard disabled={isDemoMode} />

      {/* Two-factor authentication management (personal preference; only shown
          when the administrator has enabled the 2FA feature). */}
      <TwoFactorManagementCard
        disabled={isDemoMode}
        disabledMessage={isDemoMode ? demoMode.message : undefined}
      />
    </div>
  );
}
