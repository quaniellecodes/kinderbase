import { Clock, LogOut, FileCheck, DoorOpen, Users } from 'lucide-react';
import type { ActivityEventType } from '@/lib/activity';

type ActivityRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type Props = {
  entries: ActivityRow[];
};

type EventConfig = {
  icon: React.ElementType;
  color: string;
  label: (payload: Record<string, unknown>) => string;
};

const EVENT_CONFIG: Record<ActivityEventType, EventConfig> = {
  'staff.clocked_in': {
    icon: Clock,
    color: 'text-green-500 bg-green-50',
    label: p => `${p.name} clocked in`,
  },
  'staff.clocked_out': {
    icon: LogOut,
    color: 'text-gray-500 bg-gray-100',
    label: p => `${p.name} clocked out${p.duration ? ` after ${p.duration}` : ''}`,
  },
  'credential.uploaded': {
    icon: FileCheck,
    color: 'text-blue-500 bg-blue-50',
    label: p => `${p.name} uploaded ${p.credential_type}`,
  },
  'classroom.created': {
    icon: DoorOpen,
    color: 'text-purple-500 bg-purple-50',
    label: p => `${p.name} classroom added`,
  },
  'staff.joined': {
    icon: Users,
    color: 'text-brand bg-brand/10',
    label: p => `${p.name} joined the center`,
  },
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityFeed({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No activity yet. Events appear here as staff clock in, upload credentials, and more.
      </p>
    );
  }

  return (
    <ul className="space-y-0 divide-y divide-gray-50">
      {entries.map(entry => {
        const config = EVENT_CONFIG[entry.event_type as ActivityEventType];
        if (!config) return null;
        const Icon = config.icon;
        return (
          <li key={entry.id} className="flex items-start gap-3 py-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${config.color}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-800">{config.label(entry.payload)}</p>
            </div>
            <span className="flex-shrink-0 text-xs text-gray-400 mt-0.5">{timeAgo(entry.created_at)}</span>
          </li>
        );
      })}
    </ul>
  );
}
