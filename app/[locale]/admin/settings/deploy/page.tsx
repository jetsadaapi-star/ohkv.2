import { setRequestLocale } from "next-intl/server";
import { DeployPanel } from "@/components/admin/settings/deploy/deploy-panel";
import { requireAdminPageAccess } from "@/lib/access/admin-page-guard";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminDeployPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireAdminPageAccess(locale);
  return <DeployPanel />;
}
