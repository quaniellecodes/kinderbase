'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, AlertTriangle, Pill, Utensils, HeartPulse, Stethoscope } from 'lucide-react';
import { Card, Modal, Button, Input, Textarea, Select, Label, Badge, EmptyState, type BadgeTone } from '@/components/ui';
import {
  addHealthItem,
  updateHealthItem,
  deleteHealthItem,
  addPhysician,
  updatePhysician,
  deletePhysician,
  type StudentHealth,
  type HealthItem,
  type Physician,
  type HealthKind,
  type HealthSeverity,
} from './health-actions';

const KIND_META: Record<HealthKind, { label: string; icon: typeof Pill }> = {
  allergy: { label: 'Allergy', icon: AlertTriangle },
  medication: { label: 'Medication', icon: Pill },
  diet: { label: 'Diet', icon: Utensils },
  condition: { label: 'Condition', icon: HeartPulse },
};
const SEVERITY_TONE: Record<string, BadgeTone> = { severe: 'red', moderate: 'amber', mild: 'neutral', prn: 'blue' };
const KIND_OPTIONS = (Object.keys(KIND_META) as HealthKind[]).map((k) => ({ value: k, label: KIND_META[k].label }));
const SEVERITY_OPTIONS = [
  { value: '', label: '—' },
  { value: 'severe', label: 'Severe' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'mild', label: 'Mild' },
  { value: 'prn', label: 'As needed (PRN)' },
];

const EMPTY_ITEM: Omit<HealthItem, 'id'> = {
  kind: 'allergy',
  name: '',
  detail: '',
  severity: '',
  rescueMed: '',
  rescueMedLocation: '',
  rescueMedExpires: '',
};
const EMPTY_PHYS: Omit<Physician, 'id'> = { name: '', practice: '', phone: '', lastVisit: '' };

