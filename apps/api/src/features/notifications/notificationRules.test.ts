import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationDedupeKey, shouldEmailNotification } from './notificationRules.js';

const defaults = { orderUpdatesEmail: true, marketingEmail: false, approvalRequestEmail: true };
void test('notification email rules gate every current notification kind', () => {
  for (const kind of [
    'order.placed',
    'order.shipped',
    'order.cancelled',
    'standing_order.run_completed',
    'standing_order.run_failed',
    'payment.webhook_settled',
  ] as const)
    assert.equal(shouldEmailNotification(kind, { ...defaults, orderUpdatesEmail: false }), false);
  assert.equal(notificationDedupeKey(7, 'order.placed', 'order', '42'), '7:order.placed:order:42');
});
