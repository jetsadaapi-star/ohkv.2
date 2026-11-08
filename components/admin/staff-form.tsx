"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Loader2, Mail, MapPin, Power, Send, Store, StickyNote, UserPlus, UserRound } from "lucide-react";
import { FormPageTitle } from "@/components/admin/form-sections";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "@/hooks/use-locale-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/toast-notification";
import { AdminFormStickyHeader } from "@/components/admin/admin-form-sticky-header";
import {
  MemberAccessSummary,
  TeamMemberRoleCard,
  resolveMemberAccess,
  useTeamRoles,
} from "@/components/admin/team/team-member-role-card";
import { PermissionList } from "@/components/admin/team/permission-list";
import { StaffPresetPicker } from "@/components/admin/team/staff-preset-picker";
import { AccessSummaryCard } from "@/components/admin/team/access-summary-card";
import { ScopeChoice } from "@/components/admin/team/scope-choice";
import {
  MemberStatusControl,
  statusFieldsFor,
  type MemberStatusChoice,
} from "@/components/admin/team/member-status-control";
import { useAdminPhrase } from "@/hooks/use-admin-phrase";
import {
  DEFAULT_STAFF_PERMISSIONS,
  staffPermissionsSellerMayGive,
  type StaffPermission,
} from "@/config/permissions.config";
import type { TeamGrantScope } from "@/lib/access/team-member-roles";
import { isStaffTierPermission } from "@/config/team-permissions.config";
import {
  StoreProfileNotice,
  storeProfileCodeOf,
} from "@/components/admin/store-profile-notice";

interface StaffFormProps {
  locale: string;
  area?: "admin" | "vendor";
  /** The person adding may make roles (Save as a role). */
  canManageRoles?: boolean;
  /** What the person adding may give (the Role card offers only that). */
  grantScope?: TeamGrantScope | null;
  /** The vendor area: the seller's own permissions, which bound what its staff may be given. */
  sellerPermissions?: readonly string[] | null;
}

type TeamFormRole = "admin" | "staff";

interface FormValues {
  name: string;
  email: string;
  phone: string;
  role: TeamFormRole;
  permissions: StaffPermission[];
  vendorIds: string[];
  locationIds: string[];
  fulfillmentRegions: string;
  department: string;
  notes: string;
  sendInvite: boolean;
  /** The admin area: the member's team role, with their own changes. */
  teamRoleId: string | null;
  teamExtraPermissions: string[];
  teamRevokedPermissions: string[];
}

const defaultValues: FormValues = {
  name: "",
  email: "",
  phone: "",
  role: "staff",
  permissions: [...DEFAULT_STAFF_PERMISSIONS],
  vendorIds: [],
  locationIds: [],
  fulfillmentRegions: "",
  department: "",
  notes: "",
  sendInvite: true,
  teamRoleId: null,
  teamExtraPermissions: [],
  teamRevokedPermissions: [],
};

interface ScopeOption {
  _id: string;
  name: string;
}

