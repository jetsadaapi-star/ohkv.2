"use client";

import { useCallback } from "react";
import { useRouter } from "@/hooks/use-locale-navigation";
import { usePrefetchResource } from "@/hooks/use-suspense-resource";
import { USER_PROFILE_URL } from "@/components/account/user-profile-resource";
import { ordersFirstPage } from "@/components/account/orders-list";
import { wishlistFirstSync } from "@/hooks/use-wishlist";

/** What each account page reads first, by its path. */
const PAGE_DATA: Record<string, string[]> = {
  "/account/profile": [USER_PROFILE_URL],
  "/account/security": [USER_PROFILE_URL],
  "/account/addresses": ["/api/user/addresses"],
  "/account/preferences": ["/api/user/customer-profile"],
  "/account/quotes": ["/api/quotes/mine"],
  "/account/store-credit": ["/api/user/store-credit"],
  "/account/rewards": ["/api/user/loyalty"],
};

/**
 * Warms an account page the moment the pointer or a finger is on its link:
 * the route itself (the sidebar's links do not prefetch on sight) and the
 * data the page reads first, into the cache it reads from. Clicking then
 * opens the page with its content instead of its skeleton. Each url is
 * asked once; an answer already held is left alone.
 */
export function useAccountPrefetch() {
  const router = useRouter();
  const prefetchData = usePrefetchResource();
  return useCallback(
    (href: string) => {
      router.prefetch(href);
      if (href === "/account/orders") {
        const first = ordersFirstPage("regular", "all");
        prefetchData(first.url, first.load);
        return;
      }
      if (href === "/account/wishlist") {
        void wishlistFirstSync();
        return;
      }
      for (const url of PAGE_DATA[href] ?? []) prefetchData(url);
    },
    [router, prefetchData],
  );
}
