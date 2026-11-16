import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { NotificationPort, PermissionState } from './request-notifier';

const toState = (status: Notifications.PermissionStatus): PermissionState =>
  status === Notifications.PermissionStatus.GRANTED ? 'granted'
    : status === Notifications.PermissionStatus.DENIED ? 'denied' : 'undetermined';

export function configureNotifications() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export const notificationPort: NotificationPort = {
  async permission() {
    if (Platform.OS === 'web') return 'denied';
    return toState((await Notifications.getPermissionsAsync()).status);
  },
  async requestPermission() {
    if (Platform.OS === 'web') return 'denied';
    return toState((await Notifications.requestPermissionsAsync()).status);
  },
  async schedule({ title, body, data }) {
    await Notifications.scheduleNotificationAsync({ content: { title, body, data }, trigger: null });
  },
};