/** Adds a team member; an existing one is edited on their page (StaffDetailShell). */
export function StaffForm({
  locale,
  area = "admin",
  canManageRoles = false,
  grantScope = null,
  sellerPermissions = null,
}: StaffFormProps) {
  // A seller gives its staff only what its plan gives the seller.
  const sellerGivable = useMemo(
    () => (sellerPermissions ? new Set<string>(staffPermissionsSellerMayGive(sellerPermissions)) : null),
    [sellerPermissions],
  );
  const sellerMayGive = sellerGivable ? (permission: string) => sellerGivable.has(permission) : undefined;
  const router = useRouter();
  const tr = useAdminPhrase();
  const t = useTranslations("admin.hc.staffForm");
  const apiBasePath = area === "vendor" ? "/api/vendor/staff" : "/api/admin/staff";
  const staffListPath = `/${locale}/${area}/staff`;

  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<FormValues>(defaultValues);
  const [status, setStatus] = useState<MemberStatusChoice>("active");
  const [scopeLimited, setScopeLimited] = useState(false);
  const [vendors, setVendors] = useState<ScopeOption[]>([]);
  const [locations, setLocations] = useState<ScopeOption[]>([]);
  // The store profile the locations belong to is missing and could not be made.
  const [locationsProblem, setLocationsProblem] = useState<string | null>(null);
  const { roles, addRole } = useTeamRoles(area === "admin");

  // Vendors manage staff only; the role is an admin-area concept.
  const isAdminRole = area === "admin" && form.role === "admin";
  const memberValue = useMemo(
    () => ({
      role: form.role,
      teamRoleId: form.teamRoleId,
      teamExtraPermissions: form.teamExtraPermissions,
      teamRevokedPermissions: form.teamRevokedPermissions,
      permissions: form.permissions,
    }),
    [form.role, form.teamRoleId, form.teamExtraPermissions, form.teamRevokedPermissions, form.permissions],
  );

  useEffect(() => {
    if (area !== "admin") return;
    const fetchScopeOptions = async () => {
      const [vendorsRes, locationsRes] = await Promise.allSettled([
        fetch("/api/admin/vendors?limit=100"),
        fetch("/api/admin/locations?includeInactive=false"),
      ]);

      if (vendorsRes.status === "fulfilled" && vendorsRes.value.ok) {
        const data = await vendorsRes.value.json();
        const rows = data.data?.data || data.data || [];
        if (Array.isArray(rows)) {
          setVendors(
            rows.map((vendor: { _id: string; storeName?: string; name?: string }) => ({
              _id: String(vendor._id),
              name: vendor.storeName || vendor.name || t("vendorFallback"),
            })),
          );
        }
      }

      if (locationsRes.status === "fulfilled" && locationsRes.value.ok) {
        const data = await locationsRes.value.json();
        const rows = data.data || [];
        if (Array.isArray(rows)) {
          setLocations(
            rows.map((location: { _id: string; name?: string }) => ({
              _id: String(location._id),
              name: location.name || t("locationFallback"),
            })),
          );
        }
      } else if (locationsRes.status === "fulfilled") {
        setLocationsProblem(
          storeProfileCodeOf(await locationsRes.value.json().catch(() => null)),
        );
      }
    };

    fetchScopeOptions().catch(() => {
      setVendors([]);
      setLocations([]);
    });
  }, [area, t]);

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleStringListValue = (
    key: "vendorIds" | "locationIds",
    value: string,
    checked: boolean,
  ) => {
    setForm((prev) => {
      const next = new Set(prev[key]);
      if (checked) next.add(value);
      else next.delete(value);
      return { ...prev, [key]: Array.from(next) };
    });
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }
    if (!form.email.trim()) {
      toast.error(t("emailRequired"));
      return;
    }
    // A staff member needs something to do; an administrator's role always gives it.
    const staffHolds =
      area === "admin"
        ? (resolveMemberAccess(memberValue, roles)?.effective ?? form.permissions).filter(isStaffTierPermission)
        : form.permissions;
    if (!isAdminRole && staffHolds.length === 0) {
      toast.error(t("selectPermission"));
      return;
    }

    setIsSaving(true);
    try {
      const statusFields = statusFieldsFor(status);
      const scoped = area === "admin" && !isAdminRole && scopeLimited;
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        status: statusFields.status,
        isActive: statusFields.isActive,
        // The vendor API has no role concept — its staff are always staff.
        ...(area === "admin"
          ? {
              role: form.role,
              // Before the roles have loaded there is no role id yet: the
              // list alone puts a staff member on Staff, an administrator on
              // Administrator.
              ...(form.teamRoleId
                ? {
                    teamRoleId: form.teamRoleId,
                    teamExtraPermissions: form.teamExtraPermissions,
                    teamRevokedPermissions: form.teamRevokedPermissions,
                  }
                : {}),
              vendorIds: scoped ? form.vendorIds : [],
              locationIds: scoped ? form.locationIds : [],
              fulfillmentRegions: scoped
                ? form.fulfillmentRegions
                    .split(/[\n,]+/)
                    .map((value) => value.trim())
                    .filter(Boolean)
                : [],
            }
          : {}),
        permissions: form.permissions,
        department: form.department.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };

      const res = await fetch(apiBasePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || t("saveFailed"));
      }

      toast.success(t("created"));

      // Send invite email on creation if enabled
      if (form.sendInvite && data.data?._id) {
        try {
          const inviteRes = await fetch(
            `${apiBasePath}/${data.data._id}/invite?locale=${encodeURIComponent(locale)}`,
            { method: "POST" },
          );
          const inviteData = await inviteRes.json();
          if (inviteRes.ok && inviteData.success) {
            toast.success(t("inviteSent"));
          } else {
            toast.error(
              inviteData.message || t("createdInviteFailed"),
            );
          }
        } catch {
          toast.error(t("createdInviteSendFailed"));
        }
      }

      router.push(staffListPath);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  // The vendor area's look, now on the admin form too.
  const vendorLook = true;
  const cardClass = vendorLook ? "rounded-2xl shadow-sm" : undefined;

  return (
    <div className="space-y-6 -mx-2 md:mx-0">
      <AdminFormStickyHeader
        flushWithAdminShell
        title={
          <FormPageTitle icon={<UserPlus />} tone="sky">
            {t("pageTitle")}
          </FormPageTitle>
        }
        description={t("pageDescription")}
        actions={
          <>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSaving}
              className={cn(vendorLook && "rounded-full bg-emerald-600 text-white hover:bg-emerald-700")}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("createTeamMember")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn(vendorLook && "rounded-full")}
              onClick={() => router.push(staffListPath)}
              disabled={isSaving}
            >
              {t("backToTeam")}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          <Card className={cardClass}>
            <CardHeader>
              <CardTitle>
                <SectionHeading vendor={vendorLook} icon={<UserRound />} tone="bg-sky-500">
                  {t("basicInfoTitle")}
                </SectionHeading>
              </CardTitle>
              <CardDescription>
                {t("basicInfoDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("fullNameLabel")}</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    placeholder={t("fullNamePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("emailLabel")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    placeholder={t("emailPlaceholder")}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("phoneLabel")}</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                    placeholder={t("phonePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">{t("departmentLabel")}</Label>
                  <Input
                    id="department"
                    value={form.department}
                    onChange={(e) => setField("department", e.target.value)}
                    placeholder={t("departmentPlaceholder")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role and permissions — the store's own team */}
          {area === "admin" ? (
            <TeamMemberRoleCard
              roles={roles}
              onRoleCreated={addRole}
              canManageRoles={canManageRoles}
              grantScope={grantScope}
              canChangeRole={grantScope ? grantScope.duties.create : true}
              canChangePermissions={grantScope ? grantScope.duties.editPermissions : true}
              memberName={form.name}
              value={memberValue}
              onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
            />
          ) : (
            // A vendor's own staff: permissions one by one, no roles.
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle>
                  <SectionHeading vendor={vendorLook} icon={<KeyRound />} tone="bg-violet-500">
                    {tr("Permissions", "পারমিশন")}
                  </SectionHeading>
                </CardTitle>
                <CardDescription>
                  {tr("What this staff member can do, by area.", "এই স্টাফ সদস্য কী করতে পারবে, এরিয়া অনুযায়ী।")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <StaffPresetPicker
                  area="vendor"
                  permissions={form.permissions}
                  onApply={(next) =>
                    setField(
                      "permissions",
                      sellerMayGive ? next.filter((permission) => form.permissions.includes(permission) || sellerMayGive(permission)) : next,
                    )
                  }
                />
                <PermissionList
                  tier="staff"
                  area="vendor"
                  permissions={form.permissions}
                  onChange={(next) => setField("permissions", next as StaffPermission[])}
                  canGrant={sellerMayGive}
                />
              </CardContent>
            </Card>
          )}

          {/* Scope — a data-access restriction, so staff only */}
          {area === "admin" && !isAdminRole && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="h-5 w-5" />
                  {tr("Scope", "স্কোপ")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <ScopeChoice limited={scopeLimited} onChange={setScopeLimited} />

                {scopeLimited ? (
                  <>
                    {vendors.length > 0 && (
                      <div className="space-y-3">
                        <Label>{t("vendors")}</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {vendors.map((vendor) => (
                            <label
                              key={vendor._id}
                              className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                            >
                              <Checkbox
                                checked={form.vendorIds.includes(vendor._id)}
                                onCheckedChange={(checked) =>
                                  toggleStringListValue("vendorIds", vendor._id, Boolean(checked))
                                }
                              />
                              <span className="truncate">{vendor.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {locations.length === 0 && locationsProblem ? (
                      <StoreProfileNotice code={locationsProblem} compact />
                    ) : null}

                    {locations.length > 0 && (
                      <div className="space-y-3">
                        <Label className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {t("locations")}
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {locations.map((location) => (
                            <label
                              key={location._id}
                              className="flex items-center gap-2 rounded-lg border p-3 text-sm"
                            >
                              <Checkbox
                                checked={form.locationIds.includes(location._id)}
                                onCheckedChange={(checked) =>
                                  toggleStringListValue("locationIds", location._id, Boolean(checked))
                                }
                              />
                              <span className="truncate">{location.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="fulfillmentRegions">{t("fulfillmentRegions")}</Label>
                      <Textarea
                        id="fulfillmentRegions"
                        value={form.fulfillmentRegions}
                        onChange={(e) => setField("fulfillmentRegions", e.target.value)}
                        placeholder={t("regionsPlaceholder")}
                        rows={3}
                      />
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Notes — stored on the staff profile, which admins do not have */}
          {!isAdminRole && (
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle>
                  <SectionHeading vendor={vendorLook} icon={<StickyNote />} tone="bg-amber-500">
                    {t("internalNotesTitle")}
                  </SectionHeading>
                </CardTitle>
                <CardDescription>
                  {t("internalNotesDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder={t("notesPlaceholder")}
                  rows={4}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          {area === "admin" ? (
            <MemberAccessSummary value={memberValue} roles={roles} name={form.name} />
          ) : (
            <AccessSummaryCard name={form.name} tier="staff" area="vendor" permissions={form.permissions} />
          )}

          <Card className={cardClass}>
            <CardHeader>
              <CardTitle>
                <SectionHeading vendor={vendorLook} icon={<Power />} tone="bg-emerald-600">
                  {tr("Status", "স্ট্যাটাস")}
                </SectionHeading>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MemberStatusControl value={status} onChange={setStatus} />
            </CardContent>
          </Card>

          <Card className={cardClass}>
            <CardHeader>
              <CardTitle>
                <SectionHeading vendor={vendorLook} icon={<Send />} tone="bg-rose-500">
                  {tr("Invite", "আমন্ত্রণ")}
                </SectionHeading>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <label
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors",
                  vendorLook && "rounded-xl",
                  vendorLook && form.sendInvite && "border-emerald-300 bg-emerald-50/60 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10",
                )}
              >
                <Checkbox
                  checked={form.sendInvite}
                  onCheckedChange={(checked) => setField("sendInvite", Boolean(checked))}
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-none flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {t("sendInviteEmail")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("sendInviteHint")}
                  </p>
                </div>
              </label>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * A card heading in the vendor area's look: a coloured icon square before the
 * title. The admin's form keeps its plain headings.
 */
function SectionHeading({
  vendor,
  icon,
  tone,
  children,
}: {
  vendor: boolean;
  icon: ReactNode;
  tone: string;
  children: ReactNode;
}) {
  if (!vendor) return <>{children}</>;
  return (
    <span className="flex items-center gap-2.5">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm [&_svg]:size-4", tone)}>
        {icon}
      </span>
      {children}
    </span>
  );
}
