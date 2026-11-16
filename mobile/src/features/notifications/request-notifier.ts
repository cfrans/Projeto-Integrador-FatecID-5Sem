import type { RequestBannerItem } from '../access/request-banner-state.ts';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export type NotificationPort = {
  permission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  schedule(notification: { title: string; body: string; data: Record<string, string> }): Promise<void>;
};

export type NotificationText = {
  title: string;
  single(values: { requester: string; application: string; computer: string }): string;
  many(count: number): string;
};

export function createRequestNotifier(port: NotificationPort, text: NotificationText) {
  return {
    async ensurePermission() {
      const current = await port.permission();
      if (current === 'granted') return true;
      if (current === 'denied') return false;
      return (await port.requestPermission()) === 'granted';
    },
    async notify(items: RequestBannerItem[]) {
      if (items.length === 0 || (await port.permission()) !== 'granted') return false;
      if (items.length > 1) {
        await port.schedule({ title: text.title, body: text.many(items.length), data: { route: 'access-requests' } });
        return true;
      }
      const [{ computer, request }] = items;
      await port.schedule({
        title: text.title,
        body: text.single({ requester: request.requesterName, application: request.applicationName, computer: computer.name }),
        data: { route: 'access-request', deviceId: computer.id, requestId: request.id },
      });
      return true;
    },
  };
}
