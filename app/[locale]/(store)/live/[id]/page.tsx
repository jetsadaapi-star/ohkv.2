import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { LiveRoomView } from "@/components/live/live-room-view";
import { getLiveRoom } from "@/lib/live/live-service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const room = await getLiveRoom(id).catch(() => null);
  if (!room) return {};
  return {
    title: `${room.title} · ${room.store.name}`,
    description: room.description || room.title,
    openGraph: room.coverUrl || room.productImages[0] ? { images: [room.coverUrl || room.productImages[0]] } : undefined,
  };
}

/** Watch one live: the stream, chat, hearts and the products on sale. */
export default async function LiveRoomPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const room = await getLiveRoom(id).catch(() => null);
  if (!room) notFound();
  return (
    <div className="container mx-auto px-2 py-4 sm:px-4 lg:py-6">
      <LiveRoomView room={room} />
    </div>
  );
}
