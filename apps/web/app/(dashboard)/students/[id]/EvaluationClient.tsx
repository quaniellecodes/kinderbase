'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ClipboardList, AlertTriangle, MessageSquarePlus, Target } from 'lucide-react';
import { Card, Modal, Button, Input, Textarea, Select, Label, Badge, Alert, EmptyState } from '@/components/ui';
import { cn } from '@/lib/utils';
import { createReferral, setReferralStage, addReferralInput, addPlanGoal, type EvaluationData, type Referral } from './evaluation-actions';
import { STAGE_FLOW, STAGE_LABELS, type ReferralStage } from './evaluation-constants';

const PLAN_STAGES: ReferralStage[] = ['eligible', 'services_active', 'closed'];

function StageTracker({ stage }: { stage: ReferralStage }) {
  if (stage === 'not_eligible') {
    return <Badge tone="neutral" size="sm">Not eligible</Badge>;
  }
  const currentIdx = STAGE_FLOW.indexOf(stage);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {STAGE_FLOW.map((s, i) => (
        <span
          key={s}
          className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-chip',
            i < currentIdx ? 'bg-green-50 text-green-700' : i === currentIdx ? 'bg-brand text-white' : 'bg-gray-100 text-gray-400',
          )}
        >
          {STAGE_LABELS[s]}
        </span>
      ))}
    </div>
  );
}

