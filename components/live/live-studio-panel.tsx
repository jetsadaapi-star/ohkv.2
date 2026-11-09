"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Eye,
  EyeOff,
  FlipHorizontal2,
  Gauge,
  Headphones,
  ImagePlus,
  Layers,
  Lock,
  Mic,
  Plus,
  Settings2,
  SwitchCamera,
  Trash2,
  Type,
  Volume2,
  Wand2,
} from "lucide-react";
import { toast } from "@/components/ui/toast-notification";
import {
  LIVE_SOURCE_LIMIT,
  LIVE_SOURCE_TEXT_MAX,
  LIVE_TEXT_PRESETS,
  LIVE_TEXT_STYLES,
  SourceImageError,
  type LiveSource,
  type LiveTextStyle,
} from "@/lib/live/studio-sources";
import {
  LIVE_FPS,
  LIVE_QUALITIES,
  LIVE_QUALITY_SPEC,
  type LiveSendStats,
  type LiveStudioPrefs,
} from "@/lib/live/studio-prefs";
import type { LiveEffectSettings } from "@/lib/live/video-effects";
import { LiveEffectsPanel, Slider } from "./live-effects-panel";
import type { useLiveSources } from "./use-live-sources";
import type { MediaDeviceLists } from "./use-media-devices";
import { cn } from "@/lib/utils";

export type StudioTab = "look" | "sources" | "devices" | "quality";

type Sources = ReturnType<typeof useLiveSources>;

const TEXT_STYLE_CHIP: Record<LiveTextStyle, string> = {
  silk: "bg-linear-to-r from-[#8a2c1d] to-[#c0662b] text-white ring-1 ring-[#d9a441]",
  sale: "bg-red-600 text-amber-200 ring-1 ring-amber-200",
  gold: "bg-linear-to-r from-[#f3d58a] to-[#d9a441] text-[#5a1a10] ring-1 ring-[#8a2c1d]",
  white: "bg-white text-stone-900 ring-1 ring-black/10",
  outline: "bg-stone-700 text-white [text-shadow:0_0_2px_#000,0_0_2px_#000]",
};

/**
 * The studio's settings, TikTok-Studio style: look (beauty and effects),
 * sources (pictures and stickers), devices (camera, mic, speaker) and
 * quality. Everything here is what viewers get; the quality is fixed once on
 * air, the rest can change any time.
 */
