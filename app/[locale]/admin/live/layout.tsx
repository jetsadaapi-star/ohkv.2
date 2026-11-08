import { requireAdminArea } from "@/lib/access/admin-page-guard";

/** Opens /admin/live to the administrators whose team role reaches the catalogue. */
export default async function AdminLiveAreaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdminArea(locale, "/admin/live");
  return children;
}
