'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  LayoutGrid,
  List,
  Baby,
  UserPlus,
  AlertTriangle,
  FileWarning,
  ArrowUpCircle,
} from 'lucide-react';
import { Card, Badge, Input, Select, buttonVariants, StatusDot, EmptyState, type BadgeTone } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { StudentCard, EnrollmentStatus } from './actions';

type Props = {
  students: StudentCard[];
  classrooms: { id: string; name: string }[];
  tags: string[];
  canAdd: boolean;
};

const STATUS_META: Record<EnrollmentStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Active', tone: 'green' },
  waitlist: { label: 'Waitlist', tone: 'amber' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  graduated: { label: 'Graduated', tone: 'blue' },
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function AlertIcons({ alerts }: { alerts: StudentCard['alerts'] }) {
  if (!alerts.severeAllergy && !alerts.missingDocs && !alerts.reclass) return null;
  return (
    <div className="flex items-center gap-1.5">
      {alerts.severeAllergy && (
        <span title="Severe allergy" className="text-status-red">
          <AlertTriangle className="w-3.5 h-3.5" />
        </span>
      )}
      {alerts.missingDocs > 0 && (
        <span title={`${alerts.missingDocs} required document${alerts.missingDocs > 1 ? 's' : ''} missing`} className="text-status-amber">
          <FileWarning className="w-3.5 h-3.5" />
        </span>
      )}
      {alerts.reclass && (
        <span
          title={`Moves to ${alerts.reclass.toLabel} in ${alerts.reclass.days} day${alerts.reclass.days === 1 ? '' : 's'}`}
          className="text-blue-500"
        >
          <ArrowUpCircle className="w-3.5 h-3.5" />
        </span>
      )}
    </div>
  );
}

function StudentGridCard({ s }: { s: StudentCard }) {
  const status = STATUS_META[s.enrollmentStatus];
  return (
    <Link href={`/students/${s.id}`} className="group">
      <Card padding="none" className="h-full p-4 hover:border-brand/40 transition-colors">
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-11 h-11 rounded-full bg-brand flex items-center justify-center text-sm font-medium text-white">
              {initials(s.name)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
              <StatusDot tone={s.present ? 'green' : 'gray'} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-brand">{s.name}</p>
            <p className="text-xs text-gray-400 truncate">
              {s.ageLabel}
              {s.classroomName ? ` · ${s.classroomName}` : ' · Unassigned'}
            </p>
          </div>
          <AlertIcons alerts={s.alerts} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-3">
          {s.enrollmentStatus !== 'active' && (
            <Badge tone={status.tone} size="sm">
              {status.label}
            </Badge>
          )}
          {s.present && (
            <Badge tone="green" size="sm">
              Signed in
            </Badge>
          )}
          {s.tags.map((t) => (
            <Badge key={t} tone="neutral" size="sm">
              {t}
            </Badge>
          ))}
        </div>
      </Card>
    </Link>
  );
}

function StudentListRow({ s }: { s: StudentCard }) {
  const status = STATUS_META[s.enrollmentStatus];
  return (
    <Link href={`/students/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group">
      <div className="relative flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-sm font-medium text-white">
          {initials(s.name)}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
          <StatusDot tone={s.present ? 'green' : 'gray'} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-brand">{s.name}</p>
          {s.enrollmentStatus !== 'active' && (
            <Badge tone={status.tone} size="sm">
              {status.label}
            </Badge>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">
          {s.ageLabel}
          {s.classroomName ? ` · ${s.classroomName}` : ' · Unassigned'}
        </p>
      </div>
      <AlertIcons alerts={s.alerts} />
    </Link>
  );
}

export function StudentsClient({ students, classrooms, tags, canAdd }: Props) {
  const [query, setQuery] = useState('');
  const [classroom, setClassroom] = useState('all');
  const [status, setStatus] = useState('all');
  const [tag, setTag] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) return false;
      if (classroom !== 'all') {
        if (classroom === 'unassigned' ? s.classroomId !== null : s.classroomId !== classroom) return false;
      }
      if (status !== 'all' && s.enrollmentStatus !== status) return false;
      if (tag !== 'all' && !s.tags.includes(tag)) return false;
      return true;
    });
  }, [students, query, classroom, status, tag]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-medium text-gray-900">Students</h1>
          <p className="text-sm text-gray-500">
            {filtered.length === students.length
              ? `${students.length} student${students.length === 1 ? '' : 's'}`
              : `${filtered.length} of ${students.length}`}
          </p>
        </div>
        {canAdd && (
          <Link href="/students/new" className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}>
            <UserPlus className="w-4 h-4" />
            Add student
          </Link>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search students…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={classroom} onChange={(e) => setClassroom(e.target.value)} className="w-auto">
          <option value="all">All rooms</option>
          {classrooms.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="unassigned">Unassigned</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="waitlist">Waitlist</option>
          <option value="inactive">Inactive</option>
          <option value="graduated">Graduated</option>
        </Select>
        {tags.length > 0 && (
          <Select value={tag} onChange={(e) => setTag(e.target.value)} className="w-auto">
            <option value="all">All tags</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        )}
        <div className="flex items-center rounded-chip border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setView('grid')}
            aria-label="Grid view"
            className={`p-2 ${view === 'grid' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            aria-label="List view"
            className={`p-2 ${view === 'list' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<Baby className="w-8 h-8" />}
            title={students.length === 0 ? 'No students yet' : 'No students match your filters'}
            description={
              students.length === 0
                ? 'Add your first student to start building enrollment records.'
                : 'Try clearing the search or filters.'
            }
            action={
              canAdd && students.length === 0 ? (
                <Link href="/students/new" className={buttonVariants()}>
                  Add student
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((s) => (
            <StudentGridCard key={s.id} s={s} />
          ))}
        </div>
      ) : (
        <Card padding="none" className="divide-y divide-gray-50">
          {filtered.map((s) => (
            <StudentListRow key={s.id} s={s} />
          ))}
        </Card>
      )}
    </div>
  );
}
