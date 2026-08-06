import { COUNTRY_PROFILES } from '@shop/contracts/country-profiles';
import { useCountry } from '@/hooks/CountryContext';

/** Country-specific ordering notice supplied by the shared country profile. */
export function CountryBanner() {
  const { activeCountry } = useCountry();
  const profile = COUNTRY_PROFILES[activeCountry];

  // Auth and country storage validate this invariant, but a shared layout must degrade safely
  // if malformed runtime state crosses that boundary.
  if (profile === undefined) return null;

  const banner = profile.banner;

  if (!banner) return null;

  return (
    <section
      aria-label="Country ordering notice"
      className="content-shell mt-6 overflow-hidden rounded-2xl border-2 border-foreground bg-sale text-sale-foreground"
    >
      <div className="px-7 py-4 sm:px-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">
          Country ordering notice
        </p>
        <p className="mt-1 text-sm font-semibold">{banner}</p>
      </div>
    </section>
  );
}
