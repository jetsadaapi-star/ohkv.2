"use client";

import { useCallback, useEffect, useState } from "react";

export interface MediaDeviceLists {
  cameras: MediaDeviceInfo[];
  mics: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
}

/**
 * The cameras, microphones and speakers this device has. Names appear only
 * once the page may use the camera, so call `refresh` after it opens; a
 * device plugged in or out refreshes the lists by itself.
 */
export function useMediaDevices() {
  const [lists, setLists] = useState<MediaDeviceLists>({ cameras: [], mics: [], speakers: [] });

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      // "default" and "communications" are aliases of a real device.
      const real = (kind: MediaDeviceKind) =>
        all.filter((d) => d.kind === kind && d.deviceId && d.deviceId !== "communications");
      setLists({ cameras: real("videoinput"), mics: real("audioinput"), speakers: real("audiooutput") });
    } catch {
      // Keep what we had.
    }
  }, []);

  useEffect(() => {
    const media = navigator.mediaDevices;
    if (!media?.addEventListener) return;
    const onChange = () => void refresh();
    media.addEventListener("devicechange", onChange);
    return () => media.removeEventListener("devicechange", onChange);
  }, [refresh]);

  return { ...lists, refresh };
}
