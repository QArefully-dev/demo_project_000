import type { Notification } from '@shop/contracts/notifications';
import { Button } from '@/components/ui/button';
import { notificationPresentation } from './notificationsPresentation';

export function NotificationList({
  items,
  onMarkRead,
}: {
  items: Notification[];
  onMarkRead: (id: string) => void;
}) {
  return (
    <ul className="space-y-2" aria-label="Notifications">
      {items.map((item) => {
        const detail = notificationPresentation(item.kind);
        return (
          <li key={item.id} className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">{detail.label}</p>
                <h2 className="font-semibold">{item.title}</h2>
                <p>{item.body}</p>
                <time className="text-sm text-muted-foreground" dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleString('en-GB')}
                </time>
              </div>
              {item.readAt === null && (
                <Button size="sm" variant="outline" onClick={() => onMarkRead(item.id)}>
                  Mark as read
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
