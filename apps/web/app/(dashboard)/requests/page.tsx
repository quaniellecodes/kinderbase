import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { getRequests } from './actions';
import { RequestsList } from './RequestsList';

export default async function RequestsPage() {
  const data = await getRequests();
  if (!data) redirect('/dashboard');

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-medium text-gray-900">Requests</h1>
        <Link href="/dashboard/requests/new" className="inline-flex items-center gap-1.5 text-sm bg-brand text-white px-3 py-1.5 rounded-lg font-medium">
          <Plus className="w-3.5 h-3.5" /> New request
        </Link>
      </div>
      <RequestsList rows={data.rows} admin={data.admin} />
    </div>
  );
}
