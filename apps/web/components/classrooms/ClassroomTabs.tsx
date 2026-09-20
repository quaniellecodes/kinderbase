'use client';

import { useState } from 'react';
import type { ClassroomStaffingView } from '@kinderbase/types';
import { Card, TabBar } from '@/components/ui';
import { StaffingPatternGrid } from '@/components/classrooms/StaffingPatternGrid';
import { ClassroomHoursEditor } from '@/components/classrooms/ClassroomHoursEditor';
import { ComarModeBadge } from '@/components/classrooms/ComarModeBadge';
import { OverviewTab } from '@/components/classrooms/tabs/OverviewTab';
import { ActivityFeedTab } from '@/components/classrooms/tabs/ActivityFeedTab';
import { ChildrenTab } from '@/components/classrooms/tabs/ChildrenTab';
import type { ClassroomOverview, ChildCard, FeedUpdate } from '@/app/(dashboard)/classrooms/child-actions';
import type {
  CenterMemberOption,
  ClassroomHoursInfo,
  ClassroomRatioInfo,
} from '@/app/(dashboard)/classrooms/actions';

type Tab = 'overview' | 'activity' | 'staffing' | 'children';

type Props = {
  classroomId: string;
  canEdit: boolean;
  initialTab: Tab;
  overview: ClassroomOverview;
  updates: FeedUpdate[];
  childrenCards: ChildCard[];
  staffing: {
    view: ClassroomStaffingView;
    members: CenterMemberOption[];
    hours: ClassroomHoursInfo;
    ratio: ClassroomRatioInfo;
  };
};

export function ClassroomTabs({ classroomId, canEdit, initialTab, overview, updates, childrenCards, staffing }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const today = new Date().toDateString();
  const updatesToday = updates.filter((u) => new Date(u.createdAt).toDateString() === today).length;
  const childOptions = overview.children.map((c) => ({ id: c.id, name: c.name }));

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'activity', label: 'Activity feed', badge: updatesToday || undefined },
    { key: 'staffing', label: 'Staffing pattern' },
    { key: 'children', label: 'Children' },
  ];

  return (
    <div>
      <TabBar className="mb-5" items={tabs} active={tab} onSelect={(k) => setTab(k as Tab)} />

      {tab === 'overview' && (
        <OverviewTab classroomId={classroomId} overview={overview} canEdit={canEdit} onSeeAll={() => setTab('activity')} />
      )}

      {tab === 'activity' && (
        <ActivityFeedTab classroomId={classroomId} updates={updates} children={childOptions} />
      )}

      {tab === 'staffing' && (
        <div>
          <ComarModeBadge classroomId={classroomId} ratio={staffing.ratio} canEdit={canEdit} />
          {canEdit && <ClassroomHoursEditor classroomId={classroomId} hours={staffing.hours} view={staffing.view} />}
          <Card>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-medium text-gray-900">Weekly staffing pattern</h2>
              {!canEdit && <span className="text-[10px] text-gray-400">View only</span>}
            </div>
            <StaffingPatternGrid
              key={`${staffing.view.openSlot}-${staffing.view.closeSlot}-${staffing.view.operatingDays.join(',')}`}
              view={staffing.view}
              canEdit={canEdit}
              members={staffing.members}
            />
          </Card>
        </div>
      )}

      {tab === 'children' && <ChildrenTab children={childrenCards} />}
    </div>
  );
}
