import { NextResponse } from "next/server";
import { authorizeMedia, MediaAuthSchema } from "@/lib/live/live-service";

/**
 * POST /api/live/media-auth — asked by the media server (docker/mediamtx.yml)
 * before every publish and read. 200 allows, 401 refuses. Holds no secret of
 * its own: publishing needs the live's stream key, reading needs the live on air.
 */
export async function POST(request: Request) {
  try {
    const parsed = MediaAuthSchema.safeParse(await request.json());
    if (parsed.success && (await authorizeMedia(parsed.data))) {
      return new NextResponse(null, { status: 200 });
    }
  } catch {
    // Refused below.
  }
  return new NextResponse(null, { status: 401 });
}