export function LiveStudioPanel({
  tab,
  onTab,
  effects,
  sources,
  effectsSupported,
  devices,
  prefs,
  onPrefs,
  camera,
  micLevel,
  speakerSupported,
  monitor,
  onMonitor,
  onTestSpeaker,
  live,
  stats,
}: {
  tab: StudioTab;
  onTab: (tab: StudioTab) => void;
  effects: {
    settings: LiveEffectSettings;
    update: (patch: Partial<LiveEffectSettings>) => void;
    reset: () => void;
  };
  sources: Sources;
  effectsSupported: boolean;
  devices: MediaDeviceLists;
  prefs: LiveStudioPrefs;
  onPrefs: (patch: Partial<LiveStudioPrefs>) => void;
  camera: { activeId: string; onPick: (id: string) => void; onFlip: () => void };
  micLevel: number;
  speakerSupported: boolean;
  monitor: boolean;
  onMonitor: (on: boolean) => void;
  onTestSpeaker: () => void;
  live: boolean;
  stats: LiveSendStats | null;
}) {
  const t = useTranslations("live.studio");
  const tabs: Array<{ id: StudioTab; label: string; icon: React.ReactNode }> = [
    { id: "look", label: t("tabs.look"), icon: <Wand2 className="size-4" /> },
    { id: "sources", label: t("tabs.sources"), icon: <Layers className="size-4" /> },
    { id: "devices", label: t("tabs.devices"), icon: <Settings2 className="size-4" /> },
    { id: "quality", label: t("tabs.quality"), icon: <Gauge className="size-4" /> },
  ];

  return (
    <section className="rounded-3xl border bg-card shadow-sm">
      <div className="grid grid-cols-4 gap-1 border-b p-1.5" role="tablist" aria-label={t("title")}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => onTab(item.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[11px] font-semibold transition",
              tab === item.id
                ? "bg-linear-to-br from-[#8a2c1d] to-[#c0662b] text-white shadow"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
      <div className="p-3">
        {tab === "look" ? (
          <LiveEffectsPanel
            settings={effects.settings}
            onChange={effects.update}
            onReset={effects.reset}
            supported={effectsSupported}
          />
        ) : tab === "sources" ? (
          effectsSupported ? (
            <SourcesTab sources={sources} />
          ) : (
            <Unsupported />
          )
        ) : tab === "devices" ? (
          <DevicesTab
            devices={devices}
            prefs={prefs}
            onPrefs={onPrefs}
            camera={camera}
            micLevel={micLevel}
            speakerSupported={speakerSupported}
            monitor={monitor}
            onMonitor={onMonitor}
            onTestSpeaker={onTestSpeaker}
            mirror={effects.settings.mirror}
            onMirror={(mirror) => effects.update({ mirror })}
            effectsSupported={effectsSupported}
          />
        ) : (
          <QualityTab prefs={prefs} onPrefs={onPrefs} live={live} stats={stats} />
        )}
      </div>
    </section>
  );
}

function Unsupported() {
  const t = useTranslations("live.effects");
  return <p className="rounded-2xl border border-dashed p-3 text-center text-xs text-muted-foreground">{t("unsupported")}</p>;
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

function SourcesTab({ sources }: { sources: Sources }) {
  const t = useTranslations("live.studio.sources");
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [style, setStyle] = useState<LiveTextStyle>("silk");
  const [adding, setAdding] = useState(false);
  const selected = sources.sources.find((s) => s.id === sources.selectedId) ?? null;

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setAdding(true);
    try {
      await sources.addImage(file);
    } catch (error) {
      const reason = error instanceof SourceImageError ? error.reason : "decode";
      toast.error(t(`imageError.${reason}`));
    } finally {
      setAdding(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">{t("hint")}</p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={sources.full || adding}
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-rose-300 bg-rose-50/60 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:bg-rose-950/20 dark:text-rose-300"
        >
          <ImagePlus className="size-4" />
          {adding ? t("adding") : t("addImage")}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => void pickImage(e.target.files?.[0])}
        />
        <span className="flex items-center justify-center rounded-2xl bg-muted text-[11px] text-muted-foreground">
          {t("count", { count: sources.sources.length, max: LIVE_SOURCE_LIMIT })}
        </span>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold">{t("stickers")}</p>
        <div className="flex flex-wrap gap-1.5">
          {LIVE_TEXT_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              disabled={sources.full}
              onClick={() => sources.addText(t(`presets.${preset.key}`), preset.style)}
              className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold transition active:scale-95 disabled:opacity-50", TEXT_STYLE_CHIP[preset.style])}
            >
              {t(`presets.${preset.key}`)}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          sources.addText(text.trim(), style);
          setText("");
        }}
        className="space-y-2 rounded-2xl border p-2"
      >
        <div className="flex gap-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, LIVE_SOURCE_TEXT_MAX))}
            placeholder={t("textPlaceholder")}
            className="h-9 min-w-0 flex-1 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
          />
          <button
            type="submit"
            disabled={!text.trim() || sources.full}
            aria-label={t("addText")}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <StylePicker value={style} onChange={setStyle} />
      </form>

      {sources.sources.length ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold">{t("layers")}</p>
          <ul className="space-y-1">
            {[...sources.sources].reverse().map((source) => {
              const index = sources.sources.indexOf(source);
              const active = source.id === sources.selectedId;
              return (
                <li
                  key={source.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl border px-2 py-1.5",
                    active ? "border-rose-300 bg-rose-50 dark:bg-rose-950/30" : "hover:bg-muted/60",
                  )}
                >
                  <button type="button" onClick={() => sources.select(source.id)} className="flex min-w-0 flex-1 items-center gap-2 text-start">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                      {source.kind === "image" ? <ImagePlus className="size-3.5" /> : <Type className="size-3.5" />}
                    </span>
                    <span className={cn("truncate text-xs", !source.visible && "text-muted-foreground line-through")}>
                      {source.kind === "text" ? source.text : source.name || t("image")}
                    </span>
                  </button>
                  <IconButton label={source.visible ? t("hide") : t("show")} onClick={() => sources.update(source.id, { visible: !source.visible })}>
                    {source.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  </IconButton>
                  <IconButton label={t("forward")} disabled={index === sources.sources.length - 1} onClick={() => sources.move(source.id, 1)}>
                    <ArrowUp className="size-3.5" />
                  </IconButton>
                  <IconButton label={t("backward")} disabled={index === 0} onClick={() => sources.move(source.id, -1)}>
                    <ArrowDown className="size-3.5" />
                  </IconButton>
                  <IconButton label={t("remove")} onClick={() => sources.remove(source.id)} danger>
                    <Trash2 className="size-3.5" />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed p-4 text-center text-xs text-muted-foreground">{t("empty")}</p>
      )}

      {selected ? <SourceEditor source={selected} onChange={(patch) => sources.update(selected.id, patch)} /> : null}
    </div>
  );
}

function SourceEditor({ source, onChange }: { source: LiveSource; onChange: (patch: Partial<LiveSource>) => void }) {
  const t = useTranslations("live.studio.sources");
  return (
    <div className="space-y-3 rounded-2xl bg-muted/50 p-3">
      <p className="text-xs font-semibold">{t("editing")}</p>
      {source.kind === "text" ? (
        <>
          <input
            value={source.text}
            onChange={(e) => onChange({ text: e.target.value.slice(0, LIVE_SOURCE_TEXT_MAX), name: e.target.value.slice(0, 60) })}
            className="h-9 w-full rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
          />
          <StylePicker value={source.style} onChange={(style) => onChange({ style })} />
        </>
      ) : null}
      <Slider label={t("size")} value={source.size} min={5} max={100} onChange={(size) => onChange({ size })} format={(v) => `${v}%`} />
      <Slider
        label={t("rotation")}
        value={source.rotation}
        min={-180}
        max={180}
        onChange={(rotation) => onChange({ rotation })}
        format={(v) => `${v}°`}
      />
      <Slider label={t("opacity")} value={source.opacity} min={10} max={100} onChange={(opacity) => onChange({ opacity })} format={(v) => `${v}%`} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange({ x: 0.5 })}
          className="flex-1 rounded-xl border bg-background py-1.5 text-[11px] font-semibold hover:bg-muted"
        >
          {t("centre")}
        </button>
        <button
          type="button"
          onClick={() => onChange({ rotation: 0, opacity: 100 })}
          className="flex-1 rounded-xl border bg-background py-1.5 text-[11px] font-semibold hover:bg-muted"
        >
          {t("straighten")}
        </button>
      </div>
    </div>
  );
}

function StylePicker({ value, onChange }: { value: LiveTextStyle; onChange: (style: LiveTextStyle) => void }) {
  const t = useTranslations("live.studio.sources");
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("style")}>
      {LIVE_TEXT_STYLES.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-bold",
            TEXT_STYLE_CHIP[id],
            value === id ? "outline-2 outline-offset-2 outline-rose-500" : "opacity-80",
          )}
        >
          {t(`styles.${id}`)}
        </button>
      ))}
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background disabled:opacity-30",
        danger && "hover:text-red-600",
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Devices                                                             */
/* ------------------------------------------------------------------ */

