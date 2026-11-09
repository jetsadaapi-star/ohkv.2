"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Cloud, Fingerprint, KeyRound, Loader2, Pencil, Plus, Smartphone, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ClientSuspense } from "@/components/common/client-suspense";
import { useSuspenseResource } from "@/hooks/use-suspense-resource";
import { USER_PROFILE_URL, type UserProfilePayload } from "@/components/account/user-profile-resource";
import { authClient } from "@/lib/auth/auth-client";
import { passkeyErrorCode, passkeyErrorMessageKey, webAuthnSupport } from "@/lib/auth/passkey-errors";

interface PasskeyRow {
  id: string;
  name?: string | null;
  deviceType?: string;
  backedUp?: boolean;
  createdAt?: string | Date;
}

/** A name for a new passkey from this device, so the list tells them apart. */
function deviceName(): string {
  if (typeof navigator === "undefined") return "Passkey";
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/CrOS/i.test(ua)) return "Chromebook";
  if (/Linux/i.test(ua)) return "Linux";
  return "Passkey";
}

/**
 * The account's passkeys: add one from this device, rename or remove one.
 * Shown while the store offers passkeys (Settings → Two-Factor), and always to
 * someone who already has one, so they can remove it.
 */
export function PasskeyManagementCard() {
  return (
    <ClientSuspense fallback={null}>
      <PasskeyManagementContent />
    </ClientSuspense>
  );
}

function PasskeyManagementContent() {
  const t = useTranslations("account.passkeys");
  const locale = useLocale();
  const { data: profile } = useSuspenseResource<UserProfilePayload>(USER_PROFILE_URL);
  const available = profile?.user ? profile.user.passkeyAvailable !== false : false;
  const [rows, setRows] = useState<PasskeyRow[] | null>(null);
  const supported = useSyncExternalStore(webAuthnSupport.subscribe, webAuthnSupport.get, webAuthnSupport.server);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await authClient.passkey.listUserPasskeys();
    setRows(((result.data as PasskeyRow[] | null) ?? []).slice());
  }, []);

  useEffect(() => {
    let cancelled = false;
    authClient.passkey
      .listUserPasskeys()
      .then((result) => {
        if (!cancelled) setRows(((result.data as PasskeyRow[] | null) ?? []).slice());
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows === null) return null;
  if (!available && rows.length === 0) return null;

  const describe = (code?: string, fallback?: string) => {
    const key = passkeyErrorMessageKey(code);
    return key ? t(`errors.${key}`) : fallback || t("errors.generic");
  };

  const add = async () => {
    setBusy("add");
    setError(null);
    setNotice(null);
    try {
      const result = await authClient.passkey.addPasskey({ name: deviceName() });
      if (result?.error) {
        if (passkeyErrorCode(result.error) !== "ERROR_CEREMONY_ABORTED") {
          setError(describe(passkeyErrorCode(result.error), result.error.message));
        }
        return;
      }
      await load();
      setNotice(t("added"));
    } catch {
      setError(t("errors.generic"));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row: PasskeyRow) => {
    if (!window.confirm(t("removeConfirm", { name: row.name || t("unnamed") }))) return;
    setBusy(row.id);
    setError(null);
    setNotice(null);
    try {
      const result = await authClient.passkey.deletePasskey({ id: row.id });
      if (result.error) {
        setError(describe(passkeyErrorCode(result.error), result.error.message));
        return;
      }
      setRows((current) => (current ?? []).filter((item) => item.id !== row.id));
      setNotice(t("removed"));
    } finally {
      setBusy(null);
    }
  };

  const rename = async () => {
    if (!editing) return;
    const name = editing.name.trim().slice(0, 60);
    if (!name) return;
    setBusy(editing.id);
    try {
      const result = await authClient.passkey.updatePasskey({ id: editing.id, name });
      if (result.error) {
        setError(describe(passkeyErrorCode(result.error), result.error.message));
        return;
      }
      setRows((current) => (current ?? []).map((item) => (item.id === editing.id ? { ...item, name } : item)));
      setEditing(null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Fingerprint className="size-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-lg">{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length > 0 ? (
          <ul className="divide-y rounded-xl border">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {row.deviceType === "multiDevice" ? <Cloud className="size-4" /> : <Smartphone className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  {editing?.id === row.id ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void rename();
                      }}
                    >
                      <Input
                        autoFocus
                        value={editing.name}
                        maxLength={60}
                        aria-label={t("nameLabel")}
                        onChange={(event) => setEditing({ id: row.id, name: event.target.value })}
                        className="h-8"
                      />
                      <Button type="submit" size="icon" variant="ghost" className="size-8" aria-label={t("save")}>
                        <Check className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={t("cancel")}
                        onClick={() => setEditing(null)}
                      >
                        <X className="size-4" />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <p className="truncate text-sm font-semibold">{row.name || t("unnamed")}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.createdAt
                          ? t("addedOn", {
                              date: new Date(row.createdAt).toLocaleDateString(locale, {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }),
                            })
                          : null}
                        {row.backedUp ? ` · ${t("synced")}` : ""}
                      </p>
                    </>
                  )}
                </div>
                {editing?.id === row.id ? null : (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      aria-label={t("rename")}
                      disabled={Boolean(busy)}
                      onClick={() => setEditing({ id: row.id, name: row.name || "" })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive hover:text-destructive"
                      aria-label={t("remove")}
                      disabled={Boolean(busy)}
                      onClick={() => void remove(row)}
                    >
                      {busy === row.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
            <KeyRound className="mt-0.5 size-4 shrink-0" />
            <p>{t("empty")}</p>
          </div>
        )}

        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        {notice ? <p className="text-sm font-medium text-emerald-600">{notice}</p> : null}

        {available ? (
          supported ? (
            <Button type="button" variant="outline" onClick={() => void add()} disabled={Boolean(busy)}>
              {busy === "add" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {t("add")}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">{t("unsupported")}</p>
          )
        ) : (
          <p className="text-sm text-muted-foreground">{t("turnedOff")}</p>
        )}
      </CardContent>
    </Card>
  );
}
