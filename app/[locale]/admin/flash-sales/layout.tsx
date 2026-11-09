import { requireAdminArea } from "@/lib/access/admin-page-guard";

/** Opens /admin/flash-sales to the team roles that reach marketing. */
export default async function AdminFlashSalesAreaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdminArea(locale, "/admin/flash-sales");
  return children;
}
