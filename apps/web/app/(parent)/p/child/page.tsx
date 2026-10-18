import Link from 'next/link';
import { Mail, Phone, MessageSquare } from 'lucide-react';
import { Avatar, Badge } from '@/components/ui';
import { getParentChild, type ChildHealth } from '@/lib/parent/child';

export const dynamic = 'force-dynamic';

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

function healthTone(h: ChildHealth): 'red' | 'amber' | 'neutral' | 'blue' {
  if (h.severity === 'severe') return 'red';
  if (h.severity === 'moderate') return 'amber';
  if (h.severity === 'prn') return 'blue';
  return 'neutral';
}

export default async function ParentChildPage() {
  const c = await getParentChild();
  if (!c) return <div className="p-5 text-sm text-gray-500">Nothing to show yet.</div>;

  const facts: { label: string; value: string }[] = [];
  if (c.birthdayLabel) facts.push({ label: 'Birthday', value: c.birthdayLabel });
  facts.push({ label: 'Enrollment', value: cap(c.enrollmentStatus) });
  if (c.scheduleDays.length) facts.push({ label: 'Days', value: c.scheduleDays.join(' · ') });
  if (c.dropoff) facts.push({ label: 'Drop-off', value: c.dropoff });
  if (c.pickup) facts.push({ label: 'Pickup', value: c.pickup });
  if (c.languages.length) facts.push({ label: 'Home language', value: c.languages.map(cap).join(', ') });

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

      {/* Quick facts */}
      {facts.length > 0 && (
        <section>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">At a glance</p>
          <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
            {facts.map((f) => (
              <div key={f.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-[12px] text-gray-500">{f.label}</span>
                <span className="text-[13px] font-medium text-gray-900 text-right">{f.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Health */}
      <section>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Health &amp; allergies</p>
        {c.health.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center text-[13px] text-gray-400">No health notes on file.</div>
        ) : (
          <div className="space-y-2">
            {c.health.map((h) => (
              <div key={h.id} className="flex items-start gap-2.5 bg-white border border-gray-100 rounded-xl p-3">
                <Badge tone={healthTone(h)}>{cap(h.kind)}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-gray-900">{h.name}{h.severity ? <span className="font-normal text-gray-400"> · {cap(h.severity)}</span> : null}</p>
                  {h.detail && <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">{h.detail}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Guardians */}
      <section>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Guardians</p>
        <div className="space-y-2">
          {c.guardians.map((g) => (
            <div key={g.id} className="bg-white border border-gray-100 rounded-xl p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-semibold text-gray-900">{g.name}</span>
                <span className="text-[12px] text-gray-400">{cap(g.relationship)}</span>
                {g.isYou && <Badge tone="blue">You</Badge>}
                {g.isPrimary && <Badge tone="purple">Primary</Badge>}
                {g.canPickup && <Badge tone="green">Pickup</Badge>}
                {g.canAccount && <Badge tone="neutral">Account</Badge>}
              </div>
              {(g.phone || g.email) && (
                <div className="flex flex-col gap-1 mt-2">
                  {g.phone && <a href={`tel:${g.phone}`} className="inline-flex items-center gap-1.5 text-[12px] text-gray-600"><Phone className="w-3.5 h-3.5 text-gray-400" />{g.phone}</a>}
                  {g.email && <a href={`mailto:${g.email}`} className="inline-flex items-center gap-1.5 text-[12px] text-gray-600 truncate"><Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /><span className="truncate">{g.email}</span></a>}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Authorized pickups */}
      <section>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Authorized pickups</p>
        {c.pickups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center text-[13px] text-gray-400">No one else is authorized for pickup yet.</div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50">
            {c.pickups.map((pk) => (
              <div key={pk.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-gray-900 truncate">{pk.name}</p>
                  {pk.relationship && <p className="text-[11px] text-gray-400">{cap(pk.relationship)}</p>}
                </div>
                {pk.phone && <a href={`tel:${pk.phone}`} className="inline-flex items-center gap-1.5 text-[12px] text-gray-600 flex-shrink-0"><Phone className="w-3.5 h-3.5 text-gray-400" />{pk.phone}</a>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Changes route through the office until inline editing lands. */}
      <Link href="/p/messages" className="flex items-center justify-center gap-2 text-[13px] font-semibold text-brand bg-brand/10 rounded-xl py-3">
        <MessageSquare className="w-4 h-4" />
        Need to update something? Message the office
      </Link>
    </div>
  );
}
