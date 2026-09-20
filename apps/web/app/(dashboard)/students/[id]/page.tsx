import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Construction } from 'lucide-react';
import { Card, Badge, TabBar, Alert, StatusDot, EmptyState, type BadgeTone } from '@/components/ui';
import { getStudentHeader, type EnrollmentStatus } from '../actions';
import { InfoPanel } from './InfoPanel';
import { FamilyPanel } from './FamilyPanel';
import { HealthPanel } from './HealthPanel';
import { DocumentsPanel } from './DocumentsPanel';
import { ActivityPanel } from './ActivityPanel';
import { SaeoPanel } from './SaeoPanel';
import { AboutCard } from './AboutCard';
import { ScheduleCard } from './ScheduleCard';
import { getStudentAbout, getStudentSchedule } from './about-schedule-actions';

const STATUS_META: Record<EnrollmentStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Active', tone: 'green' },
  waitlist: { label: 'Waitlist', tone: 'amber' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  graduated: { label: 'Graduated', tone: 'blue' },
};

const TABS = [
  { key: 'info', label: 'Info' },
  { key: 'family', label: 'Family' },
  { key: 'health', label: 'Health' },
  { key: 'documents', label: 'Documents' },
  { key: 'activity', label: 'Activity' },
  { key: 'saeo', label: 'SAEO' },
];

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default async function StudentProfilePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string | string[]; saeo?: string | string[] };
}) {
  const header = await getStudentHeader(params.id);
  if (!header) notFound();

  const [about, schedule] = await Promise.all([getStudentAbout(params.id), getStudentSchedule(params.id)]);

  const tabParam = typeof searchParams.tab === 'string' ? searchParams.tab : 'info';
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : 'info';
  const status = STATUS_META[header.enrollmentStatus];
  const activeTabLabel = TABS.find((t) => t.key === tab)?.label ?? 'Info';

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> All students
      </Link>

      {/* Hero */}
      <Card className="mb-4">
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center text-xl font-medium text-white">
              {initials(header.name)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
              <StatusDot tone={header.present ? 'green' : 'gray'} className="w-3 h-3" />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-medium text-gray-900">{header.name}</h1>
              <Badge tone={status.tone} size="sm">
                {status.label}
              </Badge>
              {header.present && (
                <Badge tone="green" size="sm">
                  Signed in
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {header.legalName !== header.name && <span>{header.legalName} · </span>}
              {header.ageLabel}
              {header.classroomName ? ` · ${header.classroomName}` : ' · Unassigned'}
              {header.studentCode ? ` · ${header.studentCode}` : ''}
            </p>
            {header.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {header.tags.map((t) => (
                  <Badge key={t} tone="neutral" size="sm">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Left rail: About + Schedule summary cards */}
        {(about || schedule) && (
          <div className="w-full md:w-72 flex-shrink-0 space-y-4">
            {about && <AboutCard childId={header.id} name={header.name} about={about} />}
            {schedule && <ScheduleCard childId={header.id} schedule={schedule} />}
          </div>
        )}

        {/* Right: allergy banner + tabs + panel */}
        <div className="flex-1 min-w-0">
          {header.severeAllergies.length > 0 && (
            <Alert tone="red" className="mb-4">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                <span className="font-semibold">Severe allergy:</span> {header.severeAllergies.join(', ')}
              </span>
            </Alert>
          )}

          <TabBar items={TABS} active={tab} hrefFor={(k) => `/students/${header.id}?tab=${k}`} className="mb-4" />

          {tab === 'info' ? (
            <InfoPanel childId={header.id} />
          ) : tab === 'family' ? (
            <FamilyPanel childId={header.id} />
          ) : tab === 'health' ? (
            <HealthPanel childId={header.id} />
          ) : tab === 'documents' ? (
            <DocumentsPanel childId={header.id} />
          ) : tab === 'activity' ? (
            <ActivityPanel childId={header.id} />
          ) : tab === 'saeo' ? (
            <SaeoPanel childId={header.id} sub={typeof searchParams.saeo === 'string' ? searchParams.saeo : 'assessment'} />
          ) : (
            <Card padding="none">
              <EmptyState
                icon={<Construction className="w-8 h-8" />}
                title={`${activeTabLabel} — coming soon`}
                description="This tab is part of a later build step."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
