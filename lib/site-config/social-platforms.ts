/**
 * The social networks a store can link its profiles to (Settings → Social),
 * in the order the storefront shows them. Client-safe: the settings page, the
 * footer and the contact page all read this one list.
 */

export const SOCIAL_PROFILE_KEYS = [
  "facebookUrl",
  "instagramUrl",
  "tiktokUrl",
  "lineUrl",
  "youtubeUrl",
  "twitterUrl",
  "threadsUrl",
  "pinterestUrl",
  "linkedinUrl",
] as const;
export type SocialProfileKey = (typeof SOCIAL_PROFILE_KEYS)[number];

export type SocialPlatformId =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "line"
  | "youtube"
  | "x"
  | "threads"
  | "pinterest"
  | "linkedin"
  | "whatsapp"
  | "telegram";

export interface SocialProfilePlatform {
  key: SocialProfileKey;
  id: SocialPlatformId;
  label: string;
  placeholder: string;
  /** Hosts a profile link is expected on — a soft check, never a block. */
  hosts: readonly string[];
}

export const SOCIAL_PROFILE_PLATFORMS: readonly SocialProfilePlatform[] = [
  { key: "facebookUrl", id: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourstore", hosts: ["facebook.com", "fb.com", "fb.me"] },
  { key: "instagramUrl", id: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourstore", hosts: ["instagram.com", "instagr.am"] },
  { key: "tiktokUrl", id: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourstore", hosts: ["tiktok.com"] },
  { key: "lineUrl", id: "line", label: "LINE", placeholder: "https://line.me/R/ti/p/@yourstore", hosts: ["line.me", "lin.ee"] },
  { key: "youtubeUrl", id: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourstore", hosts: ["youtube.com", "youtu.be"] },
  { key: "twitterUrl", id: "x", label: "X (Twitter)", placeholder: "https://x.com/yourstore", hosts: ["x.com", "twitter.com"] },
  { key: "threadsUrl", id: "threads", label: "Threads", placeholder: "https://threads.net/@yourstore", hosts: ["threads.net", "threads.com"] },
  { key: "pinterestUrl", id: "pinterest", label: "Pinterest", placeholder: "https://pinterest.com/yourstore", hosts: ["pinterest.", "pin.it"] },
  { key: "linkedinUrl", id: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/yourstore", hosts: ["linkedin.com"] },
];

/**
 * How a typed profile link reads: empty, a link on the platform's own site,
 * a link elsewhere (allowed — a link-in-bio page, say — but worth a second
 * look), or not a web link at all.
 */
export function socialLinkStatus(
  platform: SocialProfilePlatform,
  value: string | undefined,
): "empty" | "ok" | "otherHost" | "invalid" {
  const raw = value?.trim();
  if (!raw) return "empty";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "invalid";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return "invalid";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const matches = platform.hosts.some((expected) =>
    expected.endsWith(".")
      ? host.startsWith(expected) || host.includes(`.${expected}`)
      : host === expected || host.endsWith(`.${expected}`),
  );
  return matches ? "ok" : "otherHost";
}

/** The set profile links, in storefront order, with their platform. */
export function setSocialProfiles(
  links: Partial<Record<SocialProfileKey, string | undefined>> | null | undefined,
): Array<SocialProfilePlatform & { href: string }> {
  return SOCIAL_PROFILE_PLATFORMS.flatMap((platform) => {
    const href = links?.[platform.key];
    return typeof href === "string" && href.trim() ? [{ ...platform, href: href.trim() }] : [];
  });
}