function DevicesTab({
  devices,
  prefs,
  onPrefs,
  camera,
  micLevel,
  speakerSupported,
  monitor,
  onMonitor,
  onTestSpeaker,
  mirror,
  onMirror,
  effectsSupported,
}: {
  devices: MediaDeviceLists;
  prefs: LiveStudioPrefs;
  onPrefs: (patch: Partial<LiveStudioPrefs>) => void;
  camera: { activeId: string; onPick: (id: string) => void; onFlip: () => void };
  micLevel: number;
  speakerSupported: boolean;
  monitor: boolean;
  onMonitor: (on: boolean) => void;
  onTestSpeaker: () => void;
  mirror: boolean;
  onMirror: (on: boolean) => void;
  effectsSupported: boolean;
}) {
  const t = useTranslations("live.studio.devices");
  const label = (d: MediaDeviceInfo, i: number, fallback: string) => d.label || `${fallback} ${i + 1}`;
  return (
    <div className="space-y-4">
      {/* Camera */}
      <Group icon={<Camera className="size-4" />} title={t("camera")}>
        <div className="flex gap-1.5">
          <DeviceSelect
            value={camera.activeId}
            onChange={camera.onPick}
            options={devices.cameras.map((d, i) => ({ id: d.deviceId, label: label(d, i, t("camera")) }))}
            empty={t("none")}
          />
          <button
            type="button"
            onClick={camera.onFlip}
            aria-label={t("flip")}
            title={t("flip")}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border hover:bg-muted"
          >
            <SwitchCamera className="size-4" />
          </button>
        </div>
        {effectsSupported ? (
          <>
            <Slider label={t("zoom")} value={prefs.zoom} min={100} max={200} step={5} onChange={(zoom) => onPrefs({ zoom })} format={(v) => `${(v / 100).toFixed(2)}×`} />
            <Toggle checked={mirror} onChange={onMirror} icon={<FlipHorizontal2 className="size-4" />} label={t("mirror")} hint={t("mirrorHint")} />
          </>
        ) : null}
      </Group>

      {/* Microphone */}
      <Group icon={<Mic className="size-4" />} title={t("mic")}>
        <DeviceSelect
          value={prefs.micId}
          onChange={(micId) => onPrefs({ micId })}
          options={devices.mics.map((d, i) => ({ id: d.deviceId, label: label(d, i, t("mic")) }))}
          empty={t("none")}
        />
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
            <span>{t("level")}</span>
            <span>{micLevel > 0.04 ? t("hearing") : t("silent")}</span>
          </div>
          <LevelMeter level={micLevel} />
        </div>
        <Slider label={t("gain")} value={prefs.micGain} min={0} max={200} step={5} onChange={(micGain) => onPrefs({ micGain })} format={(v) => `${v}%`} />
        <Toggle checked={prefs.noiseSuppression} onChange={(noiseSuppression) => onPrefs({ noiseSuppression })} label={t("noiseSuppression")} hint={t("noiseSuppressionHint")} />
        <Toggle checked={prefs.echoCancellation} onChange={(echoCancellation) => onPrefs({ echoCancellation })} label={t("echoCancellation")} hint={t("echoCancellationHint")} />
        <Toggle checked={prefs.autoGain} onChange={(autoGain) => onPrefs({ autoGain })} label={t("autoGain")} hint={t("autoGainHint")} />
      </Group>

      {/* Speaker */}
      <Group icon={<Volume2 className="size-4" />} title={t("speaker")}>
        {speakerSupported ? (
          <DeviceSelect
            value={prefs.outputId}
            onChange={(outputId) => onPrefs({ outputId })}
            options={[{ id: "", label: t("systemDefault") }, ...devices.speakers.filter((d) => d.deviceId !== "default").map((d, i) => ({ id: d.deviceId, label: label(d, i, t("speaker")) }))]}
            empty={t("systemDefault")}
          />
        ) : (
          <p className="text-[11px] text-muted-foreground">{t("speakerUnsupported")}</p>
        )}
        <button
          type="button"
          onClick={onTestSpeaker}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold hover:bg-muted"
        >
          <Volume2 className="size-4" />
          {t("testSpeaker")}
        </button>
        <Toggle checked={monitor} onChange={onMonitor} icon={<Headphones className="size-4" />} label={t("monitor")} hint={t("monitorHint")} />
      </Group>
    </div>
  );
}

