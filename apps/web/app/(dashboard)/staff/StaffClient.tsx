'use client';

import { useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import { UserPlus, Search, X, ChevronDown, Hash, Wifi } from 'lucide-react';
import {
  searchUsers,
  addExistingStaff,
  addManualStaff,
  updateStaffRole,
  removeStaff,
} from './actions';
import type { CenterRole } from '@kinderbase/types';
import { Button, Card, Input, Select, Label, TabBar, Modal } from '@/components/ui';

const ROLE_LABELS: Record<CenterRole, string> = {
  director: 'Director',
  admin: 'Admin',
  lead_teacher: 'Lead Teacher',
  assistant_teacher: 'Asst. Teacher',
  aide: 'Aide',
  substitute: 'Substitute',
};

const ASSIGNABLE_ROLES: CenterRole[] = [
  'lead_teacher',
  'assistant_teacher',
  'aide',
  'substitute',
  'admin',
];

type StaffMember = {
  membershipId: string;
  userId: string;
  full_name: string;
  email: string;
  role: CenterRole;
  joinedAt: string;
  hasPin: boolean;
  isClockedIn: boolean;
};

type Props = {
  centerId: string;
  staff: StaffMember[];
  isDirector: boolean;
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function RoleBadge({ role }: { role: CenterRole }) {
  const colors: Record<CenterRole, string> = {
    director: 'bg-purple-50 text-purple-700',
    admin: 'bg-blue-50 text-blue-700',
    lead_teacher: 'bg-green-50 text-green-700',
    assistant_teacher: 'bg-teal-50 text-teal-700',
    aide: 'bg-gray-100 text-gray-600',
    substitute: 'bg-orange-50 text-orange-700',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function StaffRow({
  member,
  centerId,
  isDirector,
}: {
  member: StaffMember;
  centerId: string;
  isDirector: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(role: CenterRole) {
    setShowMenu(false);
    startTransition(() => updateStaffRole(member.membershipId, centerId, role));
  }

  function handleRemove() {
    setShowMenu(false);
    if (!confirm(`Remove ${member.full_name} from this center?`)) return;
    startTransition(() => removeStaff(member.membershipId, centerId));
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${isPending ? 'opacity-50' : ''}`}>
      <div className="relative flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-sm font-medium text-white">
          {getInitials(member.full_name)}
        </div>
        {member.isClockedIn && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
        )}
      </div>

      <Link href={`/staff/${member.userId}`} className="flex-1 min-w-0 group">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-brand">{member.full_name}</p>
          <RoleBadge role={member.role} />
          {member.hasPin && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <Hash className="w-2.5 h-2.5" /> PIN
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 truncate">{member.email}</p>
      </Link>

      {isDirector && (
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowMenu(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-44">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide px-3 py-1">Change role</p>
                {ASSIGNABLE_ROLES.map(r => (
                  <button
                    key={r}
                    onClick={() => handleRoleChange(r)}
                    className={`w-full text-left text-sm px-3 py-1.5 hover:bg-gray-50 transition-colors ${member.role === r ? 'text-brand font-medium' : 'text-gray-700'}`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={handleRemove}
                  className="w-full text-left text-sm px-3 py-1.5 text-red-500 hover:bg-red-50 transition-colors"
                >
                  Remove from center
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type SearchResult = { id: string; full_name: string; email: string };

function AddStaffModal({
  open,
  centerId,
  onClose,
}: {
  open: boolean;
  centerId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'search' | 'manual'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [role, setRole] = useState<CenterRole>('lead_teacher');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [isPending, startTransition] = useTransition();
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  function handleQueryChange(val: string) {
    setQuery(val);
    setSelected(null);
    clearTimeout(searchTimer.current);
    if (val.trim().length < 2) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const res = await searchUsers(val, centerId);
      setResults(res);
    }, 300);
  }

  function handleAddExisting() {
    if (!selected) return;
    startTransition(async () => {
      await addExistingStaff(selected.id, centerId, role);
      onClose();
    });
  }

  function handleAddManual() {
    if (!manualName.trim() || !manualEmail.trim()) return;
    startTransition(async () => {
      await addManualStaff(centerId, manualName, manualEmail, role);
      onClose();
    });
  }

  return (
    <Modal open={open} onOpenChange={o => { if (!o) onClose(); }} title="Add staff member">
      {/* Tabs */}
      <TabBar
        fill
        items={[
          { key: 'search', label: 'Search KinderBase' },
          { key: 'manual', label: 'Add manually' },
        ]}
        active={tab}
        onSelect={k => setTab(k as 'search' | 'manual')}
      />

      <div className="p-5 space-y-4">
        {tab === 'search' ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name or email…"
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            {results.length > 0 && !selected && (
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {results.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { setSelected(r); setResults([]); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
                      {getInitials(r.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{r.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{r.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <div className="flex items-center gap-3 bg-brand/5 border border-brand/20 rounded-xl px-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
                  {getInitials(selected.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{selected.full_name}</p>
                  <p className="text-xs text-gray-400">{selected.email}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <Input
              type="text"
              placeholder="Full name"
              value={manualName}
              onChange={e => setManualName(e.target.value)}
            />
            <Input
              type="email"
              placeholder="Email address"
              value={manualEmail}
              onChange={e => setManualEmail(e.target.value)}
            />
          </>
        )}

        {/* Role picker */}
        <div>
          <Label className="text-xs text-gray-500 mb-1.5">Role</Label>
          <Select
            value={role}
            onChange={e => setRole(e.target.value as CenterRole)}
          >
            {ASSIGNABLE_ROLES.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </Select>
        </div>

        <Button
          onClick={tab === 'search' ? handleAddExisting : handleAddManual}
          disabled={isPending || (tab === 'search' ? !selected : !manualName.trim() || !manualEmail.trim())}
          className="w-full py-2.5"
        >
          {isPending ? 'Adding…' : 'Add to center'}
        </Button>
      </div>
    </Modal>
  );
}

export function StaffClient({ centerId, staff, isDirector }: Props) {
  const [showAdd, setShowAdd] = useState(false);

  const clockedIn = staff.filter(s => s.isClockedIn);
  const clockedOut = staff.filter(s => !s.isClockedIn);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{staff.length} staff member{staff.length !== 1 ? 's' : ''}</p>
        {isDirector && (
          <Button
            onClick={() => setShowAdd(true)}
            size="lg"
            className="gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add staff
          </Button>
        )}
      </div>

      {staff.length === 0 ? (
        <Card padding="none" className="py-12 text-center">
          <p className="text-sm text-gray-400">No staff members yet.</p>
          {isDirector && (
            <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-brand font-medium">
              Add your first staff member
            </button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {clockedIn.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Wifi className="w-3 h-3 text-green-500" />
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Clocked in ({clockedIn.length})</p>
              </div>
              <Card padding="none" className="divide-y divide-gray-50">
                {clockedIn.map(m => (
                  <StaffRow key={m.membershipId} member={m} centerId={centerId} isDirector={isDirector} />
                ))}
              </Card>
            </div>
          )}
          <div>
            {clockedIn.length > 0 && (
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Not clocked in ({clockedOut.length})</p>
            )}
            <Card padding="none" className="divide-y divide-gray-50">
              {clockedOut.map(m => (
                <StaffRow key={m.membershipId} member={m} centerId={centerId} isDirector={isDirector} />
              ))}
            </Card>
          </div>
        </div>
      )}

      <AddStaffModal open={showAdd} centerId={centerId} onClose={() => setShowAdd(false)} />
    </div>
  );
}
