import { ArrowRight, FlaskConical } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CustomBlendBanner() {
  return (
    <Link
      to="/custom-blend"
      aria-label="Custom Blend: configure your blend"
      className="custom-blend-banner grid overflow-hidden rounded-2xl sm:grid-cols-[1.1fr_0.9fr]"
    >
      <div className="px-7 py-9 sm:px-10">
        <p className="flex items-center gap-2 text-xs font-bold tracking-[0.18em] uppercase opacity-70">
          <FlaskConical className="size-4" aria-hidden="true" />
          Custom Blend
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Build material to your spec.</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 opacity-80">
          Start with a proven base lot, then define an exact made-to-order blend for your next run.
        </p>
        <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform duration-[var(--custom-blend-motion-duration)] hover:-translate-y-0.5">
          Configure your blend
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </div>
      <div
        aria-hidden="true"
        className="relative hidden items-center justify-center overflow-hidden bg-foreground p-8 sm:flex"
      >
        <div className="relative w-44 rounded-sm border border-background/25 bg-neutral-800 p-4 text-background shadow-xl">
          <div className="border border-background/35 px-3 py-5 text-center">
            <p className="text-[9px] font-bold tracking-[0.2em] text-background/70 uppercase">
              Qarefully
            </p>
            <p className="mt-2 text-lg font-semibold tracking-tight">CUSTOM</p>
            <p className="text-lg font-semibold tracking-tight">BLEND</p>
            <div className="mt-4 flex justify-center gap-1.5">
              <span className="custom-blend-legend-dot" />
              <span className="custom-blend-legend-dot" />
              <span className="custom-blend-legend-dot" />
            </div>
          </div>
          <p className="mt-3 text-center text-[9px] font-semibold tracking-[0.16em] text-background/65 uppercase">
            Made to order
          </p>
        </div>
      </div>
    </Link>
  );
}
