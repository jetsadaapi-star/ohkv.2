import { requireAdminArea } from "@/lib/access/admin-page-guard";

/** Opens /admin/clips to the administrators whose team role reaches the catalogue. */
export default async function AdminClipsAreaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireAdminArea(locale, "/admin/clips");
  return children;
}
