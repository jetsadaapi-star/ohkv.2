"use client";

import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/ui/status-badge";

export type TransferStatus =
  | "draft"
  | "ready_to_ship"
  | "in_transit"
  | "completed"
  | "cancelled";

/**
 * A transfer's status in the shared palette (lib/ui/status-palette): a draft
 * grey, ready to ship amber, on the road indigo, received green, called off red.
 */
export function TransferStatusBadge({ status }: { status: TransferStatus }) {
  const t = useTranslations();
  return <StatusBadge status={status}>{t(`admin.transfers.status.${status}`)}</StatusBadge>;
}
