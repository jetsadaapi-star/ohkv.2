"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast-notification";
import { formatCurrency } from "@/lib/intl/money";
import {
  REFUND_DESTINATION_METHODS,
  getRefundDestinationLabel,
  getRefundDestinationRequiredFields,
} from "@/lib/returns/refund-settlement";
import { RETURN_REASONS } from "@/lib/returns/returns";
import type { ReturnMethod } from "@/lib/returns/return-shipping";

/** What `GET /api/<scope>/returns/new?orderId=` answers with. */
interface OpenReturnContext {
  problem: string | null;
  canOverride: boolean;
  settlesOutOfBand: boolean;
  currency: string;
  lines: Array<{
    orderItemIndex: number;
    name: string;
    ordered: number;
    returnable: number;
    blockedBy: "not_yours" | "digital" | "cancelled" | "not_delivered" | "unpaid" | null;
    windowClosed: boolean;
    finalSale: boolean;
  }>;
}

type OpenReturnDialogProps = {
  scope: "admin" | "vendor";
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpened: () => void;
};

const REASON_LABELS: Record<string, string> = {
  wrong_size_or_variant: "reasonWrongSizeOrVariant",
  damaged_or_defective: "reasonDamagedOrDefective",
  not_as_described: "reasonNotAsDescribed",
  wrong_item_received: "reasonWrongItemReceived",
  arrived_late: "reasonArrivedLate",
  changed_mind: "reasonChangedMind",
  other: "reasonOther",
};

const BLOCK_NOTES: Record<string, string> = {
  not_yours: "blockNotYours",
  digital: "blockDigital",
  cancelled: "blockCancelled",
  not_delivered: "blockNotDelivered",
  unpaid: "blockUnpaid",
};

function destinationPlaceholder(
  method: string,
  field: string,
  t: (key: string) => string,
): string {
  const mobile = method === "mobile_money";
  if (field === "provider") return mobile ? t("phMobileProvider") : t("phBankName");
  if (field === "accountNumber") return mobile ? t("phMobileNumber") : t("phAccountNumber");
  if (field === "accountName") return t("phAccountName");
  return field;
}

/** A line only an override opens: past the return window, or final sale. */
function outsideRules(line: { windowClosed: boolean; finalSale: boolean }) {
  return line.windowClosed || line.finalSale;
}

const METHODS: Array<{ key: ReturnMethod; title: string; detail: string }> = [
  {
    key: "customer_ships",
    title: "methodCustomerShipsTitle",
    detail: "methodCustomerShipsDetail",
  },
  {
    key: "label",
    title: "methodLabelTitle",
    detail: "methodLabelDetail",
  },
  {
    key: "no_shipping",
    title: "methodNoShippingTitle",
    detail: "methodNoShippingDetail",
  },
];

/**
 * Opening a return for a shopper who asked by phone, email or chat. It is
 * approved as it opens, with how the parcel comes back, as Shopify's
 * merchant-created returns are. The same dialog for the store and for a
 * seller; a seller only sees their own lines as returnable.
 */
