'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarX, X } from 'lucide-react';
import { Modal, Button, Textarea, Label, toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { reportAbsence, cancelAbsence } from '@/app/(parent)/p/actions';
import type { AbsenceEntry, AbsenceReason } from '@/lib/parent/absences';

const REASONS: { key: AbsenceReason; label: string }[] = [
  { key: 'sick', label: 'Out sick' },
  { key: 'vacation', label: 'Vacation' },
  { key: 'appointment', label: 'Appointment' },
  { key: 'other', label: 'Other' },
];

// Absence reporting (PARENT-DECISIONS §6): one tap to tell staff a child will be out
// on a day. Shows the child's upcoming reported absences with a cancel.
export function AbsencePanel({ childFirst, upcoming, todayIso, tomorrowIso }: { childFirst: string; upcoming: AbsenceEntry[]; todayIso: string; tomorrowIso: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIso);
  const [reason, setReason] = useState<AbsenceReason>('sick');
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();

  function submit() {
    if (pending) return;
    start(async () => {
      try {
        await reportAbsence(date, reason, note);
        toast('Absence reported — the office has been notified');
        setOpen(false);
        setNote('');
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not report the absence');
      }
    });
  }

  function cancel(id: string) {
    start(async () => {
      try {
        await cancelAbsence(id);
        toast('Absence cancelled');
        router.refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not cancel');
      }
    });
  }

  return (
    <section>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Attendance</p>

      {upcoming.length > 0 && (
        <div className="space-y-2 mb-2">
          {upcoming.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl p-3">
              <span className="text-base flex-shrink-0">🤒</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-gray-900">{a.dateLabel} · out</p>
                <p className="text-[11px] text-gray-500">{REASONS.find((r) => r.key === a.reason)?.label}{a.note ? ` · ${a.note}` : ''}</p>
              </div>
              <button onClick={() => cancel(a.id)} disabled={pending} aria-label="Cancel absence" className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-status-red flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => { setDate(todayIso); setReason('sick'); setNote(''); setOpen(true); }}
        className="flex items-center justify-center gap-2 w-full text-[13px] font-semibold text-brand bg-brand/10 rounded-xl py-3"
      >
        <CalendarX className="w-4 h-4" />
        Report an absence
      </button>

      <Modal open={open} onOpenChange={setOpen} title={`Report ${childFirst} absent`} size="sm">
        <div className="space-y-3">
          <div>
            <Label>Which day?</Label>
            <div className="flex gap-1.5 mt-1 mb-2">
              {[{ v: todayIso, l: 'Today' }, { v: tomorrowIso, l: 'Tomorrow' }].map((q) => (
                <button key={q.v} onClick={() => setDate(q.v)} className={cn('flex-1 py-1.5 rounded-lg text-[13px] font-semibold border', date === q.v ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-600')}>
                  {q.l}
                </button>
              ))}
            </div>
            <input
              type="date"
              value={date}
              min={todayIso}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          <div>
            <Label>Reason</Label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {REASONS.map((r) => (
                <button key={r.key} onClick={() => setReason(r.key)} className={cn('py-2 rounded-lg text-[13px] font-semibold border', reason === r.key ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-600')}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Anything the teachers should know" />
          </div>

          <Button className="w-full" disabled={pending || !date} onClick={submit}>Report absence</Button>
        </div>
      </Modal>
    </section>
  );
}
