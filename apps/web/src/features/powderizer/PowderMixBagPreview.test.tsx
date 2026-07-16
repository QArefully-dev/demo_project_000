import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PowderMixBagPreview } from './PowderMixBagPreview';
import type { BuilderConfig } from './powderizerState';

const config: BuilderConfig = {
  components: [
    { productId: '1', percentage: 50 },
    { productId: '2', percentage: 50 },
  ],
  bagSizeGrams: 500,
  fineness: 'standard',
  customLabel: 'Inspection mix',
  bagColourScheme: 'ultraviolet-cyan',
};

describe('PowderMixBagPreview', () => {
  it('supports click, keyboard, pointer and reset zoom controls', async () => {
    const user = userEvent.setup();
    render(<PowderMixBagPreview config={config} priceVersion="powderizer-v1" />);
    const preview = screen.getByRole('button', { name: 'Zoom into Inspection mix bag preview' });
    const artwork = preview.querySelector('svg')!;
    Object.defineProperty(preview, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    });

    fireEvent.pointerMove(preview, { clientX: 40, clientY: 40 });
    expect(artwork).toHaveStyle({ transformOrigin: '50% 50%' });

    await user.click(preview);
    expect(preview).toHaveAttribute('aria-pressed', 'true');
    fireEvent.pointerMove(preview, { clientX: 40, clientY: 40 });
    expect(artwork.style.transformOrigin).not.toBe('50% 50%');

    await user.keyboard('{Escape}');
    expect(preview).toHaveAttribute('aria-pressed', 'false');
    await user.keyboard('{Enter}');
    expect(preview).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(preview).toHaveAttribute('aria-pressed', 'false');

    preview.focus();
    await user.keyboard(' ');
    expect(preview).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps touch zoom centered', async () => {
    const user = userEvent.setup();
    render(<PowderMixBagPreview config={config} priceVersion="powderizer-v1" />);
    const preview = screen.getByRole('button', { name: 'Zoom into Inspection mix bag preview' });
    const artwork = preview.querySelector('svg')!;
    Object.defineProperty(preview, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    });

    await user.click(preview);
    const touchMove = new Event('pointermove', { bubbles: true });
    Object.defineProperties(touchMove, {
      clientX: { value: 10 },
      clientY: { value: 10 },
      pointerType: { value: 'touch' },
    });
    fireEvent(preview, touchMove);
    expect(artwork).toHaveStyle({ transformOrigin: '50% 50%' });
  });

  it('renders the server usage label and resets zoom when it changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <PowderMixBagPreview
        config={config}
        priceVersion="powderizer-v1"
        usageLabel="Not for consumption"
      />,
    );
    const preview = screen.getByRole('button', { name: 'Zoom into Inspection mix bag preview' });

    expect(screen.getByLabelText('Server usage label')).toHaveTextContent('Not for consumption');
    await user.click(preview);
    expect(preview).toHaveAttribute('aria-pressed', 'true');

    rerender(
      <PowderMixBagPreview
        config={config}
        priceVersion="powderizer-v1"
        usageLabel="Consumable powder"
      />,
    );
    expect(screen.getByLabelText('Server usage label')).toHaveTextContent('Consumable powder');
    expect(preview).toHaveAttribute('aria-pressed', 'false');
  });
});
