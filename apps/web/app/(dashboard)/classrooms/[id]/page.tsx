import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { AGE_GROUP_LABELS } from '@kinderbase/types';
import { getClassroom, deleteClassroom } from '../actions';
import { getClassroomOverview, getClassroomChildren, getChildUpdates } from '../child-actions';
import { ClassroomTabs } from '@/components/classrooms/ClassroomTabs';
import { RatioBadge } from '@/components/classrooms/RatioBadge';

type Tab = 'overview' | 'activity' | 'staffing' | 'children';
type Props = { params: { id: string }; searchParams: { tab?: string } };

function normalizeTab(t?: string): Tab {
  return t === 'activity' || t === 'staffing' || t === 'children' ? t : 'overview';
}

export default async function ClassroomDetailPage({ params, searchParams }: Props) {
  const data = await getClassroom(params.id);
  if (!data) notFound();

  const [overview, childrenCards, updates] = await Promise.all([
    getClassroomOverview(params.id),
    getClassroomChildren(params.id),
    getChildUpdates(params.id),
  ]);
  if (!overview) notFound();

  const { view, canEdit, members, hours, ratio } = data;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Dashboard
      </Link>

      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h1 className="text-lg font-medium text-gray-900">{view.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{AGE_GROUP_LABELS[view.ageGroup]}</p>
        </div>
        <RatioBadge status={overview.glance.status} />
      </div>

      <ClassroomTabs
        classroomId={view.classroomId}
        canEdit={canEdit}
        initialTab={normalizeTab(searchParams.tab)}
        overview={overview}
        updates={updates}
        childrenCards={childrenCards}
        staffing={{ view, members, hours, ratio }}
      />

      {canEdit && (
        <form
          action={async () => {
            'use server';
            await deleteClassroom(params.id);
          }}
          className="mt-8"
        >
          <button type="submit" className="text-xs text-red-400 hover:text-red-600">
            Delete classroom
          </button>
        </form>
      )}
    </div>
  );
}
