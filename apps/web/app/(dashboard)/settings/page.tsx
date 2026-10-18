import { redirect } from 'next/navigation';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { Card } from '@/components/ui';
import { startSampleEmulation } from '@/lib/parent/emulation';
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

      {/* Seeing the parent app (PARENT-DECISIONS §7c) — director only. */}
      {active.role === 'director' && (
        <div className="mt-6">
          <Card>
            <h2 className="text-sm font-medium text-gray-900 mb-1">Seeing the parent app</h2>
            <p className="text-xs text-gray-400 mb-4">
              Open the seeded sample family to see exactly what a parent sees — read-only, and never counted in ratios or reports.
            </p>
            <form action={startSampleEmulation.bind(null, settings.centerId)}>
              <button type="submit" className="text-sm bg-brand text-white px-4 py-2 rounded-lg font-medium">Open sample family</button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