export function OpenReturnDialog(props: OpenReturnDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92dvh] grid-cols-1 overflow-y-auto sm:max-w-xl">
        {/* Mounted with the dialog, so every opening starts clean and loads
            what is returnable now — that moves with every refund and return
            on the order. */}
        <OpenReturnForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function OpenReturnForm({ scope, orderId, onOpenChange, onOpened }: OpenReturnDialogProps) {
  const t = useTranslations("admin.hc.openReturnDialog");
  const [context, setContext] = useState<OpenReturnContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<ReturnMethod>("customer_ships");
  const [labelUrl, setLabelUrl] = useState("");
  const [override, setOverride] = useState(false);
  const [overrideNote, setOverrideNote] = useState("");
  const [destination, setDestination] = useState({
    method: "",
    accountName: "",
    accountNumber: "",
    provider: "",
  });
  const [priced, setPriced] = useState<{
    key: string;
    total?: number;
    currency?: string;
    error?: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/${scope}/returns/new?orderId=${encodeURIComponent(orderId)}`,
        );
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) throw new Error(data?.message || "");
        if (!cancelled) setContext(data.data as OpenReturnContext);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            (error instanceof Error && error.message) || t("errorLoadOrder"),
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, orderId]);

  // Only the lines that can be chosen right now: unticking the override drops
  // the ones it had opened up.
  const selected = useMemo(
    () =>
      (context?.lines || [])
        .filter((line) => !line.blockedBy && (override || !outsideRules(line)))
        .map((line) => ({
          orderItemIndex: line.orderItemIndex,
          quantity: Math.min(
            line.returnable,
            Math.max(0, Math.floor(Number(quantities[line.orderItemIndex] || 0))),
          ),
          outsideRules: outsideRules(line),
        }))
        .filter((line) => line.quantity > 0),
    [context, quantities, override],
  );
  const needsOverride = selected.some((line) => line.outsideRules);
  // The lines only an override opens, and what keeps them shut.
  const heldLines = (context?.lines || []).filter(
    (line) => outsideRules(line) && !line.blockedBy && line.returnable > 0,
  );
  const anyPastWindow = heldLines.some((line) => line.windowClosed);
  const anyFinalSale = heldLines.some((line) => line.finalSale);
  // Every line already back, refunded, someone else's or out of reach: the
  // lines say why, and the rest of the form has nothing to act on.
  const nothingToOpen = !(context?.lines || []).some(
    (line) =>
      !line.blockedBy &&
      line.returnable > 0 &&
      (!outsideRules(line) || context?.canOverride),
  );
  const items = selected.map(({ orderItemIndex, quantity }) => ({
    orderItemIndex,
    quantity,
  }));
  const previewKey =
    context && !context.problem && items.length > 0 && reason
      ? JSON.stringify({ items, reason, override: needsOverride })
      : "";

  // The figure it would open at, priced by the same planner that opens it.
  useEffect(() => {
    if (!previewKey) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/${scope}/returns/new`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, ...JSON.parse(previewKey) }),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        setPriced(
          res.ok && data?.success
            ? { key: previewKey, total: data.data.total, currency: data.data.currency }
            : { key: previewKey, error: data?.message || t("errorPrice") },
        );
      } catch {
        if (!cancelled) {
          setPriced({ key: previewKey, error: t("errorPrice") });
        }
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [previewKey, scope, orderId]);
  const preview = previewKey && priced?.key === previewKey ? priced : null;

  const submit = async () => {
    if (items.length === 0) {
      toast.error(t("toastChooseItem"));
      return;
    }
    if (!reason) {
      toast.error(t("toastChooseReason"));
      return;
    }
    if (reason === "other" && !note.trim()) {
      toast.error(t("toastWriteNote"));
      return;
    }
    if (needsOverride && overrideNote.trim().length < 3) {
      toast.error(t("toastOverrideNote"));
      return;
    }
    if (method === "label" && !labelUrl.trim()) {
      toast.error(t("toastLabelLink"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/${scope}/returns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reason,
          customerNote: note.trim() || undefined,
          items,
          returnMethod: method,
          ...(method === "label" ? { labelUrl: labelUrl.trim() } : {}),
          ...(needsOverride ? { eligibilityOverride: { note: overrideNote.trim() } } : {}),
          ...(context?.settlesOutOfBand && destination.method
            ? {
                refundDestination: {
                  method: destination.method,
                  accountName: destination.accountName.trim() || undefined,
                  accountNumber: destination.accountNumber.trim() || undefined,
                  provider: destination.provider.trim() || undefined,
                },
              }
            : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.message || "");
      const opened = Array.isArray(data.data) ? data.data : [data.data];
      toast.success(
        t("toastOpened", {
          numbers: opened.map((doc: { returnNumber?: string }) => doc.returnNumber).join(", "),
        }),
      );
      onOpenChange(false);
      onOpened();
    } catch (error) {
      toast.error((error instanceof Error && error.message) || t("errorOpen"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : !context ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
        </div>
      ) : context.problem ? (
        <p className="text-sm text-muted-foreground">{context.problem}</p>
      ) : (
        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <span className="text-sm font-medium">{t("whatComesBack")}</span>
            <div className="divide-y rounded-md border">
              {context.lines.map((line) => {
                const disabled =
                  Boolean(line.blockedBy) ||
                  line.returnable <= 0 ||
                  (outsideRules(line) && !override);
                const held = [
                  line.finalSale ? t("heldFinalSale") : null,
                  line.windowClosed ? t("heldPastWindow") : null,
                ].filter(Boolean);
                const lineNote = line.blockedBy
                  ? t(BLOCK_NOTES[line.blockedBy])
                  : line.returnable <= 0
                    ? t("alreadyReturned")
                    : held.length > 0
                      ? t("lineHeld", {
                          returnable: line.returnable,
                          ordered: line.ordered,
                          held: held.join(", "),
                        })
                      : t("lineCanReturn", {
                          returnable: line.returnable,
                          ordered: line.ordered,
                        });
                return (
                  <div
                    key={line.orderItemIndex}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">{lineNote}</p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={line.returnable}
                      step={1}
                      disabled={disabled}
                      aria-label={t("quantityOf", { name: line.name })}
                      className="w-20"
                      value={disabled ? "" : (quantities[line.orderItemIndex] ?? "")}
                      placeholder="0"
                      onChange={(event) =>
                        setQuantities((current) => ({
                          ...current,
                          [line.orderItemIndex]: event.target.value,
                        }))
                      }
                    />
                  </div>
                );
              })}
            </div>
            {heldLines.length > 0 && !context.canOverride ? (
              <p className="text-xs text-muted-foreground">
                {anyPastWindow && anyFinalSale
                  ? t("onlyStorePastWindowOrFinalSale")
                  : anyFinalSale
                    ? t("onlyStoreFinalSale")
                    : t("onlyStorePastWindow")}
              </p>
            ) : null}
          </div>

          {nothingToOpen ? (
            <p className="text-sm text-muted-foreground">
              {t("nothingToOpen")}
            </p>
          ) : (
            <>
              {context.canOverride && heldLines.length > 0 ? (
                <div className="grid gap-2">
                  <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                    <Checkbox
                      checked={override}
                      onCheckedChange={(value) => setOverride(value === true)}
                      className="mt-0.5"
                    />
                    <span>
                      {anyPastWindow && anyFinalSale
                        ? t("overrideOutsideRules")
                        : anyFinalSale
                          ? t("overrideFinalSale")
                          : t("overridePastWindow")}
                    </span>
                  </label>
                  {override ? (
                    <Textarea
                      value={overrideNote}
                      maxLength={500}
                      onChange={(event) => setOverrideNote(event.target.value)}
                      placeholder={t("overrideNotePlaceholder")}
                    />
                  ) : null}
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="open-return-reason">{t("reasonLabel")}</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger id="open-return-reason" className="w-full">
                      <SelectValue placeholder={t("reasonPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {RETURN_REASONS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {REASON_LABELS[key] ? t(REASON_LABELS[key]) : key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="open-return-note">
                    {t("noteLabel")}{" "}
                    {reason === "other" ? null : (
                      <span className="font-normal text-muted-foreground">{t("optional")}</span>
                    )}
                  </Label>
                  <Input
                    id="open-return-note"
                    value={note}
                    maxLength={1000}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t("notePlaceholder")}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-medium">{t("howItComesBack")}</span>
                <div role="radiogroup" className="divide-y rounded-md border">
                  {METHODS.map((choice) => {
                    const active = method === choice.key;
                    return (
                      <button
                        key={choice.key}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setMethod(choice.key)}
                        className="flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                            active ? "border-primary" : "border-muted-foreground/40"
                          }`}
                        >
                          {active ? <span className="size-2 rounded-full bg-primary" /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium">{t(choice.title)}</span>
                          <span className="block text-xs text-muted-foreground">
                            {t(choice.detail)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {method === "label" ? (
                  <Input
                    type="url"
                    placeholder={t("labelUrlPlaceholder")}
                    value={labelUrl}
                    onChange={(event) => setLabelUrl(event.target.value)}
                  />
                ) : null}
                {method !== "no_shipping" ? (
                  <p className="text-xs text-muted-foreground">
                    {t("returnLocationHint")}
                  </p>
                ) : null}
              </div>

              {context.settlesOutOfBand ? (
                <div className="grid gap-2">
                  <span className="text-sm font-medium">
                    {t("refundDestinationTitle")}{" "}
                    <span className="font-normal text-muted-foreground">{t("optional")}</span>
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {t("refundDestinationHint")}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select
                      value={destination.method}
                      onValueChange={(value) =>
                        setDestination((current) => ({ ...current, method: value }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("refundMethodPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {REFUND_DESTINATION_METHODS.map((key) => (
                          <SelectItem key={key} value={key}>
                            {getRefundDestinationLabel(key)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {getRefundDestinationRequiredFields(destination.method).map((field) => (
                      <Input
                        key={field}
                        placeholder={destinationPlaceholder(destination.method, field, t)}
                        value={String(destination[field as keyof typeof destination] || "")}
                        onChange={(event) =>
                          setDestination((current) => ({
                            ...current,
                            [field]: event.target.value,
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {preview?.error ? (
                <p className="text-sm text-destructive">{preview.error}</p>
              ) : preview ? (
                <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{t("estimatedRefund")}</span>
                  <span className="font-medium">
                    {formatCurrency(Number(preview.total || 0), preview.currency || context.currency)}
                  </span>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
        <Button
          disabled={submitting || !context || Boolean(context.problem) || nothingToOpen}
          onClick={() => void submit()}
        >
          {submitting ? t("opening") : t("openReturn")}
        </Button>
      </DialogFooter>
    </>
  );
}
