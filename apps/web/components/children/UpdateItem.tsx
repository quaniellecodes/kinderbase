import { Avatar } from '@/components/ui/Avatar';
import { UpdateTypeChip, ChildChip } from '@/components/children/UpdateTypeChip';
import { timeAgo } from '@/lib/format';
import type { FeedUpdate } from '@/app/(dashboard)/classrooms/child-actions';

const VERB: Record<FeedUpdate['type'], string> = {
  meal: 'posted a meal update',
  nap: 'logged nap times',
  milestone: 'logged a milestone',
  incident: 'filed an incident report',
};

export function UpdateItem({ update }: { update: FeedUpdate }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <Avatar name={update.authorName} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-800">
          <span className="font-medium">{update.authorName}</span>{' '}
          <span className="text-gray-500">{VERB[update.type]}</span>
        </p>
        <p className="text-sm text-gray-700 mt-0.5">{update.body}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {update.children.map((c) => (
            <ChildChip key={c.id} name={c.name} />
          ))}
          <UpdateTypeChip type={update.type} />
        </div>
      </div>
      <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(update.createdAt)}</span>
    </li>
  );
}
