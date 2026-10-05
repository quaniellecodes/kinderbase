import Link from 'next/link';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Card, Avatar, EmptyState } from '@/components/ui';
import { getMissingDocuments } from '../actions';

export const dynamic = 'force-dynamic';

export default async function MissingDocumentsPage() {
  const items = await getMissingDocuments();
  return (
    <div className="p-4">
      <Link href="/m/admin" className="inline-flex items-center gap-1 text-sm text-gray-500 mb-2"><ChevronLeft className="w-4 h-4" /> Back</Link>
      <h1 className="text-lg font-semibold text-gray-900 mb-1">Missing documents</h1>
      <p className="text-xs text-gray-500 mb-3">Required student records not yet on file.</p>
      {items.length === 0 ? (
        <Card padding="none"><EmptyState icon={<FileText className="w-8 h-8" />} title="All documents on file" description="No required student records are missing." /></Card>
      ) : (
        <Card padding="none" className="divide-y divide-gray-50">
          {items.map((d) => (
            <Link key={d.id} href={`/students/${d.childId}`} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50">
              <Avatar name={d.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-900 truncate">{d.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{d.room} · {d.doc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
