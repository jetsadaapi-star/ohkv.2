"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FlipHorizontal2, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import {
  LIVE_BANNER_MAX,
  LIVE_EFFECTS,
  LIVE_EFFECT_ICON,
  LIVE_FILTERS,
  LIVE_FILTER_SWATCH,
  LIVE_FRAMES,
  LIVE_FRAME_ICON,
  type LiveEffectSettings,
} from "@/lib/live/video-effects";
import { cn } from "@/lib/utils";

type Tab = "beauty" | "filter" | "effect" | "frame";

/** The studio's beauty, filter, effect and frame controls. Changes show live, on air too. */
export function LiveEffectsPanel({
  settings,
  onChange,
  onReset,
  supported,
}: {
  settings: LiveEffectSettings;
  onChange: (patch: Partial<LiveEffectSettings>) => void;
  onReset: () => void;
  supported: boolean;
}) {
  const t = useTranslations("live.effects");
  const [tab, setTab] = useState<Tab>("beauty");

  if (!supported) {
    return (
      <p className="rounded-2xl border border-dashed p-3 text-center text-xs text-muted-foreground">{t("unsupported")}</p>
    );
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "beauty", label: t("tabs.beauty") },
    { id: "filter", label: t("tabs.filter") },
    { id: "effect", label: t("tabs.effect") },
    { id: "frame", label: t("tabs.frame") },
  ];

  return (
    <section className="rounded-3xl border bg-card p-3 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-linear-to-br from-rose-500 to-amber-500 text-white">
          <Wand2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{t("title")}</h2>
          <p className="truncate text-[11px] text-muted-foreground">{t("hint")}</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted"
        >
          <RotateCcw className="size-3.5" />
          {t("reset")}
        </button>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-1 rounded-2xl bg-muted p-1" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-xl px-1 py-1.5 text-xs font-semibold transition",
              tab === item.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "beauty" ? (
        <div className="space-y-4 px-1 pb-1">
          <Slider
            label={t("smooth")}
            value={settings.smooth}
            onChange={(smooth) => onChange({ smooth })}
          />
          <Slider
            label={t("brighten")}
            value={settings.brighten}
            onChange={(brighten) => onChange({ brighten })}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.mirror}
              onChange={(e) => onChange({ mirror: e.target.checked })}
              className="size-4 accent-rose-600"
            />
            <FlipHorizontal2 className="size-4 text-muted-foreground" />
            <span className="flex-1">{t("mirror")}</span>
          </label>
          <p className="-mt-2 ps-6 text-[11px] text-muted-foreground">{t("mirrorHint")}</p>
        </div>
      ) : null}

      {tab === "filter" ? (
        <div className="grid grid-cols-3 gap-2">
          {LIVE_FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ filter: id })}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl border p-2 text-xs font-medium transition",
                settings.filter === id ? "border-rose-400 bg-rose-50 ring-2 ring-rose-300 dark:bg-rose-950/30" : "hover:bg-muted",
              )}
            >
              <span className="size-9 rounded-full shadow-inner ring-1 ring-black/10" style={{ background: LIVE_FILTER_SWATCH[id] }} />
              {t(`filters.${id}`)}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "effect" ? (
        <div className="grid grid-cols-4 gap-2">
          {LIVE_EFFECTS.map((id) => (
            <Chip key={id} active={settings.effect === id} onClick={() => onChange({ effect: id })} icon={LIVE_EFFECT_ICON[id]}>
              {t(`effects.${id}`)}
            </Chip>
          ))}
        </div>
      ) : null}

      {tab === "frame" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {LIVE_FRAMES.map((id) => (
              <Chip key={id} active={settings.frame === id} onClick={() => onChange({ frame: id })} icon={LIVE_FRAME_ICON[id]}>
                {t(`frames.${id}`)}
              </Chip>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="size-3.5 text-amber-500" />
              {t("banner")}
            </span>
            <input
              value={settings.banner}
              onChange={(e) => onChange({ banner: e.target.value.slice(0, LIVE_BANNER_MAX) })}
              maxLength={LIVE_BANNER_MAX}
              placeholder={t("bannerPlaceholder")}
              className="h-10 w-full rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            <span className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{t("bannerHint")}</span>
              <span>
                {settings.banner.length}/{LIVE_BANNER_MAX}
              </span>
            </span>
          </label>
        </div>
      ) : null}
    </section>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-semibold">
        {label}
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">{value}</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-rose-600"
      />
    </label>
  );
}

function Chip({
  children,
  icon,
  active,
  onClick,
}: {
  children: React.ReactNode;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-2xl border p-2 text-[11px] font-medium transition",
        active ? "border-rose-400 bg-rose-50 ring-2 ring-rose-300 dark:bg-rose-950/30" : "hover:bg-muted",
      )}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="w-full truncate text-center">{children}</span>
    </button>
  );
}
