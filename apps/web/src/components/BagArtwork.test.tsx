import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BagArtwork } from './BagArtwork';

describe('BagArtwork', () => {
  it('uses catalog accent for the paper-square label and balances title lines by characters', () => {
    const { container } = render(
      <BagArtwork
        name="Supercalifragilistic Tiny Tiny"
        category="Test"
        quantity="1kg"
        batchCode="TST-01"
        mark="TST"
        accent="#287fa6"
        powderAccent="#b9e2ee"
        consumptionLabel={null}
      />,
    );

    expect(container.querySelector('rect[width="320"][height="236"]')).toHaveAttribute(
      'fill',
      '#287fa6',
    );
    expect(screen.getByText('SUPERCALIFRAGILISTIC')).toBeInTheDocument();
    expect(screen.getByText('TINY TINY')).toBeInTheDocument();
  });
});
