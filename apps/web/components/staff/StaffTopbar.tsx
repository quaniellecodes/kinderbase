'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateStaffBasics, sendStaffNotification, messageAdmin } from '@/app/(dashboard)/staff/[userId]/actions';
import { CENTER_ROLE_LABELS, type CenterRole } from '@kinderbase/types';
import type { StaffHeader } from '@/app/(dashboard)/staff/[userId]/actions';

const ROLES: CenterRole[] = ['director', 'admin', 'lead_teacher', 'assistant_teacher', 'aide', 'substitute'];

export function StaffTopbar({ header }: { header: StaffHeader }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(header.fullName);
  const [phone, setPhone] = useState(header.phone ?? '');
  const [role, setRole] = useState<CenterRole>(header.role);
  const [msgOpen, setMsgOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [isPending, start] = useTransition();

  function saveProfile() {
    start(async () => { await updateStaffBasics(header.userId, { full_name: name, phone: phone || null, role }); setEditing(false); router.refresh(); });
  }
  function sendMsg() {
    start(async () => {
      if (header.admin) await sendStaffNotification(header.userId, header.fullName, msg);
      else await messageAdmin(header.userId, msg);
      setMsg(''); setMsgOpen(false);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {header.admin ? (
        <>
          <Link href={`/staff/${header.userId}?tab=schedule`} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 hover:border-gray-300">
            Update schedule
          </Link>
          <button onClick={() => setMsgOpen(true)} className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 hover:border-gray-300">Message</button>
          <button onClick={() => setEditing(true)} className="text-sm bg-brand text-white rounded-lg px-3 py-1.5 font-medium">Edit profile</button>
        </>
      ) : (
        <>
          <Link href="/requests/new?type=schedule" className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 hover:border-gray-300">
            Request schedule change
          </Link>
          <button onClick={() => setMsgOpen(true)} className="text-sm bg-brand text-white rounded-lg px-3 py-1.5 font-medium">Message admin</button>
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setEditing(false)}>
          <div className="bg-white rounded-card max-w-sm w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-gray-900">Edit profile</h3>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <select value={role} onChange={(e) => setRole(e.target.value as CenterRole)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30">
              {ROLES.map((r) => <option key={r} value={r}>{CENTER_ROLE_LABELS[r]}</option>)}
            </select>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditing(false)} className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600">Cancel</button>
              <button onClick={saveProfile} disabled={isPending} className="flex-1 text-sm bg-brand text-white rounded-lg py-2 font-medium disabled:opacity-60">Save</button>
            </div>
          </div>
        </div>
      )}

      {msgOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setMsgOpen(false)}>
          <div className="bg-white rounded-card max-w-sm w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-gray-900">{header.admin ? `Message ${header.fullName}` : 'Message admin'}</h3>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} placeholder="Message…" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30" />
            <div className="flex gap-2">
              <button onClick={() => setMsgOpen(false)} className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600">Cancel</button>
              <button onClick={sendMsg} disabled={isPending || !msg.trim()} className="flex-1 text-sm bg-brand text-white rounded-lg py-2 font-medium disabled:opacity-50">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
