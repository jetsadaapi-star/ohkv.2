"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "@/hooks/use-locale-navigation";
import { useSession } from "@/lib/auth/auth-client";
import {
  isStorefrontPreviewRoute,
  isVendorSignupAudience,
} from "@/lib/vendors/vendor-signup-links";

/**
 * Whether this visitor should see "Become a Vendor" links and sections — see
 * lib/vendors/vendor-signup-links.ts.
 *
 * True until the session has loaded, which is also what the cached HTML
 * shows, so hydration never disagrees with the server. An admin, vendor or
 * staff member sees the invitation leave once their session arrives.
 *
 * The session can already be in the client's store on the very first render
 * (a signed-in admin opening the storefront), so "until the session has
 * loaded" is not enough on its own: the hydration render always answers
 * true, like the server, and the session is read from the render after it.
 */
const noopSubscribe = () => () => {};

export function useVendorSignupVisible(): boolean {
  const { data } = useSession();
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!hydrated || isStorefrontPreviewRoute(pathname)) return true;
  return isVendorSignupAudience(
    (data?.user as { role?: string } | undefined)?.role,
  );
}
