import { redirect } from 'next/navigation';
import { ParentStub } from '@/components/parent/ParentStub';
import { getParentShell } from '@/lib/parent/shell';

export const dynamic = 'force-dynamic';

export default async function ParentChildPage() {
  const shell = await getParentShell();
  if (!shell) redirect('/dashboard');
  return <ParentStub title={shell.childName} sub="Profile, guardians, and authorized pickups." note="Child and guardian info arrives next." />;
}
