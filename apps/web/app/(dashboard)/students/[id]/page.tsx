import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Construction } from 'lucide-react';
import { Card, Badge, TabBar, Alert, StatusDot, EmptyState, type BadgeTone } from '@/components/ui';
import { getStudentHeader, type EnrollmentStatus } from '../actions';

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
  searchParams: { tab?: string | string[] };
}) {
  const header = await getStudentHeader(params.id);
  if (!header) notFound();

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

      {/* Severe allergy banner */}
      {header.severeAllergies.length > 0 && (
        <Alert tone="red" className="mb-4">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            <span className="font-semibold">Severe allergy:</span> {header.severeAllergies.join(', ')}
          </span>
        </Alert>
      )}

      {/* Tabs */}
      <TabBar items={TABS} active={tab} hrefFor={(k) => `/students/${header.id}?tab=${k}`} className="mb-4" />

      {/* Panel (placeholders until later phases fill each tab) */}
      <Card padding="none">
        <EmptyState
          icon={<Construction className="w-8 h-8" />}
          title={`${activeTabLabel} — coming soon`}
          description="This tab is part of a later build step. The student directory, profile shell, and navigation are live now."
        />
      </Card>
    </div>
  );
}
