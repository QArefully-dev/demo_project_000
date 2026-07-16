import { useParams } from 'react-router-dom';
import { NotFoundPage } from '@/features/notFound/NotFoundPage';
import type { HelpContentGroup } from './content/helpContentTypes';
import { getHelpArticle, helpIndexLink } from './content/helpContentRegistry';
import { HelpArticleLayout } from './HelpArticleLayout';

interface HelpArticlePageProps {
  readonly group: HelpContentGroup;
}

/** Resolves an article only within its route group, preserving unknown-slug 404s. */
export function HelpArticlePage({ group }: HelpArticlePageProps) {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getHelpArticle(group, slug) : undefined;

  if (!article) {
    return <NotFoundPage />;
  }

  return <HelpArticleLayout article={article} helpIndexLink={helpIndexLink} />;
}
