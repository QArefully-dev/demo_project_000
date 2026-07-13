import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Product } from '@shop/contracts';
import { describe, expect, it } from 'vitest';
import { ProductGallery } from './ProductGallery';

const product = (images: Product['images']): Product => ({
  id: 'headphones',
  name: 'Wireless headphones',
  description: 'Comfortable over-ear headphones.',
  priceCents: 12999,
  imageSetId: 'headphones',
  images,
  category: 'Audio',
  stock: 8,
  slug: 'wireless-headphones',
  salesCount: 12,
});

const primaryImage = {
  src: '/images/headphones-primary.webp',
  alt: 'Wireless headphones front view',
  width: 1200,
  height: 1200,
};

describe('ProductGallery', () => {
  it('does not render image-selection controls for a single image', () => {
    render(<ProductGallery product={product([primaryImage])} />);

    expect(screen.queryByRole('button', { name: /view image/i })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Over-ear headphones' })).toHaveAttribute(
      'loading',
      'eager',
    );
  });

  it('selects images by click and keyboard while keeping the selected thumbnail focused', async () => {
    const user = userEvent.setup();
    render(
      <ProductGallery
        product={product([
          primaryImage,
          {
            src: '/images/headphones-side.webp',
            alt: 'Wireless headphones side view',
            width: 1200,
            height: 1200,
          },
        ])}
      />,
    );

    const first = screen.getByRole('button', { name: 'View image 1 of 2' });
    const second = screen.getByRole('button', { name: 'View image 2 of 2' });

    await user.click(second);
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getAllByRole('img', { name: 'Wireless headphones side view' })[0],
    ).toHaveAttribute('loading', 'eager');

    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard('{Home}');
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('img', { name: 'Over-ear headphones' })[0]).toHaveAttribute(
      'loading',
      'eager',
    );
  });
});