export function HealthEditor({ childId, health }: { childId: string; health: StudentHealth }) {
  const router = useRouter();
  const editable = health.canEdit;
  const [pending, startTransition] = useTransition();
  const [item, setItem] = useState<{ id: string | null; data: Omit<HealthItem, 'id'> } | null>(null);
  const [phys, setPhys] = useState<{ id: string | null; data: Omit<Physician, 'id'> } | null>(null);

  const showRescue = item?.data.kind === 'allergy' || item?.data.kind === 'medication';

  function saveItem() {
    if (!item) return;
    startTransition(async () => {
      if (item.id) await updateHealthItem(childId, item.id, item.data);
      else await addHealthItem(childId, item.data);
      setItem(null);
      router.refresh();
    });
  }
  function savePhys() {
    if (!phys) return;
    startTransition(async () => {
      if (phys.id) await updatePhysician(childId, phys.id, phys.data);
      else await addPhysician(childId, phys.data);
      setPhys(null);
      router.refresh();
    });
  }

  return (
    <div>
      {/* Health items */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-900">Allergies &amp; medical</h2>
        {editable && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setItem({ id: null, data: { ...EMPTY_ITEM } })}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        )}
      </div>
      {health.items.length === 0 ? (
        <Card padding="none" className="mb-4">
          <EmptyState icon={<HeartPulse className="w-7 h-7" />} title="No health records" description={editable ? 'Add allergies, medications, dietary needs, or conditions.' : undefined} />
        </Card>
      ) : (
        <div className="space-y-2 mb-4">
          {health.items.map((h) => {
            const meta = KIND_META[h.kind];
            const Icon = meta.icon;
            const severe = h.severity === 'severe';
            return (
              <Card key={h.id} className={severe ? 'border-red-200 bg-red-50/40' : ''}>
                <div className="flex items-start gap-3">
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${severe ? 'text-red-500' : 'text-gray-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{h.name}</span>
                      <Badge tone="neutral" size="sm">{meta.label}</Badge>
                      {h.severity && <Badge tone={SEVERITY_TONE[h.severity] ?? 'neutral'} size="sm">{h.severity}</Badge>}
                    </div>
                    {h.detail && <p className="text-xs text-gray-500 mt-0.5">{h.detail}</p>}
                    {(h.rescueMed || h.rescueMedLocation || h.rescueMedExpires) && (
                      <p className="text-xs text-gray-500 mt-1">
                        {h.rescueMed && <span className="font-medium text-gray-700">{h.rescueMed}</span>}
                        {h.rescueMedLocation ? ` · ${h.rescueMedLocation}` : ''}
                        {h.rescueMedExpires ? ` · exp ${h.rescueMedExpires}` : ''}
                      </p>
                    )}
                  </div>
                  {editable && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => setItem({ id: h.id, data: { kind: h.kind, name: h.name, detail: h.detail, severity: h.severity, rescueMed: h.rescueMed, rescueMedLocation: h.rescueMedLocation, rescueMedExpires: h.rescueMedExpires } })} className="text-gray-300 hover:text-gray-600" aria-label="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm(`Remove ${h.name}?`)) startTransition(() => deleteHealthItem(childId, h.id).then(() => router.refresh())); }} className="text-gray-300 hover:text-red-500" aria-label="Remove">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Physicians */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-900">Physicians</h2>
        {editable && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setPhys({ id: null, data: { ...EMPTY_PHYS } })}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        )}
      </div>
      {health.physicians.length === 0 ? (
        <Card padding="compact"><p className="text-sm text-gray-400">No physicians on file.</p></Card>
      ) : (
        <div className="space-y-2">
          {health.physicians.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start gap-3">
                <Stethoscope className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    {[p.practice, p.phone].filter(Boolean).join(' · ')}
                    {p.lastVisit ? ` · last visit ${p.lastVisit}` : ''}
                  </p>
                </div>
                {editable && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setPhys({ id: p.id, data: { name: p.name, practice: p.practice, phone: p.phone, lastVisit: p.lastVisit } })} className="text-gray-300 hover:text-gray-600" aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { if (confirm(`Remove ${p.name}?`)) startTransition(() => deletePhysician(childId, p.id).then(() => router.refresh())); }} className="text-gray-300 hover:text-red-500" aria-label="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Health item modal */}
      <Modal open={!!item} onOpenChange={(o) => { if (!o) setItem(null); }} title={item?.id ? 'Edit health record' : 'Add health record'}>
        {item && (
          <>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="mb-1">Type</Label><Select value={item.data.kind} onChange={(e) => setItem({ ...item, data: { ...item.data, kind: e.target.value as HealthKind } })}>{KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></div>
                <div><Label className="mb-1">Severity</Label><Select value={item.data.severity} onChange={(e) => setItem({ ...item, data: { ...item.data, severity: e.target.value as HealthSeverity } })}>{SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></div>
              </div>
              <div><Label className="mb-1">Name</Label><Input value={item.data.name} onChange={(e) => setItem({ ...item, data: { ...item.data, name: e.target.value } })} placeholder="e.g. Peanuts, Albuterol" autoFocus /></div>
              <div><Label className="mb-1">Detail</Label><Textarea rows={2} value={item.data.detail} onChange={(e) => setItem({ ...item, data: { ...item.data, detail: e.target.value } })} /></div>
              {showRescue && (
                <div className="grid grid-cols-1 gap-3 pt-1 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="mb-1">Rescue medication</Label><Input value={item.data.rescueMed} onChange={(e) => setItem({ ...item, data: { ...item.data, rescueMed: e.target.value } })} placeholder="EpiPen Jr." /></div>
                    <div><Label className="mb-1">Expires</Label><Input type="date" value={item.data.rescueMedExpires} onChange={(e) => setItem({ ...item, data: { ...item.data, rescueMedExpires: e.target.value } })} /></div>
                  </div>
                  <div><Label className="mb-1">Location</Label><Input value={item.data.rescueMedLocation} onChange={(e) => setItem({ ...item, data: { ...item.data, rescueMedLocation: e.target.value } })} placeholder="Front office cabinet" /></div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setItem(null)} disabled={pending}>Cancel</Button>
              <Button onClick={saveItem} disabled={pending || !item.data.name.trim()}>{pending ? 'Saving…' : 'Save'}</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Physician modal */}
      <Modal open={!!phys} onOpenChange={(o) => { if (!o) setPhys(null); }} title={phys?.id ? 'Edit physician' : 'Add physician'}>
        {phys && (
          <>
            <div className="p-5 space-y-3">
              <div><Label className="mb-1">Name</Label><Input value={phys.data.name} onChange={(e) => setPhys({ ...phys, data: { ...phys.data, name: e.target.value } })} autoFocus /></div>
              <div><Label className="mb-1">Practice</Label><Input value={phys.data.practice} onChange={(e) => setPhys({ ...phys, data: { ...phys.data, practice: e.target.value } })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="mb-1">Phone</Label><Input value={phys.data.phone} onChange={(e) => setPhys({ ...phys, data: { ...phys.data, phone: e.target.value } })} /></div>
                <div><Label className="mb-1">Last visit</Label><Input type="date" value={phys.data.lastVisit} onChange={(e) => setPhys({ ...phys, data: { ...phys.data, lastVisit: e.target.value } })} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setPhys(null)} disabled={pending}>Cancel</Button>
              <Button onClick={savePhys} disabled={pending || !phys.data.name.trim()}>{pending ? 'Saving…' : 'Save'}</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
