import { Link } from 'react-router-dom';
import { getArticlesForGroup } from './content/helpContentRegistry';

const indexGroups = [
  {
    group: 'help',
    heading: 'Help topics',
    description: 'Guidance for exploring this local QA demo and its simulated storefront.',
  },
  {
    group: 'policy',
    heading: 'Demo policies',
    description: 'Information about local demo data and the limits of this simulated service.',
  },
] as const;

/** Registry-driven directory for local demo help and policy content. */
export function HelpIndexPage() {
  return (
    <section aria-labelledby="help-index-title" className="mx-auto max-w-3xl space-y-10 pb-12">
      <header className="space-y-3">
        <p className="section-eyebrow">QArefully Powder Co.</p>
        <h1 id="help-index-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Help center
        </h1>
        <p className="max-w-2xl leading-7 text-muted-foreground">
          Find local QA demo guidance, including simulated commerce, fictional catalog content, and
          local data behavior.
        </p>
      </header>

      {indexGroups.map(({ group, heading, description }) => {
        const headingId = `${group}-topics-heading`;

        return (
          <section key={group} aria-labelledby={headingId} className="space-y-4">
            <div className="space-y-1">
              <h2 id={headingId} className="text-xl font-semibold tracking-tight sm:text-2xl">
                {heading}
              </h2>
              <p className="leading-7 text-muted-foreground">{description}</p>
            </div>
            <ul className="space-y-3">
              {getArticlesForGroup(group).map((article) => (
                <li key={article.id}>
                  <Link to={article.path} className="section-link text-base font-semibold">
                    {article.title}
                  </Link>
                  <p className="mt-1 leading-7 text-muted-foreground">{article.summary}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
