import { setRequestLocale } from "next-intl/server";
import { requireAdminPageAccess } from "@/lib/access/admin-page-guard";
import { LiveManager } from "@/components/live/live-manager";

interface PageProps {
  params: Promise<{ locale: string }>;
}

/** Every store's lives: what is on air, and taking a live off air. */
export default async function AdminLivePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPageAccess(locale);
  return <LiveManager mode="admin" />;
}
