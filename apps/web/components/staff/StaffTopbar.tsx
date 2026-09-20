'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, buttonVariants, Modal, Input, Select, Textarea } from '@/components/ui';
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
    <div className="flex flex-wrap items-center gap-2">
      {header.admin ? (
        <>
          <Link href={`/staff/${header.userId}?tab=schedule`} className={buttonVariants({ variant: 'secondary' }) + ' whitespace-nowrap'}>
            Update schedule
          </Link>
          <Button variant="secondary" className="whitespace-nowrap" onClick={() => setMsgOpen(true)}>Message</Button>
          <Button className="whitespace-nowrap" onClick={() => setEditing(true)}>Edit profile</Button>
        </>
      ) : (
        <>
          <Link href="/requests/new?type=schedule" className={buttonVariants({ variant: 'secondary' }) + ' whitespace-nowrap'}>
            Request schedule change
          </Link>
          <Button className="whitespace-nowrap" onClick={() => setMsgOpen(true)}>Message admin</Button>
        </>
      )}

      <Modal open={editing} onOpenChange={setEditing} title="Edit profile">
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile" />
          <Select value={role} onChange={(e) => setRole(e.target.value as CenterRole)}>
            {ROLES.map((r) => <option key={r} value={r}>{CENTER_ROLE_LABELS[r]}</option>)}
          </Select>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="lg" onClick={() => setEditing(false)} className="flex-1">Cancel</Button>
            <Button size="lg" onClick={saveProfile} disabled={isPending} className="flex-1">Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={msgOpen} onOpenChange={setMsgOpen} title={header.admin ? `Message ${header.fullName}` : 'Message admin'}>
        <div className="space-y-3">
          <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} placeholder="Message…" />
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={() => setMsgOpen(false)} className="flex-1">Cancel</Button>
            <Button size="lg" onClick={sendMsg} disabled={isPending || !msg.trim()} className="flex-1">Send</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
