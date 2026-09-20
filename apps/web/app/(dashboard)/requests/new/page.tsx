import { NewRequestForm } from './NewRequestForm';
import type { StaffRequestType } from '@kinderbase/types';

export default function NewRequestPage({ searchParams }: { searchParams: { type?: string } }) {
  const initial: StaffRequestType =
    searchParams.type === 'time_correction' || searchParams.type === 'leave' ? searchParams.type : 'schedule';
  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto w-full">
      <h1 className="text-lg font-medium text-gray-900 mb-4">New request</h1>
      <NewRequestForm initialType={initial} />
    </div>
  );
}
