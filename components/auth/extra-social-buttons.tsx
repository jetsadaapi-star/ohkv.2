"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AppleIcon, LineIcon, XIcon } from "@/components/auth/oauth-icons";
import type { ExtraSocialProvider } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";

/**
 * LINE, X and Apple sign-in buttons, shared by the login and register forms
 * (each passes its own handler and busy state). Each provider is drawn in its
 * own brand colours: LINE green, X black, Apple black — what a shopper looks
 * for, and what each provider's brand guide asks of the button.
 */
const STYLE: Record<ExtraSocialProvider, string> = {
  line: "border-0 bg-[#06C755] text-white hover:bg-[#05b34c] hover:text-white",
  twitter: "border-0 bg-black text-white hover:bg-neutral-800 hover:text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200",
  apple: "border-0 bg-black text-white hover:bg-neutral-800 hover:text-white dark:bg-white dark:text-black dark:hover:bg-neutral-200",
};

const ICON: Record<ExtraSocialProvider, (props: { className?: string }) => React.ReactNode> = {
  line: LineIcon,
  twitter: XIcon,
  apple: AppleIcon,
};

const LABEL_KEY: Record<ExtraSocialProvider, string> = {
  line: "auth.continueWithLine",
  twitter: "auth.continueWithX",
  apple: "auth.continueWithApple",
};

export const EXTRA_SOCIAL_PROVIDERS: readonly ExtraSocialProvider[] = ["line", "apple", "twitter"];

export function ExtraSocialButtons(props: {
  enabled: Partial<Record<ExtraSocialProvider, boolean>>;
  pending: ExtraSocialProvider | null;
  busy: boolean;
  onSignIn: (provider: ExtraSocialProvider) => void;
  className?: string;
}) {
  const t = useTranslations();
  const shown = EXTRA_SOCIAL_PROVIDERS.filter((provider) => props.enabled[provider]);
  if (shown.length === 0) return null;
  return (
    <div className={cn("space-y-2", props.className)}>
      {shown.map((provider) => {
        const Icon = ICON[provider];
        return (
          <Button
            key={provider}
            type="button"
            variant="outline"
            className={cn("w-full gap-2", STYLE[provider])}
            onClick={() => props.onSignIn(provider)}
            disabled={props.busy}
          >
            {props.pending === provider ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Icon className={provider === "line" ? "h-5 w-5" : "h-4 w-4"} />
            )}
            {t(LABEL_KEY[provider])}
          </Button>
        );
      })}
    </div>
  );
}

export function hasExtraSocial(enabled: Partial<Record<ExtraSocialProvider, boolean>>) {
  return EXTRA_SOCIAL_PROVIDERS.some((provider) => enabled[provider]);
}
