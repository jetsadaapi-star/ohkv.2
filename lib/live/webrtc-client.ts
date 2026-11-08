"use client";

/**
 * Minimal WHIP (publish) and WHEP (watch) clients for the media server.
 *
 * Both send one SDP offer once ICE gathering is done (no trickle), which the
 * media server answers in a single round trip. The returned handle closes the
 * peer connection and tells the server the session is over.
 */

export interface WebRtcSession {
  pc: RTCPeerConnection;
  close: () => Promise<void>;
}

function waitForIce(pc: RTCPeerConnection, timeoutMs = 2500) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    pc.addEventListener("icegatheringstatechange", check);
    setTimeout(done, timeoutMs);
  });
}

async function negotiate(
  pc: RTCPeerConnection,
  url: string,
  headers: Record<string, string> = {},
): Promise<string | null> {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIce(pc);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/sdp", ...headers },
    body: pc.localDescription?.sdp ?? offer.sdp ?? "",
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? "unauthorized" : res.status === 404 ? "not_found" : `http_${res.status}`);
  }
  const answer = await res.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answer });
  const location = res.headers.get("Location");
  return location ? new URL(location, url).toString() : null;
}

function closer(pc: RTCPeerConnection, resource: string | null, headers: Record<string, string> = {}) {
  return async () => {
    pc.getSenders().forEach((s) => s.track?.stop());
    pc.close();
    if (resource) {
      await fetch(resource, { method: "DELETE", headers }).catch(() => {});
    }
  };
}

/** Send a camera/mic stream to the live's WHIP endpoint. */
export async function publishWhip(url: string, streamKey: string, stream: MediaStream): Promise<WebRtcSession> {
  const pc = new RTCPeerConnection();
  for (const track of stream.getTracks()) {
    pc.addTransceiver(track, { direction: "sendonly", streams: [stream] });
  }
  const headers = { Authorization: `Bearer ${streamKey}` };
  const target = `${url}${url.includes("?") ? "&" : "?"}key=${encodeURIComponent(streamKey)}`;
  try {
    const resource = await negotiate(pc, target, headers);
    return { pc, close: closer(pc, resource, headers) };
  } catch (error) {
    pc.close();
    throw error;
  }
}

/** Play the live from its WHEP endpoint into a <video>. */
export async function playWhep(url: string, video: HTMLVideoElement): Promise<WebRtcSession> {
  const pc = new RTCPeerConnection();
  pc.addTransceiver("video", { direction: "recvonly" });
  pc.addTransceiver("audio", { direction: "recvonly" });
  const stream = new MediaStream();
  pc.addEventListener("track", (event) => {
    stream.addTrack(event.track);
    if (video.srcObject !== stream) video.srcObject = stream;
  });
  try {
    const resource = await negotiate(pc, url);
    return { pc, close: closer(pc, resource) };
  } catch (error) {
    pc.close();
    throw error;
  }
}