function LevelMeter({ level }: { level: number }) {
  const bars = 20;
  const lit = Math.round(level * bars);
  return (
    <div className="flex h-3 gap-0.5" aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className={cn(
            "flex-1 rounded-sm transition-colors",
            i < lit ? (i >= bars * 0.85 ? "bg-red-500" : i >= bars * 0.65 ? "bg-amber-400" : "bg-emerald-500") : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quality                                                             */
/* ------------------------------------------------------------------ */

function QualityTab({
  prefs,
  onPrefs,
  live,
  stats,
}: {
  prefs: LiveStudioPrefs;
  onPrefs: (patch: Partial<LiveStudioPrefs>) => void;
  live: boolean;
  stats: LiveSendStats | null;
}) {
  const t = useTranslations("live.studio.quality");
  return (
    <div className="space-y-4">
      {live ? (
        <p className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <Lock className="size-3.5 shrink-0" />
          {t("locked")}
        </p>
      ) : null}

      <Group icon={<Gauge className="size-4" />} title={t("resolution")}>
        <div className="grid grid-cols-3 gap-1.5">
          {LIVE_QUALITIES.map((q) => {
            const spec = LIVE_QUALITY_SPEC[q];
            return (
              <button
                key={q}
                type="button"
                disabled={live}
                onClick={() => onPrefs({ quality: q })}
                className={cn(
                  "rounded-xl border px-1 py-2 text-center disabled:opacity-60",
                  prefs.quality === q ? "border-rose-400 bg-rose-50 ring-2 ring-rose-300 dark:bg-rose-950/30" : "hover:bg-muted",
                )}
              >
                <span className="block text-sm font-bold">{q}p</span>
                <span className="block text-[10px] text-muted-foreground">{t(`presets.${q}`)}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {spec.width}×{spec.height} · {(spec.maxBitrate / 1_000_000).toFixed(1)} Mbps
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {LIVE_FPS.map((fps) => (
            <Choice key={fps} active={prefs.fps === fps} disabled={live} onClick={() => onPrefs({ fps })}>
              {fps} fps · {t(fps === 30 ? "fps30" : "fps24")}
            </Choice>
          ))}
        </div>
      </Group>

      <Group icon={<Settings2 className="size-4" />} title={t("slowNetwork")}>
        <div className="grid grid-cols-2 gap-1.5">
          <Choice active={prefs.priority === "smooth"} onClick={() => onPrefs({ priority: "smooth" })}>
            {t("smooth")}
          </Choice>
          <Choice active={prefs.priority === "sharp"} onClick={() => onPrefs({ priority: "sharp" })}>
            {t("sharp")}
          </Choice>
        </div>
        <p className="text-[11px] text-muted-foreground">{t(prefs.priority === "smooth" ? "smoothHint" : "sharpHint")}</p>
      </Group>

      <Group icon={<Settings2 className="size-4" />} title={t("studio")}>
        <Toggle checked={prefs.countdown} onChange={(countdown) => onPrefs({ countdown })} label={t("countdown")} hint={t("countdownHint")} />
        <Toggle checked={prefs.giftSound} onChange={(giftSound) => onPrefs({ giftSound })} label={t("giftSound")} hint={t("giftSoundHint")} />
      </Group>

      {stats ? (
        <Group icon={<Gauge className="size-4" />} title={t("stats")}>
          <dl className="grid grid-cols-2 gap-1.5 text-xs">
            <Stat label={t("statBitrate")} value={`${stats.kbps.toLocaleString()} kbps`} />
            <Stat label={t("statFps")} value={`${stats.fps}`} />
            <Stat label={t("statSize")} value={stats.width ? `${stats.width}×${stats.height}` : "—"} />
            <Stat label={t("statRtt")} value={stats.rttMs === null ? "—" : `${stats.rttMs} ms`} />
            <Stat label={t("statLoss")} value={`${(stats.loss * 100).toFixed(1)}%`} />
            <Stat
              label={t("statLimited")}
              value={t(stats.limitedBy === "bandwidth" ? "limitBandwidth" : stats.limitedBy === "cpu" ? "limitCpu" : "limitNone")}
              warn={stats.limitedBy === "bandwidth" || stats.limitedBy === "cpu"}
            />
          </dl>
        </Group>
      ) : null}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2.5 py-1.5">
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd className={cn("font-mono font-semibold", warn && "text-amber-600")}>{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bits                                                                */
/* ------------------------------------------------------------------ */

function Group({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
        <span className="text-rose-600">{icon}</span>
        {title}
      </p>
      {children}
    </div>
  );
}

function DeviceSelect({
  value,
  onChange,
  options,
  empty,
}: {
  value: string;
  onChange: (id: string) => void;
  options: Array<{ id: string; label: string }>;
  empty: string;
}) {
  return (
    <select
      value={options.some((o) => o.id === value) ? value : (options[0]?.id ?? "")}
      onChange={(e) => onChange(e.target.value)}
      disabled={!options.length}
      className="h-9 w-full min-w-0 flex-1 rounded-xl border bg-background px-2 text-sm"
    >
      {options.length ? (
        options.map((o) => (
          <option key={o.id || "default"} value={o.id}>
            {o.label}
          </option>
        ))
      ) : (
        <option value="">{empty}</option>
      )}
    </select>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
  icon,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-rose-600" : "bg-muted-foreground/30",
        )}
      >
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", checked ? "start-4.5" : "start-0.5")} />
      </button>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm">
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
          {label}
        </span>
        {hint ? <span className="block text-[11px] text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

function Choice({
  children,
  active,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-xl border px-2 py-2 text-xs font-semibold disabled:opacity-60",
        active ? "border-rose-400 bg-rose-50 text-rose-700 ring-2 ring-rose-300 dark:bg-rose-950/30 dark:text-rose-300" : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
