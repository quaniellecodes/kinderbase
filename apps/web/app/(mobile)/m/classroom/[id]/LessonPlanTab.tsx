'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Check } from 'lucide-react';
import { BottomSheet } from '@/components/mobile/BottomSheet';
import { Badge, Button, ProgressBar, toast, type BadgeTone } from '@/components/ui';
import { cn } from '@/lib/utils';
import { savePlanDay, copyLastWeek, submitPlan, type LessonPlan, type PlanDay } from '../actions';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const CIRCLE_PARTS = ['Greeting', 'Songs', 'Read Aloud', 'Music & Movement'];
const STATUS: Record<LessonPlan['status'], { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft · due Mon 8 AM', tone: 'amber' },
  submitted: { label: 'Submitted ✓', tone: 'green' },
  returned: { label: 'Returned · see comment', tone: 'red' },
  approved: { label: 'Approved', tone: 'green' },
};
type Section = 'question' | 'circle' | 'outdoor' | 'stations';

function dayFill(d: PlanDay): number {
  return (d.question ? 1 : 0) + (d.circleNotes || d.circleParts.length ? 1 : 0) + (d.outdoor ? 1 : 0) + (d.stations.some((s) => s) ? 1 : 0);
}

export function LessonPlanTab({ plan }: { plan: LessonPlan }) {
  const router = useRouter();
  const [dayIdx, setDayIdx] = useState(0);
  const [edit, setEdit] = useState<{ section: Section; draft: PlanDay } | null>(null);
  const [pending, start] = useTransition();

  const day = plan.days[dayIdx]!;
  const st = STATUS[plan.status];

  function save() {
    if (!edit) return;
    const { section, draft } = edit;
    const patch: Partial<PlanDay> =
      section === 'question' ? { question: draft.question }
        : section === 'circle' ? { circleParts: draft.circleParts, circleNotes: draft.circleNotes }
          : section === 'outdoor' ? { outdoor: draft.outdoor }
            : { stations: draft.stations };
    start(async () => {
      await savePlanDay(plan.classroomId, day.day, patch);
      setEdit(null);
      router.refresh();
      toast('Saved');
    });
  }
  function doCopy() {
    start(async () => {
      await copyLastWeek(plan.classroomId);
      router.refresh();
      toast('Filled incomplete days — edit what changed');
    });
  }
  function doSubmit() {
    start(async () => {
      const res = await submitPlan(plan.classroomId);
      if (!res.ok) return toast(res.message ?? 'Cannot submit yet');
      router.refresh();
      toast('Submitted — now in your director’s inbox');
    });
  }

  const Section = ({ section, emoji, title, filled, children }: { section: Section; emoji: string; title: string; filled: boolean; children: React.ReactNode }) => (
    <button
      disabled={!plan.canEdit}
      onClick={() => setEdit({ section, draft: { ...day, stations: [...day.stations], circleParts: [...day.circleParts] } })}
      className={cn('w-full text-left rounded-card border border-gray-100 bg-white p-3 mb-2', plan.canEdit && 'active:bg-gray-50')}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{emoji}</span>
        <span className="text-[13px] font-semibold text-gray-900 flex-1">{title}</span>
        {plan.canEdit && <Pencil className="w-3.5 h-3.5 text-gray-300" />}
      </div>
      <div className={cn('text-[12px]', filled ? 'text-gray-700' : 'text-gray-300 italic')}>{children}</div>
    </button>
  );

  return (
    <div className="p-4">
      {!plan.canEdit && (
        <div className="rounded-lg bg-indigo-50 text-indigo-900 text-[12px] px-3 py-2 mb-3">
          {plan.status === 'draft' || plan.status === 'returned' ? "Read-only — only the room's lead edits the plan." : 'This plan is submitted and read-only.'}
        </div>
      )}

      <div className="rounded-card border border-gray-100 bg-white p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-semibold text-gray-900">Week of {plan.weekOf}</span>
          <Badge tone={st.tone} size="sm">{st.label}</Badge>
        </div>
        {plan.status === 'returned' && plan.reviewComment && (
          <div className="rounded bg-red-50 text-red-800 text-[12px] px-2.5 py-2 mb-2"><b>Reviewer:</b> {plan.reviewComment}</div>
        )}
        <div className="grid grid-cols-4 gap-2 text-center">
          <Meta label="Theme" value={plan.theme || '—'} span />
          <Meta label="Letter" value={plan.letter || '—'} />
          <Meta label="Number" value={plan.number || '—'} />
          <Meta label="Shape" value={plan.shape || '—'} />
        </div>
        {plan.status !== 'submitted' && plan.status !== 'approved' && (
          <>
            <ProgressBar value={(plan.filled / plan.total) * 100} tone="brand" className="mt-3" />
            <p className="text-[11px] text-gray-400 mt-1">{plan.filled} of 20 blocks filled</p>
          </>
        )}
      </div>

      <div className="flex gap-1.5 mb-3">
        {DAY_LABELS.map((l, i) => {
          const f = dayFill(plan.days[i]!);
          return (
            <button key={l} onClick={() => setDayIdx(i)}
              className={cn('flex-1 rounded-lg py-2 text-center border', i === dayIdx ? 'bg-brand border-brand text-white' : 'bg-white border-gray-100')}>
              <div className="text-[11px] font-bold">{l[0]}</div>
              <div className={cn('text-[9px]', i === dayIdx ? 'text-white/80' : f === 4 ? 'text-green-600 font-semibold' : 'text-gray-400')}>{f}/4</div>
            </button>
          );
        })}
      </div>

      <Section section="question" emoji="❓" title="Question of the Day" filled={!!day.question}>{day.question || 'Tap to add'}</Section>
      <Section section="circle" emoji="🎵" title="Circle Time" filled={!!(day.circleNotes || day.circleParts.length)}>
        <div className="flex flex-wrap gap-1 mb-1">
          {CIRCLE_PARTS.map((p) => <span key={p} className={cn('text-[9px] px-1.5 py-0.5 rounded', day.circleParts.includes(p) ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-50 text-gray-400')}>{p}</span>)}
        </div>
        {day.circleNotes || 'Tap to add'}
      </Section>
      <Section section="outdoor" emoji="🌳" title="Outdoor / Activities" filled={!!day.outdoor}>{day.outdoor || 'Tap to add'}</Section>
      <Section section="stations" emoji="🧩" title="Small Group Stations" filled={day.stations.some((s) => s)}>
        {day.stations.map((s, i) => <div key={i}>{i + 1}. {s || <span className="text-gray-300 italic">Tap to add</span>}</div>)}
      </Section>

      {plan.canEdit && (
        <div className="flex gap-2 mt-3">
          <Button variant="secondary" className="flex-1" onClick={doCopy} disabled={pending}>Copy last week</Button>
          <Button className="flex-1" onClick={doSubmit} disabled={pending}>{plan.status === 'returned' ? 'Resubmit' : 'Submit plan'}</Button>
        </div>
      )}

      {/* Edit sheet */}
      <BottomSheet open={!!edit} onClose={() => setEdit(null)} title={edit ? sectionTitle(edit.section) + ' · ' + DAY_LABELS[dayIdx] : ''}>
        {edit && (
          <div className="space-y-3 pb-2">
            {edit.section === 'question' && (
              <textarea autoFocus rows={2} value={edit.draft.question} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, question: e.target.value } })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" placeholder="Question of the day" />
            )}
            {edit.section === 'circle' && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {CIRCLE_PARTS.map((p) => {
                    const on = edit.draft.circleParts.includes(p);
                    return <button key={p} onClick={() => setEdit({ ...edit, draft: { ...edit.draft, circleParts: on ? edit.draft.circleParts.filter((x) => x !== p) : [...edit.draft.circleParts, p] } })}
                      className={cn('text-[11px] px-2.5 py-1 rounded-full border', on ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-gray-200 text-gray-500')}>{p}</button>;
                  })}
                </div>
                <textarea rows={2} value={edit.draft.circleNotes} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, circleNotes: e.target.value } })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" placeholder="Books, songs, movement…" />
              </>
            )}
            {edit.section === 'outdoor' && (
              <textarea autoFocus rows={2} value={edit.draft.outdoor} onChange={(e) => setEdit({ ...edit, draft: { ...edit.draft, outdoor: e.target.value } })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" placeholder="Outdoor / gross-motor activity" />
            )}
            {edit.section === 'stations' && edit.draft.stations.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-gray-400 w-4">{i + 1}</span>
                <input value={s} onChange={(e) => { const next = [...edit.draft.stations]; next[i] = e.target.value; setEdit({ ...edit, draft: { ...edit.draft, stations: next } }); }}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2" placeholder={`Station ${i + 1}`} />
              </div>
            ))}
            <Button className="w-full gap-1.5" onClick={save} disabled={pending}><Check className="w-4 h-4" /> {pending ? 'Saving…' : 'Save'}</Button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function sectionTitle(s: Section): string {
  return s === 'question' ? 'Question of the Day' : s === 'circle' ? 'Circle Time' : s === 'outdoor' ? 'Outdoor' : 'Stations';
}
function Meta({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={cn('rounded-lg bg-gray-50 border border-gray-100 py-1.5', span && 'col-span-1')}>
      <div className="text-[9px] text-gray-400">{label}</div>
      <div className="text-[13px] font-semibold text-brand truncate px-1">{value}</div>
    </div>
  );
}
