"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  BadgePercent,
  Banknote,
  CalendarRange,
  Check,
  CircleAlert,
  Copy,
  Eye,
  EyeOff,
  HandCoins,
  Loader2,
  Repeat,
  Scissors,
  ShoppingBag,
  Sparkles,
  Store,
  TicketPercent,
  Truck,
  Users,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { OtopCouponCard } from "@/components/admin/otop-coupon-card";
import { useAppSettings } from "@/providers/app-settings-provider";

export type CouponType = "percentage" | "fixed" | "free_shipping";
export type CouponStatus = "active" | "inactive" | "expired";

export type CouponFormState = {
  code: string;
  label: string;
  description: string;
  type: CouponType;
  value: string;
  minOrderAmount: string;
  maxDiscount: string;
  usageLimit: string;
  perUserLimit: string;
  startDate: string;
  endDate: string;
  status: CouponStatus;
  fundedBy: "platform" | "vendor";
  listed: boolean;
};

/** Letters and digits that cannot be misread for one another (no 0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(prefix: string) {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const tail = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
  return `${prefix}${tail}`;
}

function addDays(base: string, days: number) {
  const date = base ? new Date(`${base}T00:00:00`) : new Date();
  date.setDate(date.getDate() + days);
  return toDateInput(date);
}

function toDateInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function endOfMonth(base: string) {
  const date = base ? new Date(`${base}T00:00:00`) : new Date();
  return toDateInput(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

const TYPE_STYLE: Record<CouponType, { icon: typeof BadgePercent; tile: string; ring: string; ticket: string }> = {
  percentage: {
    icon: BadgePercent,
    tile: "bg-violet-500 text-white",
    ring: "border-violet-500 bg-violet-500/[0.06] ring-1 ring-violet-500/30",
    ticket: "from-[#8E1B2C] to-[#4F0D18]",
  },
  fixed: {
    icon: Banknote,
    tile: "bg-emerald-600 text-white",
    ring: "border-emerald-500 bg-emerald-500/[0.06] ring-1 ring-emerald-500/30",
    ticket: "from-[#24336B] to-[#111A3D]",
  },
  free_shipping: {
    icon: Truck,
    tile: "bg-sky-500 text-white",
    ring: "border-sky-500 bg-sky-500/[0.06] ring-1 ring-sky-500/30",
    ticket: "from-[#1F5B3A] to-[#0E2E1D]",
  },
};

const STATUS_STYLE: Record<CouponStatus, string> = {
  active: "bg-emerald-600 text-white",
  inactive: "bg-zinc-600 text-white",
  expired: "bg-rose-600 text-white",
};

/** One numbered block of the form. */
function Section({
  step,
  icon,
  title,
  hint,
  aside,
  children,
}: {
  step: number;
  icon: ReactNode;
  title: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground/80 [&_svg]:size-4">
            {icon}
            <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
              {step}
            </span>
          </span>
          <div>
            <h3 className="text-sm font-bold">{title}</h3>
            {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** A pill that sets a value in one click. */
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-semibold tabular-nums transition",
        active
          ? "border-foreground bg-foreground text-background"
          : "bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function DiscountFormDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: CouponFormState;
  setField: <K extends keyof CouponFormState>(field: K, value: CouponFormState[K]) => void;
  setType: (type: CouponType) => void;
  isStoreCoupon: boolean;
  currencySymbol: string;
  formatPrice: (value: number) => string;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("admin.discountForm");
  const format = useFormatter();
  const { form, setField, setType, editing, isStoreCoupon, currencySymbol, formatPrice, saving } = props;
  const { storeName } = useAppSettings();
  const [copied, setCopied] = useState(false);
  const [triedSave, setTriedSave] = useState(false);

  const value = Number(form.value);
  const minOrder = Number(form.minOrderAmount) || 0;
  const cap = Number(form.maxDiscount) || 0;
  const style = TYPE_STYLE[form.type];

  // What still blocks a save — the same three rules the save handler checks.
  const problems = {
    code: !editing && !form.code.trim(),
    value: form.type !== "free_shipping" && !(value > 0),
    percentTooHigh: form.type === "percentage" && value > 100,
    endDate: !form.endDate,
    dateOrder: Boolean(form.startDate && form.endDate && form.endDate < form.startDate),
  };
  const blocking = Object.values(problems).some(Boolean);

  const headline =
    form.type === "free_shipping"
      ? t("ticket.freeShipping")
      : value > 0
        ? form.type === "percentage"
          ? t("ticket.percentOff", { value: format.number(value) })
          : t("ticket.amountOff", { amount: formatPrice(value) })
        : t("ticket.placeholder");

  // A worked example the admin can check the rule against.
  const sampleOrder = Math.max(minOrder, form.type === "fixed" ? Math.max(value * 4, 1000) : 1000);
  const sampleDiscount =
    form.type === "percentage" && value > 0
      ? Math.min(sampleOrder * (Math.min(value, 100) / 100), cap > 0 ? cap : Number.POSITIVE_INFINITY)
      : form.type === "fixed" && value > 0
        ? Math.min(value, sampleOrder)
        : 0;

  const days =
    form.startDate && form.endDate && !problems.dateOrder
      ? Math.round(
          (new Date(`${form.endDate}T00:00:00`).getTime() - new Date(`${form.startDate}T00:00:00`).getTime()) /
            86_400_000,
        ) + 1
      : null;

  const fmtDate = (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00`), { day: "numeric", month: "short", year: "numeric" });

  const copyCode = async () => {
    if (!form.code) return;
    try {
      await navigator.clipboard.writeText(form.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refused (insecure origin): nothing to undo.
    }
  };

  const save = () => {
    setTriedSave(true);
    props.onSave();
  };

  const conditions = [
    minOrder > 0 ? t("conditions.minOrder", { amount: formatPrice(minOrder) }) : t("conditions.noMinimum"),
    form.type === "percentage" && cap > 0 ? t("conditions.cap", { amount: formatPrice(cap) }) : null,
    form.usageLimit ? t("conditions.totalUses", { count: Number(form.usageLimit) }) : null,
    form.perUserLimit ? t("conditions.perCustomer", { count: Number(form.perUserLimit) }) : null,
  ].filter(Boolean) as string[];

  const err = (flag: boolean) => triedSave && flag;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b px-5 py-4 sm:px-6">
          <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm", style.ticket)}>
            <TicketPercent className="size-5" />
          </span>
          <div className="min-w-0 pr-8">
            <DialogTitle className="text-lg font-extrabold tracking-tight">
              {editing ? t("titleEdit") : t("titleCreate")}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{t("subtitle")}</DialogDescription>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden">
          {/* Form */}
          <div className="space-y-4 bg-muted/30 p-4 sm:p-6 lg:overflow-y-auto">
            {/* 1. Code */}
            <Section step={1} icon={<TicketPercent />} title={t("code.title")} hint={t("code.hint")}>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Input
                      id="discount-code"
                      value={form.code}
                      onChange={(e) => setField("code", e.target.value.toUpperCase().replace(/\s+/g, ""))}
                      placeholder="SUMMER10"
                      disabled={editing}
                      maxLength={40}
                      aria-invalid={err(problems.code) || undefined}
                      className="h-12 rounded-xl pr-10 font-mono text-lg font-bold tracking-[0.15em] uppercase"
                    />
                    {form.code ? (
                      <button
                        type="button"
                        onClick={() => void copyCode()}
                        aria-label={t("code.copy")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                      </button>
                    ) : null}
                  </div>
                  {!editing ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 gap-1.5 rounded-xl"
                      onClick={() => setField("code", generateCode(form.code.match(/^[A-Z]+/)?.[0]?.slice(0, 6) ?? ""))}
                    >
                      <Wand2 className="size-4" />
                      <span className="hidden sm:inline">{t("code.generate")}</span>
                    </Button>
                  ) : null}
                </div>
                {err(problems.code) ? <p className="text-xs text-destructive">{t("errors.code")}</p> : null}
                {editing ? <p className="text-xs text-muted-foreground">{t("code.locked")}</p> : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="discount-label" className="text-xs">{t("code.label")}</Label>
                    <Input
                      id="discount-label"
                      value={form.label}
                      onChange={(e) => setField("label", e.target.value)}
                      placeholder={t("code.labelPlaceholder")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="discount-description" className="text-xs">{t("code.note")}</Label>
                    <Textarea
                      id="discount-description"
                      rows={1}
                      className="min-h-9 resize-none"
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      placeholder={t("code.notePlaceholder")}
                    />
                  </div>
                </div>
              </div>
            </Section>

            {/* 2. Discount */}
            <Section step={2} icon={<Scissors />} title={t("value.title")}>
              <div role="radiogroup" aria-label={t("value.title")} className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {(["percentage", "fixed", "free_shipping"] as const).map((type) => {
                  const Icon = TYPE_STYLE[type].icon;
                  const active = form.type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setType(type)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-2.5 text-center transition sm:flex-row sm:gap-3 sm:p-3 sm:text-left",
                        active ? TYPE_STYLE[type].ring : "bg-background hover:border-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg",
                          active ? TYPE_STYLE[type].tile : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold sm:text-sm">{t(`types.${type}`)}</span>
                        <span className="hidden text-[11px] leading-tight text-muted-foreground sm:block">
                          {t(`types.${type}Hint`)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {form.type !== "free_shipping" ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="discount-value" className="text-xs">
                      {form.type === "percentage" ? t("value.percent") : t("value.amount")}
                    </Label>
                    <CurrencyInput
                      id="discount-value"
                      currencySymbol={form.type === "percentage" ? "%" : currencySymbol}
                      min="0"
                      max={form.type === "percentage" ? "100" : undefined}
                      step="0.01"
                      value={form.value}
                      onChange={(e) => setField("value", e.target.value)}
                      placeholder={form.type === "percentage" ? "10" : "100"}
                      aria-invalid={err(problems.value) || problems.percentTooHigh || undefined}
                      className="h-11 rounded-xl text-base font-bold"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {(form.type === "percentage" ? [5, 10, 15, 20, 30, 50] : [50, 100, 200, 500, 1000]).map((preset) => (
                        <Chip key={preset} active={value === preset} onClick={() => setField("value", String(preset))}>
                          {form.type === "percentage" ? `${preset}%` : formatPrice(preset)}
                        </Chip>
                      ))}
                    </div>
                    {problems.percentTooHigh ? (
                      <p className="text-xs text-destructive">{t("errors.percentTooHigh")}</p>
                    ) : err(problems.value) ? (
                      <p className="text-xs text-destructive">{t("errors.value")}</p>
                    ) : null}
                  </div>
                  {form.type === "percentage" ? (
                    <div className="space-y-2">
                      <Label htmlFor="discount-max" className="text-xs">{t("value.cap")}</Label>
                      <CurrencyInput
                        id="discount-max"
                        currencySymbol={currencySymbol}
                        min="0"
                        step="0.01"
                        value={form.maxDiscount}
                        onChange={(e) => setField("maxDiscount", e.target.value)}
                        placeholder={t("unlimited")}
                        className="h-11 rounded-xl"
                      />
                      <p className="text-xs text-muted-foreground">{t("value.capHint")}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/[0.06] px-3 py-2 text-xs text-sky-800 dark:text-sky-300">
                  <Truck className="size-3.5 shrink-0" />
                  {t("value.freeShippingNote")}
                </p>
              )}
            </Section>

            {/* 3. Conditions */}
            <Section step={3} icon={<ShoppingBag />} title={t("rules.title")} hint={t("rules.hint")}>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="discount-min-order" className="flex items-center gap-1.5 text-xs">
                    <ShoppingBag className="size-3.5 text-muted-foreground" />
                    {t("rules.minOrder")}
                  </Label>
                  <CurrencyInput
                    id="discount-min-order"
                    currencySymbol={currencySymbol}
                    min="0"
                    step="0.01"
                    value={form.minOrderAmount}
                    onChange={(e) => setField("minOrderAmount", e.target.value)}
                    placeholder={t("rules.noMinimum")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="discount-usage-limit" className="flex items-center gap-1.5 text-xs">
                    <Repeat className="size-3.5 text-muted-foreground" />
                    {t("rules.totalUses")}
                  </Label>
                  <Input
                    id="discount-usage-limit"
                    type="number"
                    min="1"
                    step="1"
                    value={form.usageLimit}
                    onChange={(e) => setField("usageLimit", e.target.value)}
                    placeholder={t("unlimited")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="discount-user-limit" className="flex items-center gap-1.5 text-xs">
                    <Users className="size-3.5 text-muted-foreground" />
                    {t("rules.perCustomer")}
                  </Label>
                  <Input
                    id="discount-user-limit"
                    type="number"
                    min="1"
                    step="1"
                    value={form.perUserLimit}
                    onChange={(e) => setField("perUserLimit", e.target.value)}
                    placeholder={t("unlimited")}
                  />
                </div>
              </div>
            </Section>

            {/* 4. Dates */}
            <Section
              step={4}
              icon={<CalendarRange />}
              title={t("dates.title")}
              aside={
                days ? (
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums">
                    {t("dates.days", { count: days })}
                  </span>
                ) : null
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="discount-start-date" className="text-xs">{t("dates.start")}</Label>
                  <Input
                    id="discount-start-date"
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setField("startDate", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="discount-end-date" className="text-xs">{t("dates.end")}</Label>
                  <Input
                    id="discount-end-date"
                    type="date"
                    min={form.startDate || undefined}
                    value={form.endDate}
                    onChange={(e) => setField("endDate", e.target.value)}
                    aria-invalid={err(problems.endDate) || problems.dateOrder || undefined}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(
                  [
                    ["d7", addDays(form.startDate, 6)],
                    ["d14", addDays(form.startDate, 13)],
                    ["d30", addDays(form.startDate, 29)],
                    ["monthEnd", endOfMonth(form.startDate)],
                  ] as const
                ).map(([key, end]) => (
                  <Chip key={key} active={form.endDate === end} onClick={() => setField("endDate", end)}>
                    {t(`dates.presets.${key}`)}
                  </Chip>
                ))}
              </div>
              {problems.dateOrder ? (
                <p className="mt-2 text-xs text-destructive">{t("errors.dateOrder")}</p>
              ) : err(problems.endDate) ? (
                <p className="mt-2 text-xs text-destructive">{t("errors.endDate")}</p>
              ) : null}
            </Section>

            {/* 5. Funding — store coupons only */}
            {isStoreCoupon ? (
              <Section step={5} icon={<HandCoins />} title={t("funding.title")} hint={t("funding.hint")}>
                <div role="radiogroup" aria-label={t("funding.title")} className="grid gap-2.5 sm:grid-cols-2">
                  {(
                    [
                      ["platform", Store],
                      ["vendor", Users],
                    ] as const
                  ).map(([who, Icon]) => {
                    const active = form.fundedBy === who;
                    return (
                      <button
                        key={who}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setField("fundedBy", who)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-3 text-left transition",
                          active
                            ? "border-amber-500 bg-amber-500/[0.06] ring-1 ring-amber-500/30"
                            : "bg-background hover:border-foreground/30",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg",
                            active ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">
                            {who === "platform"
                              ? t("funding.store")
                              : form.type === "free_shipping"
                                ? t("funding.vendorShipping")
                                : t("funding.vendor")}
                          </span>
                          <span className="block text-[11px] leading-snug text-muted-foreground">
                            {who === "platform"
                              ? form.type === "free_shipping"
                                ? t("funding.storeShippingHint")
                                : t("funding.storeHint")
                              : t("funding.vendorHint")}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Section>
            ) : null}

            {/* 6. Status & visibility */}
            <Section
              step={isStoreCoupon ? 6 : 5}
              icon={<Sparkles />}
              title={t("status.title")}
            >
              <div className="space-y-3">
                <div className="inline-flex flex-wrap gap-1 rounded-full border bg-background p-1">
                  {(["active", "inactive", "expired"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={form.status === status}
                      onClick={() => setField("status", status)}
                      className={cn(
                        "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                        form.status === status ? STATUS_STYLE[status] : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t(`status.${status}`)}
                    </button>
                  ))}
                </div>
                <div
                  className={cn(
                    "flex items-start justify-between gap-4 rounded-xl border p-3",
                    form.listed && "border-emerald-500/30 bg-emerald-500/[0.04]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        form.listed ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {form.listed ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    </span>
                    <div className="space-y-0.5">
                      <Label htmlFor="discount-listed" className="text-sm font-semibold">
                        {t("status.listed")}
                      </Label>
                      <p className="text-xs text-muted-foreground">{t("status.listedHint")}</p>
                    </div>
                  </div>
                  <Switch
                    id="discount-listed"
                    checked={form.listed}
                    onCheckedChange={(checked) => setField("listed", checked)}
                  />
                </div>
              </div>
            </Section>
          </div>

          {/* Live preview */}
          <aside className="order-first space-y-4 border-b bg-background p-4 sm:p-6 lg:order-none lg:overflow-y-auto lg:border-b-0 lg:border-l">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("preview.title")}
            </p>

            {/* The coupon, as it is handed to the shopper */}
            <OtopCouponCard
              tone={form.type === "percentage" ? "lac" : form.type === "fixed" ? "indigo" : "leaf"}
              headline={headline}
              label={form.label.trim() || t(`types.${form.type}`)}
              statusLabel={t(`status.${form.status}`)}
              statusActive={form.status === "active"}
              code={form.code}
              condition={
                minOrder > 0
                  ? t("conditions.minOrder", { amount: formatPrice(minOrder) })
                  : t("conditions.noMinimum")
              }
              validity={form.endDate ? t("preview.until", { date: fmtDate(form.endDate) }) : t("preview.noEnd")}
              footer={t("preview.storeLine", { store: storeName })}
            />

            {/* Worked example */}
            {sampleDiscount > 0 ? (
              <div className="rounded-2xl border bg-muted/30 p-4">
                <p className="mb-2 text-xs font-semibold">{t("preview.exampleTitle")}</p>
                <dl className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">{t("preview.subtotal")}</dt>
                    <dd className="tabular-nums">{formatPrice(sampleOrder)}</dd>
                  </div>
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <dt>{t("preview.discount")}</dt>
                    <dd className="tabular-nums">−{formatPrice(sampleDiscount)}</dd>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-bold">
                    <dt>{t("preview.total")}</dt>
                    <dd className="tabular-nums">{formatPrice(sampleOrder - sampleDiscount)}</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            {/* Summary */}
            <ul className="space-y-1.5 text-xs">
              {conditions.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                  {line}
                </li>
              ))}
              {form.startDate && form.endDate && !problems.dateOrder ? (
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                  {t("conditions.dates", { start: fmtDate(form.startDate), end: fmtDate(form.endDate) })}
                </li>
              ) : null}
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                {form.listed ? t("conditions.listed") : t("conditions.hidden")}
              </li>
            </ul>

            {blocking ? (
              <div className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs text-amber-800 dark:text-amber-300">
                <p className="flex items-center gap-1.5 font-semibold">
                  <CircleAlert className="size-3.5" />
                  {t("preview.todo")}
                </p>
                <ul className="list-disc space-y-0.5 pl-5">
                  {problems.code ? <li>{t("errors.code")}</li> : null}
                  {problems.value ? <li>{t("errors.value")}</li> : null}
                  {problems.percentTooHigh ? <li>{t("errors.percentTooHigh")}</li> : null}
                  {problems.endDate ? <li>{t("errors.endDate")}</li> : null}
                  {problems.dateOrder ? <li>{t("errors.dateOrder")}</li> : null}
                </ul>
              </div>
            ) : null}

            <p className="text-[11px] leading-relaxed text-muted-foreground">{t("preview.footnote")}</p>
          </aside>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t bg-background px-5 py-3.5 sm:px-6">
          <Button type="button" variant="ghost" className="rounded-full" onClick={props.onCancel} disabled={saving}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={saving || problems.percentTooHigh || problems.dateOrder}
            className="gap-2 rounded-full bg-emerald-600 px-5 text-white hover:bg-emerald-700"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {saving ? t("saving") : editing ? t("update") : t("create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
