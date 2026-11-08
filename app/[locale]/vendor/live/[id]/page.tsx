import { setRequestLocale } from "next-intl/server";
import { VENDOR_PERMISSIONS } from "@/config/permissions.config";
import { requireVendorAreaAccess } from "@/lib/access/vendor-area-guard";
import { LiveStudio } from "@/components/live/live-studio";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

/** The control room for one live: camera, go live, pin products, chat. */
export default async function VendorLiveStudioPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireVendorAreaAccess({ locale, required: [VENDOR_PERMISSIONS.EDIT_PRODUCTS] });
  return <LiveStudio liveId={id} />;
}
