import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HelpArticlePage } from './HelpArticlePage';
import { HelpIndexPage } from './HelpIndexPage';

function renderHelpRoute(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/help" element={<HelpIndexPage />} />
        <Route path="/help/:slug" element={<HelpArticlePage group="help" />} />
        <Route path="/policies/:slug" element={<HelpArticlePage group="policy" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Help pages', () => {
  it('renders a grouped, linked help index with semantic sections and lists', () => {
    renderHelpRoute('/help');

    expect(screen.getByRole('heading', { level: 1, name: 'Help center' })).toBeInTheDocument();

    const helpTopics = screen.getByRole('heading', { level: 2, name: 'Help topics' });
    const policyTopics = screen.getByRole('heading', { level: 2, name: 'Demo policies' });
    expect(helpTopics).toBeInTheDocument();
    expect(policyTopics).toBeInTheDocument();

    const helpSection = helpTopics.closest('section');
    const policySection = policyTopics.closest('section');
    expect(helpSection).not.toBeNull();
    expect(policySection).not.toBeNull();

    expect(within(helpSection as HTMLElement).getByRole('list')).toBeInTheDocument();
    expect(within(policySection as HTMLElement).getByRole('list')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Frequently asked questions' })).toHaveAttribute(
      'href',
      '/help/faq',
    );
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/policies/privacy',
    );
  });

  it('renders articles through shared heading, list, and notice semantics', () => {
    renderHelpRoute('/help/shipping');

    expect(screen.getByRole('article', { name: 'Shipping' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Shipping' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'No real delivery service' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('note', { name: 'No real delivery service' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Help center' })).toHaveAttribute(
      'href',
      '/help',
    );
  });

  it('uses direct native summary disclosure for FAQ entries', () => {
    const { container } = renderHelpRoute('/help/faq');

    const details = screen.getByText('Is this a real shop?').closest('details');
    expect(details).not.toBeNull();
    expect(details?.firstElementChild?.tagName).toBe('SUMMARY');
    expect(details?.querySelector(':scope > summary')).toHaveTextContent('Is this a real shop?');
    expect(container.querySelectorAll('details > summary')).toHaveLength(6);
  });

  it.each([
    ['/help/missing', 'help'],
    ['/policies/missing', 'policy'],
  ])('renders the shared 404 for an unknown %s slug', (path) => {
    renderHelpRoute(path);

    expect(screen.getByRole('heading', { level: 1, name: '404' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Page not found' })).toBeInTheDocument();
  });
});
