import { requireAdminArea } from "@/lib/access/admin-page-guard";

/**
 * Opens /admin/settings/deploy to the administrators whose team role holds
 * sensitive settings (lib/access/team-route-permissions.ts): a deploy
 * rebuilds and restarts the store.
 */
export default async function AdminSettingsDeployAreaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdminArea(locale, "/admin/settings/deploy");
  return children;
}
