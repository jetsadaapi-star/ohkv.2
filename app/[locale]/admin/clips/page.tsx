import { setRequestLocale } from "next-intl/server";
import { requireAdminPageAccess } from "@/lib/access/admin-page-guard";
import { ClipsManager } from "@/components/clips/clips-manager";

interface PageProps {
  params: Promise<{ locale: string }>;
}

/** Every store's short clips: make one for any store, edit, or take one down. */
export default async function AdminClipsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPageAccess(locale);
  return <ClipsManager mode="admin" />;
}
