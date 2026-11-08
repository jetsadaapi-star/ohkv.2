import { ArrowRight, Clapperboard, Radio, Store, Wallet } from "lucide-react";
import Link from "@/components/language/link";

/** The invitation to the next maker: what a store gets, and the way in. */
export function OtopJoin({
  title,
  subtitle,
  buttonLabel,
  buttonHref,
  perks,
}: {
  title: string;
  subtitle: string;
  buttonLabel: string;
  buttonHref: string;
  perks: { store: string; live: string; clips: string; payout: string };
}) {
  const items = [
    { icon: Store, label: perks.store },
    { icon: Radio, label: perks.live },
    { icon: Clapperboard, label: perks.clips },
    { icon: Wallet, label: perks.payout },
  ];
  return (
    <section className="container mx-auto px-4 py-8 sm:py-12">
      <div className="relative isolate overflow-hidden rounded-[32px] bg-linear-to-br from-highlight via-[color-mix(in_oklab,var(--highlight)_70%,white)] to-[color-mix(in_oklab,var(--highlight)_35%,white)] px-6 py-10 text-store-secondary shadow-xl shadow-store-secondary/15 sm:px-12 sm:py-14">
        <span aria-hidden className="absolute -end-20 -top-24 -z-10 size-80 rounded-full bg-white/40 blur-3xl" />
        <span aria-hidden className="absolute -bottom-28 start-10 -z-10 size-80 rounded-full bg-primary/20 blur-3xl" />
        <span
          aria-hidden
          className="absolute inset-y-0 end-0 -z-10 hidden w-1/3 opacity-20 lg:block [background-image:repeating-linear-gradient(45deg,var(--store-secondary)_0_2px,transparent_2px_18px),repeating-linear-gradient(-45deg,var(--store-secondary)_0_2px,transparent_2px_18px)]"
        />
        <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-2xl font-bold leading-tight sm:text-4xl">{title}</h2>
            {subtitle ? <p className="mt-3 max-w-xl text-base text-store-secondary/80">{subtitle}</p> : null}
            {buttonLabel ? (
              <Link
                href={buttonHref || "/become-vendor"}
                className="group mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-7 text-base font-bold text-primary-foreground shadow-lg shadow-store-secondary/30 transition-transform hover:-translate-y-0.5"
              >
                {buttonLabel}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100" />
              </Link>
            ) : null}
          </div>
          <ul className="grid grid-cols-2 gap-3">
            {items.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3 shadow-sm backdrop-blur sm:p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-highlight">
                  <Icon className="size-5" />
                </span>
                <span className="text-sm font-semibold leading-snug">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
