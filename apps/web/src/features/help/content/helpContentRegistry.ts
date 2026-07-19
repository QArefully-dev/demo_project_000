import { faqArticle } from './faqArticle';
import { type HelpArticle, type HelpContentGroup } from './helpContentTypes';
import { policyArticles as authoredPolicyArticles } from './policyArticles';
import { powderSafetyArticle, storageArticle } from './powderGuidanceArticles';
import { packSizesArticle, returnsArticle, shippingArticle } from './serviceArticles';

type ContentLink = Readonly<{
  label: string;
  path: string;
}>;

function toContentLink(article: Pick<HelpArticle, 'title' | 'path'>): ContentLink {
  return { label: article.title, path: article.path };
}

export const helpIndexLink = {
  label: 'Help center',
  path: '/help',
} as const;

export const helpArticles = [
  faqArticle,
  shippingArticle,
  returnsArticle,
  powderSafetyArticle,
  storageArticle,
  packSizesArticle,
] as const satisfies readonly HelpArticle<'help'>[];

export const policyArticles = authoredPolicyArticles;

export const helpContentRegistry = [
  ...helpArticles,
  ...policyArticles,
] as const satisfies readonly HelpArticle[];

/** Product-detail links derive labels and routes from canonical help and policy articles. */
export const productFactLinks = {
  powderSafety: toContentLink(powderSafetyArticle),
  storage: toContentLink(storageArticle),
  packSizes: toContentLink(packSizesArticle),
} as const;

export const productCommerceLinks = {
  shipping: toContentLink(shippingArticle),
  returns: toContentLink(returnsArticle),
  privacy: toContentLink(authoredPolicyArticles[0]),
  terms: toContentLink(authoredPolicyArticles[1]),
} as const;

export function getArticlesForGroup(group: 'help'): typeof helpArticles;
export function getArticlesForGroup(group: 'policy'): typeof policyArticles;
export function getArticlesForGroup(group: HelpContentGroup): readonly HelpArticle[];
export function getArticlesForGroup(group: HelpContentGroup): readonly HelpArticle[] {
  return group === 'help' ? helpArticles : policyArticles;
}

export function getHelpArticle(group: 'help', slug: string): HelpArticle<'help'> | undefined;
export function getHelpArticle(group: 'policy', slug: string): HelpArticle<'policy'> | undefined;
export function getHelpArticle(group: HelpContentGroup, slug: string): HelpArticle | undefined;
export function getHelpArticle(group: HelpContentGroup, slug: string): HelpArticle | undefined {
  return getArticlesForGroup(group).find((article) => article.slug === slug);
}
