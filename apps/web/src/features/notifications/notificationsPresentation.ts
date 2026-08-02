import type { NotificationKind } from '@shop/contracts/notifications';

const presentation: Record<NotificationKind, { label: string; icon: string }> = {
  'order.placed': { label: 'Order placed', icon: 'Receipt' },
  'order.shipped': { label: 'Order shipped', icon: 'Truck' },
  'order.cancelled': { label: 'Order cancelled', icon: 'CircleX' },
  'standing_order.run_completed': { label: 'Standing order completed', icon: 'CalendarCheck' },
  'standing_order.run_failed': { label: 'Standing order needs attention', icon: 'CalendarX' },
  'payment.webhook_settled': { label: 'Payment settled', icon: 'CreditCard' },
};

export const notificationPresentation = (kind: NotificationKind) => presentation[kind];
