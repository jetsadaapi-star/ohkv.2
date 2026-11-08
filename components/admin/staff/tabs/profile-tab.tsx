"use client";

import { pageLocale } from "@/lib/intl/date-locale";
import { KeyRound, Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  MemberStatusControl,
  type MemberStatusChoice,
} from "@/components/admin/team/member-status-control";
import { useTranslations } from "next-intl";
import { useAdminPhrase } from "@/hooks/use-admin-phrase";
import type {
  StaffFormValues,
  StaffHeaderData,
  StaffStats,
} from "../staff-detail-types";

interface ProfileTabProps {
  form: StaffFormValues;
  setField: <K extends keyof StaffFormValues>(
    key: K,
    value: StaffFormValues[K],
  ) => void;
  header: StaffHeaderData;
  stats: StaffStats | null;
  onSendInvite: () => void;
  invitePending: boolean;
  /** Active, Paused or Suspended: the account status and the access switch, as one. */
  statusChoice: MemberStatusChoice;
  onStatusChoice: (next: MemberStatusChoice) => void;
  /** The owner's and your own status are not changed here. */
  statusLocked?: boolean;
  readOnly?: boolean;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(pageLocale(), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ProfileTab({
  form,
  setField,
  header,
  stats,
  onSendInvite,
  invitePending,
  statusChoice,
  onStatusChoice,
  statusLocked = false,
  readOnly = false,
}: ProfileTabProps) {
  const tr = useAdminPhrase();
  const t = useTranslations("admin.hc.profileTab");
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("basicInfoTitle")}</CardTitle>
            <CardDescription>
              {t("basicInfoDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="staff-name">{t("fullNameLabel")}</Label>
                <Input
                  id="staff-name"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder={t("fullNamePlaceholder")}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-email">{t("emailLabel")}</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={form.email}
                  disabled
                />
                <p className="text-xs text-muted-foreground">
                  {t("emailLocked")}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="staff-phone">{t("phoneLabel")}</Label>
                <Input
                  id="staff-phone"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  placeholder={t("phonePlaceholder")}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-department">{t("departmentLabel")}</Label>
                <Input
                  id="staff-department"
                  value={form.department}
                  onChange={(e) => setField("department", e.target.value)}
                  placeholder={t("departmentPlaceholder")}
                  disabled={readOnly}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("employmentTitle")}</CardTitle>
            <CardDescription>
              {t("employmentDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="staff-job-title">{t("jobTitleLabel")}</Label>
                <Input
                  id="staff-job-title"
                  value={form.jobTitle}
                  onChange={(e) => setField("jobTitle", e.target.value)}
                  placeholder={t("jobTitlePlaceholder")}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-start-date">{t("startDateLabel")}</Label>
                <Input
                  id="staff-start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setField("startDate", e.target.value)}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("memberSince")}</Label>
                <Input value={formatDate(header.createdAt)} disabled />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{tr("Status", "স্ট্যাটাস")}</CardTitle>
          </CardHeader>
          <CardContent>
            <MemberStatusControl
              value={statusChoice}
              onChange={onStatusChoice}
              disabled={readOnly || statusLocked}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t("signInTitle")}
            </CardTitle>
            <CardDescription>
              {header.hasPassword
                ? t("passwordSet")
                : t("noPasswordSet")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onSendInvite}
              disabled={invitePending || readOnly}
            >
              {invitePending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : header.hasPassword ? (
                <KeyRound className="mr-2 h-4 w-4" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {header.hasPassword
                ? t("emailPasswordLink")
                : t("sendInviteEmail")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("oneHourLinkHint")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("atAGlance")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex items-center justify-between gap-3 border-b py-2">
              <span className="text-muted-foreground">{t("twoFactor")}</span>
              {header.twoFactorEnabled ? (
                <Badge variant="outline">{t("enabled")}</Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600">
                  {t("notEnabled")}
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-b py-2">
              <span className="text-muted-foreground">{t("addedBy")}</span>
              <span className="truncate">{header.assignedByEmail || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-muted-foreground">{t("ordersProcessed")}</span>
              <span className="tabular-nums">
                {stats ? stats.orderCount.toLocaleString() : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
