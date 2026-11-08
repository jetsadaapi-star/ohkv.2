"use client";

import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { VendorTabProps } from "../vendor-detail-types";

const NOTES_MAX = 5000;

export function NotesTab({ form, setField, readOnly }: VendorTabProps) {
  const t = useTranslations("admin.hc.vendorNotesTab");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {t("description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          value={form.notes}
          onChange={(e) => setField("notes", e.target.value)}
          placeholder={t("placeholder")}
          rows={10}
          maxLength={NOTES_MAX}
          disabled={readOnly}
        />
        <p className="mt-2 text-right text-xs text-muted-foreground">
          {form.notes.length}/{NOTES_MAX}
        </p>
      </CardContent>
    </Card>
  );
}
