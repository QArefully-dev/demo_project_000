import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Product } from '@shop/contracts';
import { describe, expect, it } from 'vitest';
import { ProductGallery } from './ProductGallery';

const product = (images: Product['images'], imageSetId = 'powdered-water'): Product => ({
  id: 'powdered-water',
  name: 'Powdered Water',
  description: 'Just-add-water water powder, 300g. Dry until required.',
  priceCents: 12999,
  imageSetId,
  images,
  category: 'Impossible',
  stock: 8,
  slug: 'powdered-water',
  salesCount: 12,
});

const primaryImage = {
  src: '/images/powdered-water-primary.webp',
  alt: 'Powdered Water powder bag',
  width: 1200,
  height: 1200,
};

describe('ProductGallery', () => {
  it('does not render image-selection controls for a single image', () => {
    render(<ProductGallery product={product([primaryImage])} />);

    expect(screen.queryByRole('button', { name: /view image/i })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Powdered Water powder bag' }).tagName).toBe('svg');
  });

  it('selects images by click and keyboard while keeping the selected thumbnail focused', async () => {
    const user = userEvent.setup();
    render(
      <ProductGallery
        product={product(
          [
            primaryImage,
            {
              src: '/images/powdered-water-side.webp',
              alt: 'Powdered Water side label',
              width: 1200,
              height: 1200,
            },
          ],
          'retired-set',
        )}
      />,
    );

    const first = screen.getByRole('button', { name: 'View image 1 of 2' });
    const second = screen.getByRole('button', { name: 'View image 2 of 2' });

    await user.click(second);
    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('img', { name: 'Powdered Water side label' })[0]).toHaveAttribute(
      'loading',
      'eager',
    );

    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard('{Home}');
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('img', { name: 'Powdered Water powder bag' })[0]).toHaveAttribute(
      'loading',
      'eager',
    );
  });
});
