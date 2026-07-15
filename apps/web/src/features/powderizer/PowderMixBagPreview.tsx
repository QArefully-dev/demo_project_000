import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { BagArtwork } from '@/components/BagArtwork';
import { powderMixBagSchemePresentation } from '@/components/powderMixBagScheme';
import type { BuilderConfig } from './powderizerState';

const CENTERED_ORIGIN = '50% 50%';

function previewIdentity(
  config: BuilderConfig,
  priceVersion: string,
  usageLabel: string | null | undefined,
) {
  return [
    config.customLabel.trim(),
    config.bagColourScheme,
    config.bagSizeGrams,
    config.fineness,
    priceVersion,
    usageLabel ?? '',
  ].join('|');
}

export function PowderMixBagPreview({
  config,
  priceVersion,
  usageLabel,
}: {
  config: BuilderConfig;
  priceVersion: string;
  usageLabel?: string | null;
}) {
  const label = config.customLabel.trim() || 'Custom powder mix';
  const identity = previewIdentity(config, priceVersion, usageLabel);
  const previousIdentity = useRef(identity);
  const [isZoomed, setIsZoomed] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState(CENTERED_ORIGIN);
  const scheme = powderMixBagSchemePresentation(config.bagColourScheme);

  useEffect(() => {
    if (previousIdentity.current === identity) return;
    previousIdentity.current = identity;
    setIsZoomed(false);
    setTransformOrigin(CENTERED_ORIGIN);
  }, [identity]);

  const resetZoom = () => {
    setIsZoomed(false);
    setTransformOrigin(CENTERED_ORIGIN);
  };

  const toggleZoom = () => {
    setIsZoomed((wasZoomed) => {
      if (wasZoomed) setTransformOrigin(CENTERED_ORIGIN);
      return !wasZoomed;
    });
  };

  const updateTransformOrigin = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isZoomed || event.pointerType === 'touch') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const x = Math.min(100, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.min(100, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * 100));
    setTransformOrigin(`${x}% ${y}%`);
  };

  return (
    <section
      className="rounded-xl border border-border bg-surface-soft p-4"
      aria-labelledby="bag-preview-title"
    >
      <h2 id="bag-preview-title" className="mb-1 font-semibold">
        Bag preview
      </h2>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
        <p className="text-muted-foreground">{scheme.label}</p>
        {usageLabel && (
          <p className="font-medium" aria-label="Server usage label">
            {usageLabel}
          </p>
        )}
      </div>
      <button
        type="button"
        className="block aspect-square w-full overflow-hidden rounded-lg text-left outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
        aria-label={`${isZoomed ? 'Zoom out of' : 'Zoom into'} ${label} bag preview`}
        aria-pressed={isZoomed}
        onClick={toggleZoom}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            resetZoom();
          }
        }}
        onPointerMove={updateTransformOrigin}
        onPointerLeave={() => {
          if (isZoomed) setTransformOrigin(CENTERED_ORIGIN);
        }}
      >
        <BagArtwork
          name={label}
          category="Custom mix"
          quantity={`${config.bagSizeGrams}g`}
          batchCode={priceVersion}
          mark="MIX"
          paint={scheme.paint}
          powderAccent={scheme.paint.colors[1]}
          consumptionLabel={usageLabel ?? null}
          ariaLabel=""
          className="pointer-events-none mx-auto h-full w-full transition-transform duration-200 motion-reduce:transition-none"
          style={{ transform: `scale(${isZoomed ? 2 : 1})`, transformOrigin }}
        />
      </button>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>Click or press Enter/Space to zoom. Move the pointer to inspect.</p>
        <button
          type="button"
          className="shrink-0 underline underline-offset-4 disabled:cursor-not-allowed disabled:no-underline"
          disabled={!isZoomed}
          onClick={resetZoom}
        >
          Reset zoom
        </button>
      </div>
    </section>
  );
}
