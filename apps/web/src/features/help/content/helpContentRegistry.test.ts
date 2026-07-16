import { describe, expect, it } from 'vitest';
import { faqEntryIds, type HelpContentGroup } from './helpContentTypes';
import {
  getArticlesForGroup,
  getHelpArticle,
  helpArticles,
  helpContentRegistry,
  helpIndexLink,
  policyArticles,
} from './helpContentRegistry';

const requiredPaths = [
  '/help/faq',
  '/help/shipping',
  '/help/returns',
  '/help/powder-safety',
  '/help/storage',
  '/help/pack-sizes',
  '/policies/privacy',
  '/policies/terms',
];

describe('helpContentRegistry', () => {
  it('uses the complete canonical route set in navigation order', () => {
    expect(helpIndexLink).toEqual({ label: 'Help center', path: '/help' });
    expect(helpContentRegistry.map((article) => article.path)).toEqual(requiredPaths);
  });

  it('contains uniquely identified, nonempty articles', () => {
    expect(new Set(helpContentRegistry.map((article) => article.id)).size).toBe(
      helpContentRegistry.length,
    );
    expect(new Set(helpContentRegistry.map((article) => article.slug)).size).toBe(
      helpContentRegistry.length,
    );
    expect(new Set(helpContentRegistry.map((article) => article.path)).size).toBe(
      helpContentRegistry.length,
    );

    for (const article of helpContentRegistry) {
      expect(article.title.trim()).not.toBe('');
      expect(article.summary.trim()).not.toBe('');
      expect(article.blocks).not.toHaveLength(0);
      expect(article.blocks.every((block) => block.id.trim() !== '')).toBe(true);
      expect(new Set(article.blocks.map((block) => block.id)).size).toBe(article.blocks.length);
    }
  });

  it('keeps group and path prefixes paired', () => {
    for (const article of helpContentRegistry) {
      const expectedPrefix = article.group === 'help' ? '/help/' : '/policies/';
      expect(article.path).toBe(`${expectedPrefix}${article.slug}`);
    }
  });

  it('exposes readonly group selectors and exact group-and-slug lookup', () => {
    expect(getArticlesForGroup('help')).toEqual(helpArticles);
    expect(getArticlesForGroup('policy')).toEqual(policyArticles);

    for (const group of ['help', 'policy'] as const satisfies readonly HelpContentGroup[]) {
      for (const article of getArticlesForGroup(group)) {
        expect(getHelpArticle(group, article.slug)).toBe(article);
      }
    }

    expect(getHelpArticle('help', 'privacy')).toBeUndefined();
    expect(getHelpArticle('policy', 'faq')).toBeUndefined();
    expect(getHelpArticle('help', 'missing')).toBeUndefined();
  });

  it('keeps FAQ identifiers and questions unique', () => {
    const faqBlock = getHelpArticle('help', 'faq')?.blocks.find((block) => block.kind === 'faq');

    expect(faqBlock).toBeDefined();
    if (faqBlock?.kind !== 'faq') {
      throw new Error('FAQ article must contain a FAQ block.');
    }

    expect(faqBlock.entries.map((entry) => entry.id)).toEqual(faqEntryIds);
    expect(new Set(faqBlock.entries.map((entry) => entry.id)).size).toBe(faqBlock.entries.length);
    expect(new Set(faqBlock.entries.map((entry) => entry.question)).size).toBe(
      faqBlock.entries.length,
    );
    expect(faqBlock.entries.every((entry) => entry.question.trim() !== '')).toBe(true);
  });
});
