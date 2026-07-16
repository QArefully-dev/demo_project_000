import { Button } from '@/components/ui/button';
import type { PowderizerHistoryEntry } from './powderizerHistory';

type PowderizerHistoryShelfProps = {
  entries: readonly PowderizerHistoryEntry[];
  available: boolean;
  onUseAgain: (entry: PowderizerHistoryEntry) => void;
  onRemove: (quoteKey: string) => void;
  onClear: () => void;
};

function schemeLabel(value: PowderizerHistoryEntry['config']['bagColourScheme']): string {
  return value.replaceAll('-', ' ');
}

function timestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function PowderizerHistoryShelf({
  entries,
  available,
  onUseAgain,
  onRemove,
  onClear,
}: PowderizerHistoryShelfProps) {
  return (
    <section
      aria-labelledby="powderizer-history-heading"
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="powderizer-history-heading" className="font-semibold">
            Recent mixes
          </h2>
          <p className="text-sm text-muted-foreground">Saved only in this browser.</p>
        </div>
        {entries.length > 0 && (
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear history
          </Button>
        )}
      </div>
      {!available && (
        <p role="status" className="text-sm text-muted-foreground">
          Local history is unavailable in this browser session.
        </p>
      )}
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No saved mixes yet. Successful mixes appear here.
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.quoteKey} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full border border-border"
                  style={{
                    background: `var(--powderizer-${entry.config.bagColourScheme}, currentColor)`,
                  }}
                />
                <span className="capitalize">{schemeLabel(entry.config.bagColourScheme)}</span>
                <time dateTime={entry.timestamp} className="text-muted-foreground">
                  {timestamp(entry.timestamp)}
                </time>
              </div>
              <p className="mt-2 text-sm">
                {entry.config.components
                  .map(
                    ({ productId, percentage }) =>
                      `${entry.componentNames[productId]} ${percentage}%`,
                  )
                  .join(', ')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Good for: {entry.goodFor}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => onUseAgain(entry)}>
                  Use again
                </Button>
                <Button variant="outline" size="sm" onClick={() => onRemove(entry.quoteKey)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
