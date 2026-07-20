import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Static } from '@sinclair/typebox';
import type { IncompatibleGroupError } from '@shop/contracts/customPowder';
import { CompatibilityGuard } from './CompatibilityGuard';

function error(
  overrides: Partial<Static<typeof IncompatibleGroupError>> = {},
): Static<typeof IncompatibleGroupError> {
  return {
    error: 'MIXING_GROUP_MISMATCH',
    conflictingProductIds: ['1', '2'],
    groupInfo: [
      { productId: '1', mixingGroup: 'food' },
      { productId: '2', mixingGroup: 'cleaning' },
    ],
    ...overrides,
  };
}

const names = new Map([
  ['1', 'Protein Powder'],
  ['2', 'Bleach Powder'],
]);

describe('CompatibilityGuard', () => {
  it('renders nothing when error is null', () => {
    const { container } = render(
      <CompatibilityGuard error={null} productNamesById={names} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders mixing group mismatch with product names and groups', () => {
    render(<CompatibilityGuard error={error()} productNamesById={names} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mixing group mismatch' })).toBeInTheDocument();
    expect(screen.getByText('Protein Powder')).toBeInTheDocument();
    expect(screen.getByText('Group: food')).toBeInTheDocument();
    expect(screen.getByText('Bleach Powder')).toBeInTheDocument();
    expect(screen.getByText('Group: cleaning')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The selected powders belong to incompatible mixing groups and cannot be combined together.',
      ),
    ).toBeInTheDocument();
  });

  it('falls back to product ID when name is unknown', () => {
    render(
      <CompatibilityGuard
        error={error({
          conflictingProductIds: ['99'],
          groupInfo: [{ productId: '99', mixingGroup: 'mystery' }],
        })}
        productNamesById={new Map()}
      />,
    );
    expect(screen.getByText('Product 99')).toBeInTheDocument();
  });

  it('handles null mixing groups in group info', () => {
    render(
      <CompatibilityGuard
        error={error({
          groupInfo: [
            { productId: '1', mixingGroup: null },
            { productId: '2', mixingGroup: null },
          ],
        })}
        productNamesById={names}
      />,
    );
    expect(screen.getAllByText('Group: unknown')).toHaveLength(2);
  });

  it('renders multiple conflicting products', () => {
    render(
      <CompatibilityGuard
        error={error({
          conflictingProductIds: ['1', '2', '3'],
          groupInfo: [
            { productId: '1', mixingGroup: 'food' },
            { productId: '2', mixingGroup: 'cleaning' },
            { productId: '3', mixingGroup: 'garden' },
          ],
        })}
        productNamesById={
          new Map([
            ['1', 'Protein'],
            ['2', 'Bleach'],
            ['3', 'Fertilizer'],
          ])
        }
      />,
    );
    const listItems = screen.getByRole('list', { name: 'Conflicting products' }).children;
    expect(listItems).toHaveLength(3);
  });
});
