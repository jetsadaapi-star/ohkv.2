"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequiredMark } from "@/components/admin/ui/required-mark";
import { cn } from "@/lib/utils";

type Policy = {
  minPasswordLength: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
};

type Status = {
  email: string;
  hasPassword: boolean;
  activeSessions: number;
  policy: Policy;
};

/** A password that meets any policy: upper, lower, digits and a symbol. */
function generatePassword(length: number) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%*?";
  const all = upper + lower + digits + symbols;
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < Math.max(12, length)) chars.push(pick(all));
  // Shuffle so the required kinds are not always in front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/**
 * Set the store owner's sign-in password from the admin vendor page.
 * See app/api/admin/vendors/[id]/password/route.ts.
 */
export function VendorPasswordDialog({
  vendorId,
  storeName,
  open,
  onOpenChange,
}: {
  vendorId: string;
  storeName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.hc.vendorPassword");
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [signOut, setSignOut] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setConfirm("");
    setShow(false);
    setSignOut(true);
    setError(null);
    setCopied(false);
    let active = true;
    setLoading(true);
    fetch(`/api/admin/vendors/${vendorId}/password`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (json?.success) setStatus(json.data as Status);
        else setError(json?.message || t("loadFailed"));
      })
      .catch(() => active && setError(t("loadFailed")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, vendorId, t]);

  const policy = status?.policy ?? {
    minPasswordLength: 8,
    requireUppercase: false,
    requireNumbers: false,
    requireSpecialChars: false,
  };

  const rules = useMemo(
    () =>
      [
        { key: "length", ok: password.length >= policy.minPasswordLength, label: t("ruleLength", { count: policy.minPasswordLength }) },
        policy.requireUppercase ? { key: "upper", ok: /[A-Z]/.test(password), label: t("ruleUpper") } : null,
        policy.requireNumbers ? { key: "number", ok: /[0-9]/.test(password), label: t("ruleNumber") } : null,
        policy.requireSpecialChars ? { key: "special", ok: /[^A-Za-z0-9]/.test(password), label: t("ruleSpecial") } : null,
      ].filter(Boolean) as { key: string; ok: boolean; label: string }[],
    [password, policy, t],
  );
  const rulesOk = rules.every((r) => r.ok);
  const matches = password.length > 0 && password === confirm;
  const canSave = rulesOk && matches && !saving && Boolean(status);

  const generate = () => {
    const next = generatePassword(policy.minPasswordLength + 4);
    setPassword(next);
    setConfirm(next);
    setShow(true);
    setCopied(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard refused */
    }
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, signOutEverywhere: signOut }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.errors?.password?.[0] || json?.message || t("saveFailed"));
      }
      toast.success(
        json.data.mode === "set" ? t("setToast") : t("changedToast"),
        json.data.signedOut > 0 ? { description: t("signedOutToast", { count: json.data.signedOut }) } : undefined,
      );
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <KeyRound className="size-5" />
            </span>
            <div className="min-w-0 text-start">
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription className="truncate">
                {storeName ? `${storeName} · ` : ""}
                {status?.email || "…"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading && !status ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("loading")}
          </div>
        ) : (
          <div className="space-y-4">
            {status ? (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs",
                  status.hasPassword
                    ? "bg-muted/60 text-muted-foreground"
                    : "bg-sky-50 text-sky-800 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30",
                )}
              >
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                <span>{status.hasPassword ? t("hasPassword") : t("noPassword")}</span>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="vendor-new-password">
                  {t("newPassword")}
                  <RequiredMark />
                </Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={generate}>
                  <RefreshCw className="size-3.5" />
                  {t("generate")}
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="vendor-new-password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setCopied(false);
                  }}
                  className="h-11 pe-20 font-mono"
                />
                <div className="absolute inset-y-0 end-1 flex items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={copy}
                    disabled={!password}
                    aria-label={t("copy")}
                  >
                    {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? t("hide") : t("show")}
                  >
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>
              <ul className="grid gap-1 sm:grid-cols-2">
                {rules.map((rule) => (
                  <li
                    key={rule.key}
                    className={cn(
                      "flex items-center gap-1.5 text-xs",
                      rule.ok ? "text-emerald-600" : "text-muted-foreground",
                    )}
                  >
                    {rule.ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" />}
                    {rule.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor-confirm-password">
                {t("confirmPassword")}
                <RequiredMark />
              </Label>
              <Input
                id="vendor-confirm-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={cn("h-11 font-mono", confirm && !matches && "border-red-400 focus-visible:ring-red-300")}
              />
              {confirm && !matches ? <p className="text-xs text-red-600">{t("mismatch")}</p> : null}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <LogOut className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{t("signOutTitle")}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("signOutHint", { count: status?.activeSessions ?? 0 })}
                </span>
              </span>
              <Switch checked={signOut} onCheckedChange={setSignOut} />
            </label>

            {error ? (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </p>
            ) : null}
            <p className="text-[11px] leading-relaxed text-muted-foreground">{t("shareHint")}</p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={save} disabled={!canSave}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            {status && !status.hasPassword ? t("submitSet") : t("submitChange")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
