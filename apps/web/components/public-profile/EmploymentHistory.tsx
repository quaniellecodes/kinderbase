import type { EmploymentHistoryRow } from '@kinderbase/types';
import { Briefcase } from 'lucide-react';

type Props = {
  history: EmploymentHistoryRow[];
};

function formatDateRange(start: string, end: string | null): string {
  const startDate = new Date(start);
  const startStr = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  if (!end) return `${startStr} – Present`;
  const endDate = new Date(end);
  const endStr = endDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

function durationLabel(start: string, end: string | null): string {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const months =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth());
  if (months < 1) return '< 1 mo';
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years} yr ${rem} mo` : `${years} yr`;
}

export function EmploymentHistory({ history }: Props) {
  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-card border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Briefcase className="w-3.5 h-3.5 text-gray-400" />
        <h2 className="text-sm font-medium text-gray-900">
          Work Experience
          <span className="ml-2 text-xs font-normal text-gray-400">{history.length}</span>
        </h2>
      </div>
      <ul className="divide-y divide-gray-100">
        {history.map(job => (
          <li key={job.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{job.role_title}</p>
                <p className="text-xs text-gray-600 mt-0.5 truncate">{job.employer_name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatDateRange(job.start_date, job.end_date)}
                </p>
              </div>
              <span className="flex-shrink-0 text-xs text-gray-400 mt-0.5">
                {durationLabel(job.start_date, job.end_date)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
