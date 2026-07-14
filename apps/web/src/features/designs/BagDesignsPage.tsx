import { Heart } from 'lucide-react';
import { BagArtwork } from '@/components/BagArtwork';
import { ProductGrid } from '@/components/ProductGrid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';

const designs: ReadonlyArray<{
  option: string;
  title: string;
  note: string;
}> = [
  {
    option: 'C2-D',
    title: 'Paired ovals',
    note: 'The cleanest treatment: two overlapping powder shapes and very few dots.',
  },
];

const artworkProps = {
  name: 'Powdered Water',
  category: 'Impossible',
  quantity: 'Conceptual',
  batchCode: 'IMP-07',
  mark: 'H2O',
  accent: '#287fa6',
  powderAccent: '#b9e2ee',
  consumptionLabel: 'Not for consumption',
} as const;

export function BagDesignsPage() {
  return (
    <div className="space-y-8 pb-12">
      <header className="max-w-3xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Packaging study
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Locked design: C2-D</h1>
        <p className="text-muted-foreground">
          Broad paper bag, coloured label, paired powder ovals, and the restrained sprinkle field.
        </p>
      </header>

      <ProductGrid className="items-start">
        {designs.map((design) => (
          <article key={design.option} className="min-w-0 space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-black text-background">
                {design.option}
              </span>
              <div>
                <h2 className="font-semibold">{design.title}</h2>
                <p className="text-xs leading-relaxed text-muted-foreground">{design.note}</p>
              </div>
            </div>

            <Card className="group flex h-full flex-col gap-0 overflow-hidden border-border/80 bg-surface-raised py-0 shadow-sm">
              <div className="relative aspect-4/5 overflow-hidden bg-surface-soft">
                <BagArtwork {...artworkProps} className="h-full w-full object-contain p-4 sm:p-5" />
                <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap gap-1.5">
                  <Badge
                    variant="secondary"
                    className="border-primary/10 bg-background/95 px-2.5 text-primary shadow-sm"
                  >
                    Bestseller
                  </Badge>
                </div>
                <button
                  type="button"
                  aria-label="Add Powdered Water to wishlist"
                  className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full bg-background/90 shadow-sm"
                >
                  <Heart className="size-4" aria-hidden="true" />
                </button>
              </div>
              <CardContent className="flex flex-1 flex-col gap-2 p-4 pt-4 sm:p-5 sm:pt-4">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Powder type: Impossible
                </p>
                <h3 className="min-h-11 text-base font-semibold leading-[1.35] tracking-tight">
                  Powdered Water
                </h3>
                <p className="text-xs text-muted-foreground">Pack: conceptual quantity</p>
                <div className="mt-auto pt-2">
                  <span className="price-current">£19.95</span>
                </div>
              </CardContent>
              <CardFooter className="border-t-0 bg-transparent p-4 pt-0 sm:px-5 sm:pb-5">
                <Button className="w-full">Add powder</Button>
              </CardFooter>
            </Card>
          </article>
        ))}
      </ProductGrid>

      <aside className="rounded-2xl border bg-surface-raised p-5 text-sm text-muted-foreground">
        C2-D is now the shared live SVG artwork used by product cards and product pages. Product
        data controls the copy and colours without writing image files.
      </aside>
    </div>
  );
}
