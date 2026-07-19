import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  productCommerceLinks,
  productFactLinks,
} from '@/features/help/content/helpContentRegistry';
import { ProductContextLinks } from './ProductContextLinks';

function renderLinks(packagingQuantity?: string) {
  return render(
    <MemoryRouter>
      <ProductContextLinks packagingQuantity={packagingQuantity} />
    </MemoryRouter>,
  );
}

describe('ProductContextLinks', () => {
  it('shows pack-size guidance only when a packaging quantity exists', () => {
    const { rerender } = renderLinks();
    expect(
      screen.queryByRole('link', { name: productFactLinks.packSizes.label }),
    ).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ProductContextLinks packagingQuantity="500g" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: productFactLinks.packSizes.label })).toHaveAttribute(
      'href',
      productFactLinks.packSizes.path,
    );
  });

  it('renders only canonical registry labels and paths', () => {
    renderLinks('250g');

    for (const link of [
      ...Object.values(productFactLinks),
      ...Object.values(productCommerceLinks),
    ]) {
      expect(screen.getByRole('link', { name: link.label })).toHaveAttribute('href', link.path);
    }
  });
});
