"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { THAI_CARRIERS, detectThaiCarrier, thaiCarrierFor } from "@/lib/shipping/thai-carriers";
import { cn } from "@/lib/utils";

/**
 * One tap to name the courier under a ship dialog's carrier field, and the
 * courier a typed tracking number can only belong to (Thailand Post's S10
 * numbers, KEX, Ninja Van) offered back before the merchant has to choose.
 * Picking writes the catalogue name, which is what turns into the customer's
 * tracking link.
 */
export function CarrierQuickPick({
  value,
  onChange,
  trackingNumber,
}: {
  value: string;
  onChange: (carrier: string) => void;
  trackingNumber?: string;
}) {
  const t = useTranslations("storeText.carrierPick");
  const selected = thaiCarrierFor(value);
  const detected = trackingNumber ? detectThaiCarrier(trackingNumber) : undefined;
  const suggest = detected && detected.id !== selected?.id ? detected : undefined;

  return (
    <div className="space-y-2">
      {suggest ? (
        <button
          type="button"
          onClick={() => onChange(suggest.name)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20 transition hover:bg-primary/15"
        >
          <Sparkles className="size-3.5" />
          {t("detected", { carrier: suggest.nameTh })}
        </button>
      ) : null}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("label")}>
        {THAI_CARRIERS.map((carrier) => {
          const active = selected?.id === carrier.id;
          return (
            <button
              key={carrier.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(carrier.name)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                active ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <span className="size-2.5 rounded-full ring-1 ring-black/10" style={{ background: carrier.color }} />
              {carrier.nameTh}
            </button>
          );
        })}
      </div>
    </div>
  );
}
