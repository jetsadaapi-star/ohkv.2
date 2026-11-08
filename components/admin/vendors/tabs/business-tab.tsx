"use client";

import { AlertTriangle, Landmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SectionCard } from "@/components/admin/customers/section-card";
import { RequiredLegend } from "@/components/admin/ui/required-mark";
import { BankAccountEditor } from "@/components/banks/bank-account-editor";
import type { VendorTabProps } from "../vendor-detail-types";

/** What a payout run needs before the money has anywhere to go. */
const REQUIRED_BANK_FIELDS = [
  ["bankAccountName", "missingAccountName"],
  ["bankAccountNumber", "missingAccountNumber"],
  ["bankName", "missingBankName"],
] as const;

export function BusinessTab({ form, setField, readOnly }: VendorTabProps) {
  const t = useTranslations("admin.hc.businessTab");
  const tv = useTranslations("admin.hc.vendorPage");
  // Nothing in the payout flow reads these fields, so an incomplete account
  // never blocks a payout from being recorded — it just means the recorded
  // payout has no destination. Saying so here is the only warning there is.
  const missing = REQUIRED_BANK_FIELDS.filter(
    ([key]) => !String(form[key] || "").trim(),
  ).map(([, labelKey]) => t(labelKey));

  return (
    <SectionCard icon={Landmark} tone="emerald" title={t("title")} description={t("description")}>
      <div className="space-y-5">
        <RequiredLegend text={tv("requiredLegend")} />
        {missing.length > 0 && (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t("incompleteTitle")}</AlertTitle>
            <AlertDescription>
              {t("incompleteDescription", { fields: missing.join(", ") })}
            </AlertDescription>
          </Alert>
        )}
        <BankAccountEditor
          idPrefix="vendor-bank"
          disabled={readOnly}
          value={{
            bankName: form.bankName,
            accountName: form.bankAccountName,
            accountNumber: form.bankAccountNumber,
            routingNumber: form.bankRoutingNumber,
            swiftCode: form.bankSwiftCode,
          }}
          onChange={(patch) => {
            if (patch.bankName !== undefined) setField("bankName", patch.bankName);
            if (patch.accountName !== undefined) setField("bankAccountName", patch.accountName);
            if (patch.accountNumber !== undefined) setField("bankAccountNumber", patch.accountNumber);
            if (patch.routingNumber !== undefined) setField("bankRoutingNumber", patch.routingNumber);
            if (patch.swiftCode !== undefined) setField("bankSwiftCode", patch.swiftCode);
          }}
        />
      </div>
    </SectionCard>
  );
}
