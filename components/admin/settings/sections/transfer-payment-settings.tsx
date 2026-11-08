"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileImage,
  IdCard,
  Landmark,
  Pencil,
  Plus,
  QrCode,
  Smartphone,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RequiredLegend, RequiredMark } from "@/components/admin/ui/required-mark";
import { BankAccountCard } from "@/components/banks/bank-account-card";
import { BankAccountEditor, type BankAccountValue } from "@/components/banks/bank-account-editor";
import { findThaiBank } from "@/lib/banks/thai-banks";
import {
  buildPromptPayPayload,
  digitsOnly,
  formatPromptPayId,
  PROMPTPAY_ID_LENGTH,
  PROMPTPAY_ID_TYPES,
  promptPayIdProblem,
  type PromptPayIdType,
} from "@/lib/payments/promptpay";
import {
  clampTimeLimit,
  describeMinutes,
  TRANSFER_TIME_LIMIT_MAX,
  TRANSFER_TIME_LIMIT_MIN,
  TRANSFER_TIME_LIMIT_PRESETS,
  type BankTransferSettingsValue,
  type PromptPaySettingsValue,
  type StoreBankAccount,
  type TransferRulesValue,
} from "@/lib/payments/transfer-payment";
import { cn } from "@/lib/utils";
import { useLocale } from "next-intl";

const PROMPTPAY_BLUE = "#113566";

const ID_TYPE_ICON: Record<PromptPayIdType, typeof Smartphone> = {
  phone: Smartphone,
  national_id: IdCard,
  tax_id: Building2,
  ewallet: Wallet,
};

function Toggle({
  enabled,
  onToggle,
  label,
}: {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-xs font-semibold", enabled ? "text-emerald-600" : "text-muted-foreground")}>{label}</span>
      <Switch checked={enabled} onCheckedChange={onToggle} aria-label={label} />
    </div>
  );
}

/* ------------------------------- PromptPay -------------------------------- */

function PromptPayPreview({ type, id, name }: { type: PromptPayIdType; id: string; name: string }) {
  const t = useTranslations("admin.hc.transferSettings");
  const [qr, setQr] = useState("");
  const valid = promptPayIdProblem(type, id) === null;

  useEffect(() => {
    let active = true;
    if (!valid) {
      setQr("");
      return;
    }
    QRCode.toDataURL(buildPromptPayPayload({ type, id }), { margin: 1, width: 360, errorCorrectionLevel: "M" })
      .then((url) => active && setQr(url))
      .catch(() => active && setQr(""));
    return () => {
      active = false;
    };
  }, [type, id, valid]);

  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-900/5 dark:ring-white/10">
      <div className="flex items-center gap-2.5 px-4 py-3 text-white" style={{ background: PROMPTPAY_BLUE }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/banks/icons/PromptPay.png" alt="" className="size-8 rounded-lg bg-white object-contain p-0.5" />
        <div className="leading-tight">
          <p className="text-xs font-bold tracking-wide">THAI QR PAYMENT</p>
          <p className="text-[10px] opacity-80">PromptPay · พร้อมเพย์</p>
        </div>
      </div>
      <div className="p-4 text-center text-slate-900">
        <div className="mx-auto flex aspect-square w-full max-w-[200px] items-center justify-center rounded-2xl border-2 border-slate-100 bg-white p-1.5">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={t("qrPreviewAlt")} className="size-full" />
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 text-xs text-slate-400">
              <QrCode className="size-10" />
              {t("qrWaiting")}
            </div>
          )}
        </div>
        <p className="mt-3 truncate text-sm font-bold">{name.trim() || t("accountNamePlaceholderShort")}</p>
        <p className="font-mono text-xs tracking-wide text-slate-500">
          {digitsOnly(id) ? formatPromptPayId(type, id) : "—"}
        </p>
      </div>
      <p className="border-t bg-slate-50 px-4 py-2 text-center text-[10px] text-slate-500">{t("qrPreviewHint")}</p>
    </div>
  );
}

