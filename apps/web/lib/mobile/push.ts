import { isNative } from './capacitor';

export async function registerPushNotifications(userId: string): Promise<void> {
  if (!isNative) return;

  const { PushNotifications } = await import('@capacitor/push-notifications');

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();

  await PushNotifications.addListener('registration', async (token) => {
    await fetch('/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token.value, userId }),
    });
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data as { screen?: string; centerId?: string };
    if (data.screen) {
      window.location.href = `/${data.screen}?centerId=${data.centerId ?? ''}`;
    }
  });
}
