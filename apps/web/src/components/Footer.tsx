import { Link } from 'react-router-dom';
import { getArticlesForGroup, helpIndexLink } from '@/features/help/content/helpContentRegistry';

const footerGroups = [
  {
    group: 'help',
    heading: 'Help',
  },
  {
    group: 'policy',
    heading: 'Policies',
  },
] as const;

/** Global discovery links for local demo help and policy content. */
export function Footer() {
  return (
    <footer className="border-t border-border bg-surface-raised/60">
      <div className="content-shell py-8 sm:py-10">
        <nav aria-label="Help and policies" className="space-y-6">
          <p className="text-sm leading-6 text-muted-foreground">
            Local QA demo guidance and policy information.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {footerGroups.map(({ group, heading }) => {
              const headingId = `footer-${group}-heading`;
              const links =
                group === 'help'
                  ? [helpIndexLink, ...getArticlesForGroup(group)]
                  : getArticlesForGroup(group);

              return (
                <section key={group} aria-labelledby={headingId}>
                  <h2 id={headingId} className="text-sm font-semibold text-foreground">
                    {heading}
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {links.map((link) => (
                      <li key={link.path}>
                        <Link
                          to={link.path}
                          className="section-link text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          {'label' in link ? link.label : link.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </nav>
      </div>
    </footer>
  );
}
