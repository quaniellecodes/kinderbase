import { CENTER_ROLE_LABELS } from '@kinderbase/types';
import { Avatar } from '@/components/ui/Avatar';
import { StaffScore } from './StaffScore';
import type { StaffHeader } from '@/app/(dashboard)/staff/[userId]/actions';

function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function StaffHero({ header, centerName }: { header: StaffHeader; centerName: string }) {
  const attendanceTone =
    header.attendancePct >= 90 ? 'text-status-green' : header.attendancePct >= 80 ? 'text-status-amber' : 'text-status-red';

  return (
    <div className="bg-white rounded-card border border-gray-100 overflow-hidden">
      <div className="h-[68px]" style={{ background: 'linear-gradient(135deg, var(--color-brand-primary), rgb(var(--color-brand-rgb)))' }} />
      <div className="px-4 pb-4">
        <div className="flex items-start justify-between -mt-9">
          <div className="rounded-full border-[3px] border-white">
            <Avatar name={header.fullName} size="xl" />
          </div>
          <span className="mt-11 inline-flex items-center gap-1.5 text-xs font-medium">
            <span className={`w-2 h-2 rounded-full ${header.clockedIn ? 'bg-status-green' : 'bg-gray-300'}`} />
            <span className={header.clockedIn ? 'text-status-green' : 'text-gray-400'}>
              {header.clockedIn ? 'Clocked in' : 'Clocked out'}
            </span>
          </span>
        </div>

        <h1 className="text-lg font-medium text-gray-900 mt-2">{header.fullName}</h1>
        <p className="text-xs text-gray-500">
          {CENTER_ROLE_LABELS[header.role]}{header.roomName ? ` · ${header.roomName}` : ''}
        </p>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {header.roomName && <span className="text-[11px] px-2 py-0.5 rounded-chip bg-blue-50 text-blue-700">{header.roomName}</span>}
          <span className="text-[11px] px-2 py-0.5 rounded-chip bg-green-50 text-green-700">{CENTER_ROLE_LABELS[header.role]}</span>
          {header.hireDate && <span className="text-[11px] px-2 py-0.5 rounded-chip bg-gray-100 text-gray-600">Since {monthYear(header.hireDate)}</span>}
        </div>

        <StaffScore
          mode={header.admin ? 'admin' : 'employee'}
          name={header.fullName}
          centerName={centerName}
          score={header.score}
          attendancePct={header.attendancePct}
        />

        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="bg-gray-50 rounded-lg py-2">
            <p className={`text-lg font-medium ${attendanceTone}`}>{header.attendancePct}%</p>
            <p className="text-[10px] text-gray-400">Attendance</p>
          </div>
          <div className="bg-gray-50 rounded-lg py-2">
            <p className="text-lg font-medium text-gray-900">{header.tenureYears} yr{header.tenureYears === 1 ? '' : 's'}</p>
            <p className="text-[10px] text-gray-400">Tenure</p>
          </div>
          <div className="bg-gray-50 rounded-lg py-2">
            <p className={`text-lg font-medium ${header.expiringCreds > 0 ? 'text-status-amber' : 'text-gray-900'}`}>{header.expiringCreds}</p>
            <p className="text-[10px] text-gray-400">Expiring creds</p>
          </div>
        </div>
      </div>
    </div>
  );
}
