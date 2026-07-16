import { faqArticle } from './faqArticle';
import { type HelpArticle, type HelpContentGroup } from './helpContentTypes';
import { policyArticles as authoredPolicyArticles } from './policyArticles';
import { powderSafetyArticle, storageArticle } from './powderGuidanceArticles';
import { packSizesArticle, returnsArticle, shippingArticle } from './serviceArticles';

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
