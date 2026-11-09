"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Gift, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCurrency } from "@/providers/currency-provider";
import { GIFT_MESSAGE_MAX, type GiftWrapConfig } from "@/lib/orders/gift-wrap";
import { cn } from "@/lib/utils";

/**
 * "Wrap it as a gift" at checkout, with a message for the recipient. The
 * choice is saved on the cart, and `onChange` asks the page to re-quote
 * delivery, which is where the fee is (per parcel).
 */
export function GiftWrapCard({ onChange, parcels }: { onChange: () => void; parcels: number }) {
  const t = useTranslations("checkout.giftWrap");
  const { formatPrice } = useCurrency();
  const [config, setConfig] = useState<GiftWrapConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/cart/gift-wrap")
      .then((response) => response.json())
      .then((body) => {
        if (!alive || !body?.success) return;
        setConfig(body.data.config);
        setEnabled(Boolean(body.data.giftWrap?.enabled));
        setMessage(body.data.giftWrap?.message ?? "");
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const save = async (next: { enabled: boolean; message: string }) => {
    setBusy(true);
    try {
      const response = await fetch("/api/cart/gift-wrap", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next.enabled, message: next.message.trim() || undefined }),
      });
      if (response.ok) onChange();
    } finally {
      setBusy(false);
    }
  };

  if (!config?.enabled) return null;

  const toggle = (value: boolean) => {
    setEnabled(value);
    void save({ enabled: value, message });
  };

  const typeMessage = (value: string) => {
    setMessage(value);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void save({ enabled: true, message: value }), 700);
  };

  return (
    <section
      className={cn(
        "rounded-2xl border p-4 transition",
        enabled && "border-[color-mix(in_oklab,var(--highlight)_60%,transparent)] bg-[color-mix(in_oklab,var(--highlight)_8%,transparent)]",
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Gift className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t("title")}</span>
          <span className="block text-sm text-muted-foreground">
            {config.fee > 0
              ? parcels > 1
                ? t("feeParcels", { fee: formatPrice(config.fee), parcels })
                : t("fee", { fee: formatPrice(config.fee) })
              : t("free")}
          </span>
        </span>
        {busy ? <Loader2 className="mt-1 size-4 animate-spin text-muted-foreground" /> : null}
        <Switch checked={enabled} onCheckedChange={toggle} aria-label={t("title")} />
      </label>
      {enabled && config.allowMessage ? (
        <div className="mt-3 space-y-1">
          <Textarea
            value={message}
            maxLength={GIFT_MESSAGE_MAX}
            rows={2}
            placeholder={t("messagePlaceholder")}
            onChange={(event) => typeMessage(event.target.value)}
            aria-label={t("message")}
          />
          <p className="text-end text-xs text-muted-foreground">
            {message.length}/{GIFT_MESSAGE_MAX}
          </p>
        </div>
      ) : null}
    </section>
  );
}