export function EvaluationClient({ childId, data }: { childId: string; data: EvaluationData }) {
  const router = useRouter();
  const editable = data.canEdit;
  const [pending, startTransition] = useTransition();
  const [newRef, setNewRef] = useState<{ concernSummary: string; isPartC: boolean; agency: string } | null>(null);
  const [input, setInput] = useState<{ referralId: string; body: string; observationIds: string[] } | null>(null);
  const [plan, setPlan] = useState<{ referralId: string; goalText: string; strategy: string } | null>(null);
  const [error, setError] = useState('');

  function run(fn: () => Promise<void>, onDone?: () => void) {
    setError('');
    startTransition(async () => {
      try {
        await fn();
        onDone?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  }

  return (
    <div>
      {data.turning3?.soon && (
        <Alert tone="amber" className="mb-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Turning 3 on {data.turning3.date} — begin the Part C → Part B transition (IFSP to IEP / Child Find) at least 90 days ahead.</span>
        </Alert>
      )}

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-900">Evaluation &amp; referrals</h2>
        {editable && (
          <Button size="sm" className="gap-1" onClick={() => setNewRef({ concernSummary: '', isPartC: data.partByAge === 'C', agency: data.suggestedAgency })}>
            <Plus className="w-3.5 h-3.5" /> Start referral
          </Button>
        )}
      </div>

      {data.referrals.length === 0 ? (
        <Card padding="none">
          <EmptyState icon={<ClipboardList className="w-7 h-7" />} title="No referrals" description={editable ? 'Start a referral when a developmental concern needs follow-up.' : 'No active referrals.'} />
        </Card>
      ) : (
        <div className="space-y-3">
          {data.referrals.map((r) => (
            <ReferralCard
              key={r.id}
              r={r}
              editable={editable}
              pending={pending}
              onStage={(stage) => run(() => setReferralStage(childId, r.id, stage))}
              onAddInput={() => setInput({ referralId: r.id, body: '', observationIds: [] })}
              onAddPlan={() => setPlan({ referralId: r.id, goalText: '', strategy: '' })}
            />
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {/* New referral modal */}
      <Modal open={!!newRef} onOpenChange={(o) => { if (!o) setNewRef(null); }} title="Start referral">
        {newRef && (
          <>
            <div className="p-5 space-y-3">
              <div><Label className="mb-1">Concern</Label><Textarea rows={3} value={newRef.concernSummary} onChange={(e) => setNewRef({ ...newRef, concernSummary: e.target.value })} placeholder="Describe the developmental concern" autoFocus /></div>
              <div><Label className="mb-1">Program</Label>
                <Select value={newRef.isPartC ? 'C' : 'B'} onChange={(e) => setNewRef({ ...newRef, isPartC: e.target.value === 'C', agency: e.target.value === 'C' ? 'Maryland Infants & Toddlers Program (MITP)' : 'Local school system Child Find' })}>
                  <option value="C">Part C — Early Intervention (birth–3)</option>
                  <option value="B">Part B — Preschool Special Ed (3–5)</option>
                </Select>
              </div>
              <div><Label className="mb-1">Agency</Label><Input value={newRef.agency} onChange={(e) => setNewRef({ ...newRef, agency: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setNewRef(null)} disabled={pending}>Cancel</Button>
              <Button onClick={() => run(() => createReferral(childId, newRef), () => setNewRef(null))} disabled={pending || !newRef.concernSummary.trim()}>{pending ? 'Saving…' : 'Create'}</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Contribute input modal */}
      <Modal open={!!input} onOpenChange={(o) => { if (!o) setInput(null); }} title="Contribute input">
        {input && (
          <>
            <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
              <div><Label className="mb-1">Input for the evaluation team</Label><Textarea rows={3} value={input.body} onChange={(e) => setInput({ ...input, body: e.target.value })} autoFocus /></div>
              {data.observations.length > 0 && (
                <div>
                  <Label className="mb-1">Attach observations</Label>
                  <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-100 rounded-lg p-2">
                    {data.observations.map((o) => {
                      const checked = input.observationIds.includes(o.id);
                      return (
                        <label key={o.id} className="flex items-center gap-2 text-sm text-gray-700">
                          <input type="checkbox" checked={checked} onChange={(e) => setInput({ ...input, observationIds: e.target.checked ? [...input.observationIds, o.id] : input.observationIds.filter((x) => x !== o.id) })} />
                          <span className="truncate">{o.title} <span className="text-gray-400">· {o.observedOn}</span></span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setInput(null)} disabled={pending}>Cancel</Button>
              <Button onClick={() => run(() => addReferralInput(childId, input.referralId, { body: input.body, observationIds: input.observationIds }), () => setInput(null))} disabled={pending || !input.body.trim()}>{pending ? 'Saving…' : 'Submit'}</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Plan goal modal */}
      <Modal open={!!plan} onOpenChange={(o) => { if (!o) setPlan(null); }} title="Add plan goal">
        {plan && (
          <>
            <div className="p-5 space-y-3">
              <div><Label className="mb-1">Goal</Label><Textarea rows={2} value={plan.goalText} onChange={(e) => setPlan({ ...plan, goalText: e.target.value })} autoFocus /></div>
              <div><Label className="mb-1">Strategy</Label><Textarea rows={2} value={plan.strategy} onChange={(e) => setPlan({ ...plan, strategy: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <Button variant="ghost" onClick={() => setPlan(null)} disabled={pending}>Cancel</Button>
              <Button onClick={() => run(() => addPlanGoal(childId, plan.referralId, { goalText: plan.goalText, strategy: plan.strategy }), () => setPlan(null))} disabled={pending || !plan.goalText.trim()}>{pending ? 'Saving…' : 'Add'}</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

function ReferralCard({
  r,
  editable,
  pending,
  onStage,
  onAddInput,
  onAddPlan,
}: {
  r: Referral;
  editable: boolean;
  pending: boolean;
  onStage: (stage: ReferralStage) => void;
  onAddInput: () => void;
  onAddPlan: () => void;
}) {
  const showPlan = PLAN_STAGES.includes(r.stage);
  return (
    <Card>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge tone={r.isPartC ? 'purple' : 'sky'} size="sm">{r.isPartC ? 'Part C (0–3)' : 'Part B (3–5)'}</Badge>
          {r.agency && <span className="text-xs text-gray-500">{r.agency}</span>}
        </div>
        <span className="text-xs text-gray-400">raised {r.raisedOn}</span>
      </div>

      <p className="text-sm text-gray-700 mb-2">{r.concernSummary}</p>

      <StageTracker stage={r.stage} />

      {editable && (
        <div className="flex items-center gap-2 mt-2">
          <Label className="mb-0 text-xs">Stage</Label>
          <Select value={r.stage} onChange={(e) => onStage(e.target.value as ReferralStage)} disabled={pending} className="w-auto text-xs py-1">
            {(Object.keys(STAGE_LABELS) as ReferralStage[]).map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </Select>
        </div>
      )}

      {(r.evaluationOn || r.planStart || r.referredOn) && (
        <p className="text-xs text-gray-400 mt-2">
          {[r.referredOn && `referred ${r.referredOn}`, r.evaluationOn && `eval ${r.evaluationOn}`, r.planStart && `plan started ${r.planStart}`].filter(Boolean).join(' · ')}
        </p>
      )}

      {/* Inputs */}
      <div className="mt-3 pt-3 border-t border-gray-50">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Input</h3>
          <button onClick={onAddInput} className="inline-flex items-center gap-1 text-xs text-brand font-medium"><MessageSquarePlus className="w-3.5 h-3.5" /> Contribute</button>
        </div>
        {r.inputs.length === 0 ? (
          <p className="text-xs text-gray-400">No input submitted yet.</p>
        ) : (
          <div className="space-y-1.5">
            {r.inputs.map((i) => (
              <div key={i.id} className="text-sm text-gray-700">
                <p>{i.body}</p>
                <p className="text-xs text-gray-400">{i.author}{i.observationCount ? ` · ${i.observationCount} observation${i.observationCount > 1 ? 's' : ''} attached` : ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plan goals */}
      {showPlan && (
        <div className="mt-3 pt-3 border-t border-gray-50">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan ({r.planType || (r.isPartC ? 'IFSP' : 'IEP')})</h3>
            {editable && <button onClick={onAddPlan} className="inline-flex items-center gap-1 text-xs text-brand font-medium"><Target className="w-3.5 h-3.5" /> Add goal</button>}
          </div>
          {r.planGoals.length === 0 ? (
            <p className="text-xs text-gray-400">No plan goals yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {r.planGoals.map((g) => (
                <li key={g.id} className="text-sm text-gray-700">
                  {g.goalText}
                  {g.strategy && <span className="block text-xs text-gray-400">Strategy: {g.strategy}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
