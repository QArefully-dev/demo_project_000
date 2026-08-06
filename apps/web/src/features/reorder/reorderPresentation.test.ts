import { describe, expect, it } from 'vitest';
import { SKIP_REASONS, skipReasonMessage } from './reorderPresentation';

describe('reorder presentation', () => {
  it('explains the country restriction and includes it in the derived reason list', () => {
    expect(skipReasonMessage('BLOCKED_IN_COUNTRY')).toBe(
      'This item cannot be ordered in your country.',
    );
    expect(SKIP_REASONS).toContain('BLOCKED_IN_COUNTRY');
  });
});
