"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Cloud, Server, HardDrive, Droplet, Check } from "lucide-react";

export type StorageProvider =
  | "cloudflare_r2"
  | "s3"
  | "minio"
  | "digitalocean";

interface StorageProviderToggleProps {
  value: StorageProvider;
  onChange: (next: StorageProvider) => void;
  disabled?: boolean;
  /**
   * Grid override for the host's width. The default goes four-across only at
   * xl; the install wizard's 2xl card never reaches that breakpoint, so it
   * passes `lg:grid-cols-4` to get the same single row.
   */
  className?: string;
}

const PROVIDERS: {
  value: StorageProvider;
  labelKey: string;
  descKey: string;
  icon: typeof Cloud;
  /** The provider's own colour, for its icon tile. */
  tile: string;
}[] = [
  {
    value: "cloudflare_r2",
    tile: "bg-[#F38020] text-white",
    labelKey: "admin.settings.storage.cloudflareR2",
    descKey: "admin.settings.storage.cloudflareR2Desc",
    icon: Cloud,
  },
  {
    value: "s3",
    tile: "bg-[#232F3E] text-[#FF9900]",
    labelKey: "admin.settings.storage.awsS3",
    descKey: "admin.settings.storage.awsS3Desc",
    icon: Server,
  },
  {
    value: "minio",
    tile: "bg-[#C72E49] text-white",
    labelKey: "admin.settings.storage.minio",
    descKey: "admin.settings.storage.minioDesc",
    icon: HardDrive,
  },
  {
    value: "digitalocean",
    tile: "bg-[#0080FF] text-white",
    labelKey: "admin.settings.storage.digitalocean",
    descKey: "admin.settings.storage.digitaloceanDesc",
    icon: Droplet,
  },
];

export function StorageProviderToggle({
  value,
  onChange,
  disabled = false,
  className,
}: StorageProviderToggleProps) {
  const t = useTranslations();

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {PROVIDERS.map(
        ({ value: pv, labelKey, descKey, icon: Icon, tile }) => {
          const isActive = value === pv;
          return (
            <button
              key={pv}
              type="button"
              disabled={disabled}
              onClick={() => onChange(pv)}
              className={cn(
                "relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                isActive
                  ? "border-sky-500 bg-sky-500/[0.06] ring-1 ring-sky-500/30"
                  : "hover:border-sky-400/50 hover:bg-muted/40",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {isActive && (
                <div className="absolute top-2.5 right-2.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                </div>
              )}
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl shadow-sm transition",
                  isActive ? tile : "bg-muted text-muted-foreground shadow-none",
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5 pr-5">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t(labelKey)}
                </p>
                <p
                  className={cn(
                    "text-[11px] leading-snug",
                    isActive
                      ? "text-muted-foreground"
                      : "text-muted-foreground/70",
                  )}
                >
                  {t(descKey)}
                </p>
              </div>
            </button>
          );
        },
      )}
    </div>
  );
}
