'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Stethoscope, History } from 'lucide-react';
import { Card, Modal, Button, Input, Textarea, Select, Label, Badge, EmptyState, type BadgeTone } from '@/components/ui';
import { recordScreening, type StudentScreenings, type Screening, type ScreeningOutcome } from './screening-actions';

const OUTCOME_META: Record<ScreeningOutcome, { label: string; tone: BadgeTone }> = {
  pass: { label: 'Pass', tone: 'green' },
  refer: { label: 'Refer', tone: 'red' },
  rescreen: { label: 'Rescreen', tone: 'amber' },
  scheduled: { label: 'Scheduled', tone: 'blue' },
};
const OUTCOME_OPTIONS = (Object.keys(OUTCOME_META) as ScreeningOutcome[]).map((o) => ({ value: o, label: OUTCOME_META[o].label }));

type Draft = { instrument: string; intervalLabel: string; resultSummary: string; outcome: ScreeningOutcome; administeredOn: string; dueOn: string; supersedesId?: string };
const EMPTY: Draft = { instrument: '', intervalLabel: '', resultSummary: '', outcome: 'pass', administeredOn: new Date().toISOString().slice(0, 10), dueOn: '' };

function Row({ s, canEdit, onCorrect, muted }: { s: Screening; canEdit: boolean; onCorrect: () => void; muted?: boolean }) {
  const o = OUTCOME_META[s.outcome];
  return (
    <div className={`px-4 py-3 ${muted ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{s.instrument}</span>
          {s.intervalLabel && <span className="text-xs text-gray-400">{s.intervalLabel}</span>}
          <Badge tone={o.tone} size="sm">{o.label}</Badge>
        </div>
        {canEdit && !muted && (
          <button onClick={onCorrect} className="text-xs text-brand font-medium">Correct</button>
        )}
      </div>
      {s.resultSummary && <p className="text-sm text-gray-600 mt-0.5">{s.resultSummary}</p>}
      <p className="text-xs text-gray-400 mt-0.5">
        {[s.administeredOn && `administered ${s.administeredOn}`, s.administeredBy, s.dueOn && `next due ${s.dueOn}`].filter(Boolean).join(' · ')}
      </p>
    </div>
  );
}

export function ScreeningClient({ childId, data }: { childId: string; data: StudentScreenings }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function save() {
    if (!draft) return;
    setError('');
    startTransition(async () => {
      try {
        await recordScreening(childId, draft);
        setDraft(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not record screening');
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-900">Developmental screening</h2>
        {data.canEdit && (
          <Button size="sm" className="gap-1" onClick={() => setDraft({ ...EMPTY })}>
            <Plus className="w-3.5 h-3.5" /> Record result
          </Button>
        )}
      </div>

      {data.current.length === 0 ? (
        <Card padding="none">
          <EmptyState icon={<Stethoscope className="w-7 h-7" />} title="No screenings recorded" description={data.canEdit ? 'Record ASQ, M-CHAT, or other screening results.' : undefined} />
        </Card>
      ) : (
        <Card padding="none" className="divide-y divide-gray-50">
          {data.current.map((s) => (
            <Row key={s.id} s={s} canEdit={data.canEdit} onCorrect={() => setDraft({ instrument: s.instrument, intervalLabel: s.intervalLabel, resultSummary: s.resultSummary, outcome: s.outcome, administeredOn: s.administeredOn || EMPTY.administeredOn, dueOn: s.dueOn, supersedesId: s.id })} />
          ))}
        </Card>
      )}

      {data.history.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowHistory((v) => !v)} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600">
            <History className="w-3.5 h-3.5" /> {showHistory ? 'Hide' : 'Show'} corrected history ({data.history.length})
          </button>
          {showHistory && (
            <Card padding="none" className="divide-y divide-gray-50 mt-2">
              {data.history.map((s) => (
                <Row key={s.id} s={s} canEdit={false} onCorrect={() => {}} muted />
              ))}
            </Card>
          )}
        </div>
      )}

      <Modal open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null); }} title={draft?.supersedesId ? 'Correct screening result' : 'Record screening result'}>
        {draft && (
          <>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="mb-1">Instrument</Label><Input value={draft.instrument} onChange={(e) => setDraft({ ...draft, instrument: e.target.value })} placeholder="ASQ-3" autoFocus /></div>
                <div><Label className="mb-1">Interval</Label><Input value={draft.intervalLabel} onChange={(e) => setDraft({ ...draft, intervalLabel: e.target.value })} placeholder="24 month" /></div>
              </div>
              <div><Label className="mb-1">Outcome</Label><Select value={draft.outcome} onChange={(e) => setDraft({ ...draft, outcome: e.target.value as ScreeningOutcome })}>{OUTCOME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></div>
              <div><Label className="mb-1">Result summary</Label><Textarea rows={2} value={draft.resultSummary} onChange={(e) => setDraft({ ...draft, resultSummary: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="mb-1">Administered on</Label><Input type="date" value={draft.administeredOn} onChange={(e) => setDraft({ ...draft, administeredOn: e.target.value })} /></div>
                <div><Label className="mb-1">Next due</Label><Input type="date" value={draft.dueOn} onChange={(e) => setDraft({ ...draft, dueOn: e.target.value })} /></div>
              </div>
              {draft.supersedesId && <p className="text-xs text-gray-400">Records a new result and marks the previous one corrected (kept in history).</p>}
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={pending}>Cancel</Button>
              <Button onClick={save} disabled={pending || !draft.instrument.trim()}>{pending ? 'Saving…' : 'Record'}</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
