'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Phone, Globe, UserRound } from 'lucide-react';
import { Button, Card, Input, Modal } from '@/components/ui';
import { updateContact } from '@/app/(dashboard)/staff/[userId]/actions';
import type { StaffHeader } from '@/app/(dashboard)/staff/[userId]/actions';

function Row({ icon, value, label, href }: { icon: React.ReactNode; value: string; label: string; href?: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        {href ? (
          <a href={href} className="text-sm text-brand hover:underline truncate block">{value}</a>
        ) : (
          <p className="text-sm text-gray-900 truncate">{value}</p>
        )}
        <p className="text-[11px] text-gray-400">{label}</p>
      </div>
    </div>
  );
}

export function ContactCard({ header, canEdit }: { header: StaffHeader; canEdit: boolean }) {
  const router = useRouter();
  const p = header.profile;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    phone: header.phone ?? '',
    personal_email: p?.personal_email ?? '',
    emergency_contact_name: p?.emergency_contact_name ?? '',
    emergency_contact_relation: p?.emergency_contact_relation ?? '',
    emergency_contact_phone: p?.emergency_contact_phone ?? '',
  });
  const [isSaving, startSave] = useTransition();

  function save() {
    startSave(async () => {
      await updateContact(header.userId, {
        phone: form.phone || null,
        personal_email: form.personal_email || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_relation: form.emergency_contact_relation || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
      });
      setEditing(false);
      router.refresh();
    });
  }

  const field = (key: keyof typeof form, placeholder: string) => (
    <Input
      value={form[key]}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      placeholder={placeholder}
    />
  );

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-medium text-gray-900">Contact</h2>
        {canEdit && <button onClick={() => setEditing(true)} className="text-xs text-brand hover:underline">Edit</button>}
      </div>

      <div className="divide-y divide-gray-50">
        <Row icon={<Mail className="w-4 h-4" />} value={p?.personal_email || header.email} label="Personal email" />
        {header.phone && <Row icon={<Phone className="w-4 h-4" />} value={header.phone} label="Mobile" />}
        {header.handle && <Row icon={<Globe className="w-4 h-4" />} value={`kinderbase.com/t/${header.handle}`} label="Public profile" href={`/t/${header.handle}`} />}
        {p?.emergency_contact_name && (
          <Row
            icon={<UserRound className="w-4 h-4" />}
            value={`${p.emergency_contact_name}${p.emergency_contact_relation ? ` (${p.emergency_contact_relation})` : ''}`}
            label={`Emergency${p.emergency_contact_phone ? ` · ${p.emergency_contact_phone}` : ''}`}
          />
        )}
      </div>

      <Modal open={editing} onOpenChange={setEditing} title="Edit contact">
        <div className="space-y-3">
          {field('phone', 'Mobile number')}
          {field('personal_email', 'Personal email')}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Emergency contact</p>
            {field('emergency_contact_name', 'Name')}
            {field('emergency_contact_relation', 'Relationship')}
            {field('emergency_contact_phone', 'Phone')}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="lg" onClick={() => setEditing(false)} className="flex-1">Cancel</Button>
            <Button size="lg" onClick={save} disabled={isSaving} className="flex-1">{isSaving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
