import { redirect } from 'next/navigation';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { getOrgSettings, getStaffPins, getCenterHours } from './actions';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  const active = getActiveContextFromCookies();
  if (!active) redirect('/dashboard');
  if (!isAdmin(active.role)) redirect('/dashboard');

  const [settings, staffPins, hours] = await Promise.all([
    getOrgSettings(active.centerId),
    getStaffPins(active.centerId),
    getCenterHours(active.centerId),
  ]);
  if (!settings) redirect('/dashboard');

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
      <h1 className="text-lg font-medium text-gray-900 mb-6">Settings</h1>
      <SettingsClient
        orgId={settings.orgId}
        centerId={settings.centerId}
        initialColor={settings.primaryColor}
        initialIconUrl={settings.iconUrl}
        staffPins={staffPins}
        initialHours={hours}
      />
    </div>
  );
}
