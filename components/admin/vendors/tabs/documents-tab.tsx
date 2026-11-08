"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminDocumentUploadField } from "../admin-document-upload-field";
import type { VendorTabProps } from "../vendor-detail-types";

export function DocumentsTab({ form, setField, readOnly }: VendorTabProps) {
  const t = useTranslations("admin.hc.vendorDocumentsTab");
  const DOC_HINT = t("docHint");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {t("description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AdminDocumentUploadField
            label={t("businessLicense")}
            hint={DOC_HINT}
            value={form.docBusinessLicense}
            onChange={(url) => setField("docBusinessLicense", url)}
            disabled={readOnly}
          />
          <AdminDocumentUploadField
            label={t("taxCertificate")}
            hint={DOC_HINT}
            value={form.docTaxCertificate}
            onChange={(url) => setField("docTaxCertificate", url)}
            disabled={readOnly}
          />
          <AdminDocumentUploadField
            label={t("governmentId")}
            hint={DOC_HINT}
            value={form.docGovernmentId}
            onChange={(url) => setField("docGovernmentId", url)}
            disabled={readOnly}
          />
          <div className="space-y-2">
            <Label htmlFor="vendor-doc-tax-id">{t("taxId")}</Label>
            <Input
              id="vendor-doc-tax-id"
              value={form.docTaxId}
              onChange={(e) => setField("docTaxId", e.target.value)}
              placeholder={t("taxIdPlaceholder")}
              disabled={readOnly}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