function PromptPaySection({
  value,
  update,
}: {
  value: PromptPaySettingsValue;
  update: (path: string, v: unknown) => void;
}) {
  const t = useTranslations("admin.hc.transferSettings");
  const type: PromptPayIdType = value.idType ?? "phone";
  const id = value.idValue ?? "";
  const problem = promptPayIdProblem(type, id);
  const enabled = Boolean(value.enabled);
  const ready = problem === null && Boolean(value.accountName?.trim());

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border bg-card shadow-sm transition-shadow",
        enabled ? "ring-2 ring-[#113566]/15" : "border-dashed",
      )}
    >
      <header className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
        <span className="flex size-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/banks/icons/PromptPay.png" alt="" className="size-full object-contain p-1" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold">{t("promptpayTitle")}</h3>
            {enabled ? (
              ready ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                  <CheckCircle2 className="size-3" />
                  {t("ready")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                  <AlertCircle className="size-3" />
                  {t("incomplete")}
                </span>
              )
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{t("promptpayDescription")}</p>
        </div>
        <Toggle enabled={enabled} onToggle={(v) => update("payment.promptpay.enabled", v)} label={enabled ? t("on") : t("off")} />
      </header>

      {enabled ? (
        <div className="grid gap-6 border-t px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <div className="space-y-2.5">
              <Label>
                {t("idTypeLabel")}
                <RequiredMark />
              </Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PROMPTPAY_ID_TYPES.map((key) => {
                  const Icon = ID_TYPE_ICON[key];
                  const active = key === type;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        if (key === type) return;
                        update("payment.promptpay.idType", key);
                        update("payment.promptpay.idValue", "");
                      }}
                      className={cn(
                        "flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-start transition-all hover:-translate-y-0.5 hover:shadow-md",
                        active && "border-[#113566] bg-[#113566]/5 shadow-md ring-2 ring-[#113566]/20",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-xl",
                          active ? "bg-[#113566] text-white" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="text-sm font-semibold leading-tight">{t(`idType.${key}`)}</span>
                      <span className="text-[11px] text-muted-foreground">{t("digits", { count: PROMPTPAY_ID_LENGTH[key] })}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="promptpay-id">
                  {t(`idType.${type}`)}
                  <RequiredMark />
                </Label>
                <Input
                  id="promptpay-id"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formatPromptPayId(type, id)}
                  onChange={(e) => update("payment.promptpay.idValue", digitsOnly(e.target.value).slice(0, PROMPTPAY_ID_LENGTH[type]))}
                  placeholder={t(`idPlaceholder.${type}`)}
                  className={cn(
                    "h-11 font-mono text-base tracking-wider",
                    digitsOnly(id) && problem && "border-red-400 focus-visible:ring-red-300",
                  )}
                />
                {digitsOnly(id) && problem ? (
                  <p className="text-xs text-red-600">{t(`idProblem.${problem}`, { count: PROMPTPAY_ID_LENGTH[type] })}</p>
                ) : digitsOnly(id) ? (
                  <p className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="size-3.5" />
                    {t("idValid")}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t(`idHint.${type}`)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="promptpay-name">
                  {t("accountName")}
                  <RequiredMark />
                </Label>
                <Input
                  id="promptpay-name"
                  value={value.accountName ?? ""}
                  onChange={(e) => update("payment.promptpay.accountName", e.target.value)}
                  placeholder={t("accountNamePlaceholder")}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">{t("accountNameHint")}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="promptpay-instructions">{t("instructions")}</Label>
              <Textarea
                id="promptpay-instructions"
                rows={2}
                value={value.instructions ?? ""}
                onChange={(e) => update("payment.promptpay.instructions", e.target.value)}
                placeholder={t("instructionsPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2 lg:sticky lg:top-20 lg:self-start">
            <p className="text-xs font-medium text-muted-foreground">{t("preview")}</p>
            <PromptPayPreview type={type} id={id} name={value.accountName ?? ""} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ----------------------------- Bank transfer ------------------------------ */

const EMPTY_ACCOUNT: StoreBankAccount = { bankName: "", accountName: "", accountNumber: "" };

function BankTransferSection({
  value,
  update,
}: {
  value: BankTransferSettingsValue;
  update: (path: string, v: unknown) => void;
}) {
  const t = useTranslations("admin.hc.transferSettings");
  const enabled = Boolean(value.enabled);
  const accounts = useMemo(() => value.accounts ?? [], [value.accounts]);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<StoreBankAccount>(EMPTY_ACCOUNT);

  const open = (index: number | null) => {
    setDraft(index === null || index >= accounts.length ? EMPTY_ACCOUNT : { ...accounts[index] });
    setEditing(index === null ? accounts.length : index);
  };
  const close = () => setEditing(null);
  const draftValid =
    Boolean(draft.bankName.trim()) && Boolean(draft.accountName.trim()) && digitsOnly(draft.accountNumber).length >= 6;

  const save = () => {
    if (editing === null || !draftValid) return;
    const next = [...accounts];
    const clean: StoreBankAccount = {
      bankName: draft.bankName.trim(),
      accountName: draft.accountName.trim(),
      accountNumber: digitsOnly(draft.accountNumber),
      ...(draft.branch?.trim() ? { branch: draft.branch.trim() } : {}),
    };
    if (editing >= next.length) next.push(clean);
    else next[editing] = clean;
    update("payment.bank_transfer.accounts", next);
    close();
  };

  const remove = (index: number) => {
    update(
      "payment.bank_transfer.accounts",
      accounts.filter((_, i) => i !== index),
    );
  };

  return (
    <section
      className={cn(
        "overflow-hidden rounded-3xl border bg-card shadow-sm",
        enabled ? "ring-2 ring-emerald-500/15" : "border-dashed",
      )}
    >
      <header className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
          <Landmark className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold">{t("bankTitle")}</h3>
            {enabled ? (
              accounts.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                  <CheckCircle2 className="size-3" />
                  {t("accountsCount", { count: accounts.length })}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                  <AlertCircle className="size-3" />
                  {t("needAccount")}
                </span>
              )
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{t("bankDescription")}</p>
        </div>
        <Toggle enabled={enabled} onToggle={(v) => update("payment.bank_transfer.enabled", v)} label={enabled ? t("on") : t("off")} />
      </header>

      {enabled ? (
        <div className="space-y-5 border-t px-5 py-5 sm:px-6">
          <div className="grid gap-5 md:grid-cols-2">
            {accounts.map((a, i) => (
              <div key={`${a.accountNumber}-${i}`} className="group space-y-2">
                <BankAccountCard
                  bank={findThaiBank(a.bankName)}
                  bankName={a.bankName}
                  accountName={a.accountName}
                  accountNumber={a.accountNumber}
                />
                <div className="flex items-center justify-between gap-2 px-1">
                  <p className="truncate text-xs text-muted-foreground">
                    {i === 0 ? t("primaryAccount") : t("accountN", { n: i + 1 })}
                    {a.branch ? ` · ${a.branch}` : ""}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 px-2" onClick={() => open(i)}>
                      <Pencil className="size-3.5" />
                      {t("edit")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 px-2 text-red-600 hover:text-red-700"
                      onClick={() => remove(i)}
                    >
                      <Trash2 className="size-3.5" />
                      {t("remove")}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {accounts.length < 10 ? (
              <button
                type="button"
                onClick={() => open(null)}
                className="flex aspect-[1.586] w-full max-w-sm flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed text-muted-foreground transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-700 dark:hover:bg-emerald-500/5"
              >
                <span className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                  <Plus className="size-6" />
                </span>
                <span className="text-sm font-semibold">{t("addAccount")}</span>
                <span className="text-[11px]">{t("addAccountHint")}</span>
              </button>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank-instructions">{t("instructions")}</Label>
            <Textarea
              id="bank-instructions"
              rows={2}
              value={value.instructions ?? ""}
              onChange={(e) => update("payment.bank_transfer.instructions", e.target.value)}
              placeholder={t("instructionsPlaceholder")}
            />
          </div>
        </div>
      ) : null}

      <Dialog open={editing !== null} onOpenChange={(o) => (!o ? close() : undefined)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing !== null && editing < accounts.length ? t("editAccount") : t("addAccount")}</DialogTitle>
            <DialogDescription>{t("accountDialogDescription")}</DialogDescription>
          </DialogHeader>
          <BankAccountEditor
            value={draft as BankAccountValue}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            idPrefix="store-bank"
            showInternational={false}
          />
          <div className="space-y-2 sm:max-w-sm">
            <Label htmlFor="store-bank-branch">{t("branch")}</Label>
            <Input
              id="store-bank-branch"
              value={draft.branch ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, branch: e.target.value }))}
              placeholder={t("branchPlaceholder")}
            />
          </div>
          <RequiredLegend text={t("requiredLegend")} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {t("cancel")}
            </Button>
            <Button type="button" onClick={save} disabled={!draftValid}>
              {t("saveAccount")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/* --------------------------------- Rules ---------------------------------- */

function TransferRulesSection({
  value,
  update,
}: {
  value: TransferRulesValue;
  update: (path: string, v: unknown) => void;
}) {
  const t = useTranslations("admin.hc.transferSettings");
  const locale = useLocale();
  const minutes = clampTimeLimit(value.timeLimitMinutes);
  const slipRequired = value.slipRequired !== false;
  const isPreset = (TRANSFER_TIME_LIMIT_PRESETS as readonly number[]).includes(minutes);
  const [custom, setCustom] = useState(!isPreset);

  return (
    <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <header className="flex items-center gap-4 px-5 py-4 sm:px-6">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-amber-400 to-orange-500 text-white shadow-sm">
          <Clock3 className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold">{t("rulesTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("rulesDescription")}</p>
        </div>
      </header>
      <div className="grid gap-6 border-t px-5 py-5 sm:px-6 lg:grid-cols-2">
        <div className="space-y-3">
          <Label>
            {t("timeLimit")}
            <RequiredMark />
          </Label>
          <div className="flex flex-wrap gap-2">
            {TRANSFER_TIME_LIMIT_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setCustom(false);
                  update("payment.transfer.timeLimitMinutes", m);
                }}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                  !custom && minutes === m
                    ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/25"
                    : "hover:border-amber-400",
                )}
              >
                {describeMinutes(m, locale)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustom(true)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                custom ? "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/25" : "hover:border-amber-400",
              )}
            >
              {t("custom")}
            </button>
          </div>
          {custom ? (
            <div className="flex items-center gap-2">
              <NumberInput
                id="transfer-minutes"
                min={TRANSFER_TIME_LIMIT_MIN}
                max={TRANSFER_TIME_LIMIT_MAX}
                step="1"
                value={minutes}
                whenEmpty={30}
                onValueChange={(next) => update("payment.transfer.timeLimitMinutes", clampTimeLimit(next ?? 30))}
                className="h-10 w-32"
              />
              <span className="text-sm text-muted-foreground">{t("minutes")}</span>
            </div>
          ) : null}
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            {t("timeLimitSummary", { time: describeMinutes(minutes, locale) })}
          </p>
        </div>

        <div className="space-y-3">
          <Label>{t("slipTitle")}</Label>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors hover:bg-muted/30">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <FileImage className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t("slipRequired")}</span>
              <span className="block text-xs text-muted-foreground">{t("slipRequiredHint")}</span>
            </span>
            <Switch checked={slipRequired} onCheckedChange={(v) => update("payment.transfer.slipRequired", v)} />
          </label>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <CreditCard className="size-3.5" />
              {t("slipRuleFiles")}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="size-3.5" />
              {t("slipRuleReview")}
            </li>
            <li className="flex items-center gap-2">
              <AlertCircle className="size-3.5" />
              {t("slipRuleExpire")}
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Export --------------------------------- */

/**
 * Thai transfer payments at the top of Settings → Payment: PromptPay QR,
 * the store's bank accounts as cards, and the payment window and slip rules.
 */
export function TransferPaymentSettings({
  promptpay,
  bankTransfer,
  rules,
  updateNestedField,
}: {
  promptpay?: PromptPaySettingsValue;
  bankTransfer?: BankTransferSettingsValue;
  rules?: TransferRulesValue;
  updateNestedField: (path: string, value: unknown) => void;
}) {
  const t = useTranslations("admin.hc.transferSettings");
  const anyOn = Boolean(promptpay?.enabled || bankTransfer?.enabled);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{t("groupTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("groupDescription")}</p>
        </div>
        <RequiredLegend text={t("requiredLegend")} />
      </div>
      <PromptPaySection value={promptpay ?? {}} update={updateNestedField} />
      <BankTransferSection value={bankTransfer ?? {}} update={updateNestedField} />
      {anyOn ? <TransferRulesSection value={rules ?? {}} update={updateNestedField} /> : null}
    </div>
  );
}
