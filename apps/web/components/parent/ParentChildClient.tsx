'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Phone, MessageSquare, Pencil, Check, X, Clock, Plus } from 'lucide-react';
import { Avatar, Badge, toast } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { requestProfileChange, cancelProfileChange } from '@/app/(parent)/p/actions';
import type { ParentChild, ChildHealth, PendingMap } from '@/lib/parent/child';
import type { Json } from '@kinderbase/types/database';

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function healthTone(h: ChildHealth): 'red' | 'amber' | 'neutral' | 'blue' {
  if (h.severity === 'severe') return 'red';
  if (h.severity === 'moderate') return 'amber';
  if (h.severity === 'prn') return 'blue';
  return 'neutral';
}

type ChangeInput = { fieldKey: string; targetId: string | null; label: string; oldValue: string | null; newValue: string | null; applyValue: Json | null; applyToAll?: boolean };

// The Child & guardians tab. A guardian with edit permission can PROPOSE changes to a
// handful of fields — each files a pending request an admin approves before it
// applies (lib/change-requests.ts). Everything is the viewer's own family.
export function ParentChildClient({ c }: { c: ParentChild }) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const pend = (fieldKey: string, targetId: string | null): PendingMap[string] | undefined => c.pending[`${fieldKey}:${targetId ?? ''}`];

  function submit(input: ChangeInput) {
    start(async () => {
      try {
        await requestProfileChange(input);
        toast('Sent to the office for review');
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not send the request');
      }
    });
  }
  function cancel(id: string) {
    start(async () => {
      try {
        await cancelProfileChange(id);
        toast('Request cancelled');
        router.refresh();
      } catch {
        toast('Could not cancel');
      }
    });
  }

  return (
    <div className="p-4 space-y-5">
      {/* Hero */}
      <div className="flex items-center gap-3">
        <Avatar name={c.firstName} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-gray-900 truncate">{c.childName}</div>
          <div className="text-xs text-gray-500 truncate">{[c.room, c.ageLabel].filter(Boolean).join(' · ')}</div>
        </div>
      </div>

      {c.canEdit && <p className="text-[11px] text-gray-400 -mt-2">Tap the pencil to propose a change. An admin reviews it before it takes effect.</p>}

      {/* At a glance */}
      <section>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">At a glance</p>
        <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
          <EditRow
            label="Birthday" display={c.birthdayLabel ?? '—'} raw={c.birthdateIso ?? ''} type="date" major
            editable={c.canEdit} pending={pend('child.birthdate', null)} saving={saving} onCancel={cancel}
            onSubmit={(raw) => submit({ fieldKey: 'child.birthdate', targetId: null, label: `${c.firstName}'s birthday`, oldValue: c.birthdayLabel, newValue: raw ? formatDate(raw) : null, applyValue: raw || null })}
          />
          <StaticRow label="Enrollment" value={cap(c.enrollmentStatus)} />
          {c.scheduleDays.length > 0 && <StaticRow label="Days" value={c.scheduleDays.join(' · ')} />}
          {c.dropoff && <StaticRow label="Drop-off" value={c.dropoff} />}
          {c.pickup && <StaticRow label="Pickup" value={c.pickup} />}
          <EditRow
            label="Home language" display={c.languages.map(cap).join(', ') || '—'} raw={c.languages.join(', ')} type="text"
            editable={c.canEdit} pending={pend('child.home_languages', null)} saving={saving} onCancel={cancel}
            onSubmit={(raw) => {
              const arr = raw.split(',').map((s) => s.trim()).filter(Boolean);
              submit({ fieldKey: 'child.home_languages', targetId: null, label: 'Home language', oldValue: c.languages.join(', ') || '—', newValue: arr.join(', ') || '—', applyValue: arr });
            }}
          />
        </div>
      </section>

      {/* Health */}
      <section>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Health &amp; allergies</p>
        {c.health.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center text-[13px] text-gray-400">No health notes on file.</div>
        ) : (
          <div className="space-y-2">
            {c.health.map((h) => {
              const pk = pend('health.remove', h.id);
              return (
                <div key={h.id} className="flex items-start gap-2.5 bg-white border border-gray-100 rounded-xl p-3">
                  <Badge tone={healthTone(h)}>{cap(h.kind)}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-gray-900">{h.name}{h.severity ? <span className="font-normal text-gray-400"> · {cap(h.severity)}</span> : null}</p>
                    {h.detail && <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">{h.detail}</p>}
                    {pk ? (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-1">
                        <Clock className="w-3 h-3" /> Removal pending review
                        <button onClick={() => cancel(pk.id)} disabled={saving} aria-label="Cancel request" className="ml-1 text-amber-700/70 hover:text-status-red"><X className="w-3 h-3" /></button>
                      </span>
                    ) : (
                      c.canEdit && <button onClick={() => submit({ fieldKey: 'health.remove', targetId: h.id, label: `${cap(h.kind)}: ${h.name}`, oldValue: h.name, newValue: 'Remove', applyValue: null })} disabled={saving} className="text-[11px] font-semibold text-status-red mt-1.5">Request removal</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Guardians */}
      <section>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Guardians</p>
        <div className="space-y-2">
          {c.guardians.map((g) => (
            <div key={g.id} className="bg-white border border-gray-100 rounded-xl p-3">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[13px] font-semibold text-gray-900">{g.name}</span>
                <span className="text-[12px] text-gray-400">{cap(g.relationship)}</span>
                {g.isYou && <Badge tone="blue">You</Badge>}
                {g.isPrimary && <Badge tone="purple">Primary</Badge>}
                {g.canPickup && <Badge tone="green">Pickup</Badge>}
                {g.canAccount && <Badge tone="neutral">Account</Badge>}
              </div>
              <div className="divide-y divide-gray-50 -mx-3">
                <EditRow
                  label="Phone" display={g.phone ?? '—'} raw={g.phone ?? ''} type="tel" icon={<Phone className="w-3.5 h-3.5 text-gray-400" />} familyChoice={c.hasSiblings} familyDefault
                  editable={c.canEdit} pending={pend('guardian.mobile_phone', g.id)} saving={saving} onCancel={cancel}
                  onSubmit={(raw, all) => submit({ fieldKey: 'guardian.mobile_phone', targetId: g.id, label: `${g.name}'s phone`, oldValue: g.phone, newValue: raw || '—', applyValue: raw || null, applyToAll: all })}
                />
                <EditRow
                  label="Email" display={g.email ?? '—'} raw={g.email ?? ''} type="email" icon={<Mail className="w-3.5 h-3.5 text-gray-400" />} familyChoice={c.hasSiblings} familyDefault
                  editable={c.canEdit} pending={pend('guardian.email', g.id)} saving={saving} onCancel={cancel}
                  onSubmit={(raw, all) => submit({ fieldKey: 'guardian.email', targetId: g.id, label: `${g.name}'s email`, oldValue: g.email, newValue: raw || '—', applyValue: raw || null, applyToAll: all })}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Authorized pickups */}
      <section>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Authorized pickups</p>
        <div className="space-y-2">
          {c.pickups.length === 0 && c.pendingPickupAdds.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center text-[13px] text-gray-400">No one else is authorized for pickup yet.</div>
          )}
          {c.pickups.map((pk) => {
            const rm = pend('pickup.remove', pk.id);
            return (
              <div key={pk.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-gray-900 truncate">{pk.name}</p>
                  <p className="text-[11px] text-gray-400">{[pk.relationship ? cap(pk.relationship) : null, pk.phone].filter(Boolean).join(' · ') || '—'}</p>
                  {rm && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-1">
                      <Clock className="w-3 h-3" /> Removal pending
                      <button onClick={() => cancel(rm.id)} disabled={saving} aria-label="Cancel request" className="ml-1 text-amber-700/70 hover:text-status-red"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                </div>
                {!rm && c.canEdit && <button onClick={() => submit({ fieldKey: 'pickup.remove', targetId: pk.id, label: `Pickup: ${pk.name}`, oldValue: pk.name, newValue: 'Remove', applyValue: null })} disabled={saving} className="text-[11px] font-semibold text-status-red flex-shrink-0">Remove</button>}
              </div>
            );
          })}
          {c.pendingPickupAdds.map((pa) => (
            <div key={pa.id} className="flex items-center gap-2 bg-white border border-amber-100 rounded-xl p-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-gray-700 truncate">{pa.display}</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700"><Clock className="w-3 h-3" /> New pickup — pending review</span>
              </div>
              <button onClick={() => cancel(pa.id)} disabled={saving} aria-label="Cancel request" className="text-gray-300 hover:text-status-red flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>
          ))}
          {c.canEdit && <AddPickup saving={saving} hasSiblings={c.hasSiblings} childFirst={c.firstName} onAdd={submit} />}
        </div>
      </section>

      <Link href="/p/messages" className="flex items-center justify-center gap-2 text-[13px] font-semibold text-brand bg-brand/10 rounded-xl py-3">
        <MessageSquare className="w-4 h-4" />
        Need to update something else? Message the office
      </Link>
    </div>
  );
}

const fieldCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/30';

function AddPickup({ saving, hasSiblings, childFirst, onAdd }: { saving: boolean; hasSiblings: boolean; childFirst: string; onAdd: (input: ChangeInput) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [rel, setRel] = useState('');
  const [phone, setPhone] = useState('');
  const [all, setAll] = useState(false); // default: this child only (blended-family case)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center justify-center gap-1.5 w-full text-[13px] font-semibold text-brand border border-dashed border-brand/40 rounded-xl py-2.5">
        <Plus className="w-4 h-4" /> Add someone
      </button>
    );
  }

  function send() {
    const nm = name.trim();
    if (!nm) return;
    const relClean = rel.trim();
    const phoneClean = phone.trim();
    onAdd({
      fieldKey: 'pickup.add',
      targetId: null,
      label: `Add pickup: ${nm}`,
      oldValue: null,
      newValue: [nm, relClean ? cap(relClean) : null, phoneClean || null].filter(Boolean).join(' · '),
      applyValue: { full_name: nm, relationship: relClean || null, phone: phoneClean || null },
      applyToAll: all,
    });
    setOpen(false);
    setName('');
    setRel('');
    setPhone('');
    setAll(false);
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 space-y-2">
      <p className="text-[12px] font-semibold text-gray-700">Add an authorized pickup</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={fieldCls} autoFocus />
      <input value={rel} onChange={(e) => setRel(e.target.value)} placeholder="Relationship (e.g. Grandmother)" className={fieldCls} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" type="tel" className={fieldCls} />
      {hasSiblings && (
        <label className="flex items-center gap-2 text-[12px] text-gray-600">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-brand" />
          Apply to all my children {!all && <span className="text-gray-400">(otherwise just {childFirst})</span>}
        </label>
      )}
      <p className="text-[11px] text-amber-700">An admin reviews new pickup people before they can collect.</p>
      <div className="flex gap-2 pt-0.5">
        <button onClick={() => setOpen(false)} className="flex-1 text-[13px] font-semibold text-gray-500 border border-gray-200 rounded-lg py-2">Cancel</button>
        <button onClick={send} disabled={saving || !name.trim()} className="flex-1 text-[13px] font-semibold text-white bg-brand rounded-lg py-2 disabled:opacity-40">Send for review</button>
      </div>
    </div>
  );
}

function StaticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="text-[12px] text-gray-500">{label}</span>
      <span className="text-[13px] font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

function EditRow({ label, display, raw, type, major, familyChoice, familyDefault, icon, editable, pending, saving, onSubmit, onCancel }: {
  label: string;
  display: string;
  raw: string;
  type: 'text' | 'email' | 'tel' | 'date';
  major?: boolean;
  familyChoice?: boolean; // show the "apply to all my children" checkbox
  familyDefault?: boolean;
  icon?: React.ReactNode;
  editable: boolean;
  pending?: PendingMap[string];
  saving: boolean;
  onSubmit: (raw: string, applyToAll: boolean) => void;
  onCancel: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(raw);
  const [all, setAll] = useState(!!familyDefault);

  if (pending) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-gray-500">{label}</p>
          <p className="text-[13px] font-medium text-gray-400 truncate">{display}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-1 flex-shrink-0"><Clock className="w-3 h-3" /> Pending</span>
        <button onClick={() => onCancel(pending.id)} disabled={saving} aria-label="Cancel request" className="text-gray-300 hover:text-status-red flex-shrink-0"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="px-3 py-2.5">
        <p className="text-[12px] text-gray-500 mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <input type={type} value={val} onChange={(e) => setVal(e.target.value)} autoFocus className="flex-1 min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/30" />
          <button onClick={() => { setEditing(false); onSubmit(val, all); }} disabled={saving} aria-label="Send request" className="w-8 h-8 rounded-lg bg-brand text-white flex items-center justify-center flex-shrink-0"><Check className="w-4 h-4" /></button>
          <button onClick={() => { setEditing(false); setVal(raw); }} aria-label="Cancel" className="w-8 h-8 rounded-lg border border-gray-200 text-gray-400 flex items-center justify-center flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
        {major && <p className="text-[11px] text-amber-700 mt-1.5">This is a big change — an admin reviews it before it takes effect.</p>}
        {familyChoice && (
          <label className="flex items-center gap-2 text-[12px] text-gray-600 mt-2">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-brand" />
            Apply to all my children
          </label>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-gray-500">{label}</p>
        <p className="text-[13px] font-medium text-gray-900 truncate inline-flex items-center gap-1.5">{icon}{display}</p>
      </div>
      {editable && (
        <button onClick={() => { setVal(raw); setEditing(true); }} aria-label={`Propose a change to ${label}`} className="text-gray-300 hover:text-brand flex-shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
      )}
    </div>
  );
}
