"use client";

import { useTranslations } from "next-intl";
import { StickyNote } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "../section-card";
import type { CustomerTabProps } from "../customer-detail-types";

export function NotesTab({ form, setField, readOnly }: CustomerTabProps) {
  const t = useTranslations("admin.hc.customerDetail");
  return (
    <SectionCard icon={StickyNote} tone="amber" title={t("notesTitle")} description={t("notesDescription")}>
      <Textarea
        value={form.notes}
        onChange={(e) => setField("notes", e.target.value)}
        placeholder={t("notesPlaceholder")}
        rows={10}
        maxLength={2000}
        disabled={readOnly}
        className="rounded-xl"
      />
      <p className="mt-2 text-right text-xs text-muted-foreground">{form.notes.length}/2000</p>
    </SectionCard>
  );
}
