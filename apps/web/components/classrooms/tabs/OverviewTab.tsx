'use client';

import { useState, useTransition } from 'react';
import { formatAgeMonths } from '@kinderbase/types';
import { Avatar } from '@/components/ui/Avatar';
import { StatCard } from '@/components/ui/StatCard';
import { Button, Card } from '@/components/ui';
import { UpdateItem } from '@/components/children/UpdateItem';
import { BirthdayAlertCard } from '@/components/children/BirthdayAlertCard';
import { clockTime, formatLastPosted } from '@/lib/format';
import { nudgeTeacher, type ClassroomOverview } from '@/app/(dashboard)/classrooms/child-actions';

type Props = {
  classroomId: string;
  overview: ClassroomOverview;
  canEdit: boolean;
  onSeeAll: () => void;
};

function daysSince(iso: string | null): number {
  if (!iso) return Infinity;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Math.floor((start.getTime() - new Date(new Date(iso).toDateString()).getTime()) / 86_400_000);
}

function NudgeButton({ classroomId, teacherId, teacherName }: { classroomId: string; teacherId: string; teacherName: string }) {
  const [sent, setSent] = useState(false);
  const [isPending, start] = useTransition();
  return (
    <Button
      variant="danger"
      size="sm"
      onClick={() => start(async () => { await nudgeTeacher(classroomId, teacherId, teacherName); setSent(true); })}
      disabled={isPending || sent}
      className={`rounded-chip ${sent ? 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-100' : ''}`}
    >
      {sent ? '✓ Sent' : 'Nudge'}
    </Button>
  );
}

export function OverviewTab({ classroomId, overview, canEdit, onSeeAll }: Props) {
  const { glance, accountability, recentUpdates, children, birthdayAlerts, assignedStaff } = overview;

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* LEFT */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Children present" value={glance.childrenPresent} sub={`of ${glance.childrenEnrolled} enrolled`} />
          <StatCard label="Staff present" value={glance.staffPresent} sub={`of ${glance.staffAssigned} assigned`} />
          <StatCard
            label="Current ratio"
            value={glance.currentRatio}
            sub={`req ${glance.requiredRatio}`}
            tone={glance.status === 'violation' ? 'red' : glance.status === 'ok' ? 'green' : 'default'}
          />
        </div>

        {/* Accountability */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-900">Teacher update accountability</h2>
            <span className="text-[11px] text-gray-400">Last 7 days</span>
          </div>
          <div className="divide-y divide-gray-100">
            {accountability.length === 0 && <p className="text-xs text-gray-400 py-2">No staff on this room yet.</p>}
            {accountability.map((t) => {
              const stale = daysSince(t.lastPostedAt) >= 3;
              return (
                <div key={t.userId} className={`flex items-center gap-3 py-2.5 ${stale ? '-mx-4 px-4 bg-red-50/60' : ''}`}>
                  <Avatar name={t.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 truncate">{t.name}</p>
                    <p className="text-[11px] text-gray-400">{t.posts7d} post{t.posts7d === 1 ? '' : 's'}</p>
                  </div>
                  <span className={`text-xs ${stale ? 'text-red-600' : 'text-gray-500'}`}>{formatLastPosted(t.lastPostedAt)}</span>
                  {canEdit && stale && <NudgeButton classroomId={classroomId} teacherId={t.userId} teacherName={t.name} />}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Highlighted red if no post in 3+ days · nudge sends an in-app notification</p>
        </Card>

        {/* Recent activity */}
        <Card>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-medium text-gray-900">Recent activity</h2>
            <button onClick={onSeeAll} className="text-xs font-medium text-brand hover:underline">See all</button>
          </div>
          {recentUpdates.length === 0 ? (
            <p className="text-xs text-gray-400 py-3">No updates yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentUpdates.map((u) => <UpdateItem key={u.id} update={u} />)}
            </ul>
          )}
        </Card>
      </div>

      {/* RIGHT SIDEBAR */}
      <div className="md:w-72 flex-shrink-0 space-y-4">
        <Card>
          <h2 className="text-[11px] uppercase tracking-wide text-gray-400 mb-3">Children — updates today</h2>
          <div className="space-y-2">
            {children.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${c.present ? 'bg-status-green' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-800 flex-1 truncate">{c.name}</span>
                <span className={`text-[11px] px-1.5 py-0.5 rounded-chip ${c.updatesToday > 0 ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {c.updatesToday > 0 ? `${c.updatesToday}` : 'None'}
                </span>
                <span className="text-[11px] text-gray-400 w-10 text-right">{formatAgeMonths(c.ageMonths, 'short')}</span>
              </div>
            ))}
          </div>
        </Card>

        <BirthdayAlertCard alerts={birthdayAlerts} />

        <Card>
          <h2 className="text-[11px] uppercase tracking-wide text-gray-400 mb-3">Assigned staff</h2>
          <div className="space-y-2">
            {assignedStaff.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <Avatar name={s.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 truncate">{s.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {s.present && s.clockedInAt ? `in since ${clockTime(s.clockedInAt)}` : 'not clocked in'}
                  </p>
                </div>
                <span className={`text-[11px] px-1.5 py-0.5 rounded-chip ${s.present ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                  {s.present ? 'In' : 'Out'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
