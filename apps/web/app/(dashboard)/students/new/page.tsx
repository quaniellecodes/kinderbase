import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Construction } from 'lucide-react';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { isAdmin } from '@kinderbase/types';
import { Card, EmptyState, buttonVariants } from '@/components/ui';

export default function NewStudentPage() {
  const active = getActiveContextFromCookies();
  if (!active) redirect('/dashboard');
  if (!isAdmin(active.role)) redirect('/students');

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
      <Link href="/students" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> All students
      </Link>
      <Card padding="none">
        <EmptyState
          icon={<Construction className="w-8 h-8" />}
          title="Add-student wizard — coming soon"
          description="The multi-step enrollment wizard is a later build step. For now you can browse and open existing student profiles."
          action={
            <Link href="/students" className={buttonVariants({ variant: 'secondary' })}>
              Back to students
            </Link>
          }
        />
      </Card>
    </div>
  );
}
