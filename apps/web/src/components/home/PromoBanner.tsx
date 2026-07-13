import { Link } from 'react-router-dom';

export function PromoBanner() {
  return (
    <section className="grid overflow-hidden rounded-2xl border-2 border-foreground bg-sale text-sale-foreground sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="px-7 py-9 sm:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">
          Bag-count promotion
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Save 10% when you bag five.</h2>
        <p className="mt-2 max-w-2xl text-sm opacity-85">
          Use code <strong>SAVE10</strong> on five or more bags. Simulated checkout; very real
          maths.
        </p>
      </div>
      <Link
        to="/catalog?onSale=true&sort=bestselling"
        className="m-6 mt-0 rounded-full bg-background px-6 py-3 text-center text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background sm:mt-6"
      >
        Shop the offer
      </Link>
    </section>
  );
}
