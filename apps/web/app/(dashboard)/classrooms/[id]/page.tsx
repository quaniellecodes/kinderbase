import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { computeRatio } from '@kinderbase/core';
import { AGE_GROUP_LABELS } from '@kinderbase/types';
import { getClassroom, deleteClassroom } from '../actions';
import { PatternBuilder } from '@/components/classrooms/PatternBuilder';
import { RatioBadge } from '@/components/classrooms/RatioBadge';

type Props = { params: { id: string } };

export default async function ClassroomDetailPage({ params }: Props) {
  const data = await getClassroom(params.id);
  if (!data) notFound();

  const { classroom, state, patterns } = data;
  const ratio = computeRatio(classroom.age_group, classroom.typical_enrollment, 0, state);

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
      <Link
        href="/classrooms"
        className="inline-flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Classrooms
      </Link>

      <div className="bg-white rounded-card border border-gray-100 px-4 py-4 mb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-medium text-gray-900">{classroom.name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{AGE_GROUP_LABELS[classroom.age_group]}</p>
          </div>
          <RatioBadge status={ratio.status} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="bg-gray-50 rounded-lg py-2">
            <p className="text-lg font-medium text-gray-900">{classroom.typical_enrollment}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Enrolled</p>
          </div>
          <div className="bg-gray-50 rounded-lg py-2">
            <p className="text-lg font-medium text-gray-900">{classroom.licensed_capacity}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Licensed cap</p>
          </div>
          <div className="bg-gray-50 rounded-lg py-2">
            <p className="text-lg font-medium text-gray-900">{ratio.requiredStaff}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Min staff</p>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          {state} ratio: 1 staff per {ratio.childrenPerStaff} children · max group {ratio.maxGroupSize}
        </p>
      </div>

      <div className="bg-white rounded-card border border-gray-100 px-4 py-4">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Weekly staffing pattern</h2>
        <PatternBuilder
          classroomId={classroom.id}
          ageGroup={classroom.age_group}
          typicalEnrollment={classroom.typical_enrollment}
          state={state}
          patterns={patterns}
        />
      </div>

      <form
        action={async () => {
          'use server';
          await deleteClassroom(params.id);
        }}
        className="mt-6"
      >
        <button
          type="submit"
          className="text-xs text-red-400 hover:text-red-600"
        >
          Delete classroom
        </button>
      </form>
    </div>
  );
}
