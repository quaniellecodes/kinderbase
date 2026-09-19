import { Capacitor } from '@capacitor/core';
import type { ActiveContext } from '@kinderbase/types';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';

export async function scanDocument(): Promise<string | null> {
  if (!isNative) return null;
  const { Camera } = await import('@capacitor/camera');
  const { CameraResultType, CameraSource } = await import('@capacitor/camera');
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    quality: 90,
  });
  return photo.dataUrl ?? null;
}

export async function authenticateBiometric(): Promise<boolean> {
  if (!isNative) return true;
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    await BiometricAuth.authenticate({
      reason: 'Confirm your identity to clock in',
      cancelTitle: 'Cancel',
    });
    return true;
  } catch {
    return false;
  }
}

export async function hapticSuccess(): Promise<void> {
  if (!isNative) return;
  const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
  await Haptics.impact({ style: ImpactStyle.Medium });
}

export async function getNativeActiveContext(): Promise<ActiveContext | null> {
  if (!isNative) return null;
  const { Preferences } = await import('@capacitor/preferences');
  const { value } = await Preferences.get({ key: 'active_context' });
  return value ? (JSON.parse(value) as ActiveContext) : null;
}

export async function setNativeActiveContext(ctx: ActiveContext): Promise<void> {
  if (!isNative) return;
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.set({ key: 'active_context', value: JSON.stringify(ctx) });
}

export async function clearNativeActiveContext(): Promise<void> {
  if (!isNative) return;
  const { Preferences } = await import('@capacitor/preferences');
  await Preferences.remove({ key: 'active_context' });
}
