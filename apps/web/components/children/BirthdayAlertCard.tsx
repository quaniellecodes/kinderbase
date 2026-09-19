import { Cake } from 'lucide-react';
import { AGE_GROUP_LABELS, type AgeGroup } from '@kinderbase/types';

type Alert = { childName: string; days: number; toGroup: AgeGroup };

/** Amber card shown when a child crosses a COMAR age group within 14 days. */
export function BirthdayAlertCard({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  const a = alerts[0]!;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-card p-4">
      <div className="flex items-center gap-1.5 mb-1">
        <Cake className="w-4 h-4 text-amber-700" />
        <p className="text-sm font-medium text-amber-900">Birthday alert</p>
      </div>
      <p className="text-xs text-amber-800 leading-relaxed">
        {a.childName} reaches {a.days === 0 ? 'a new age group today' : `${a.days} day${a.days === 1 ? '' : 's'} from now`} —
        review room assignment before {AGE_GROUP_LABELS[a.toGroup]} ratio rules apply.
      </p>
      {alerts.length > 1 && (
        <p className="text-[11px] text-amber-700 mt-1.5">+{alerts.length - 1} more upcoming</p>
      )}
    </div>
  );
}
