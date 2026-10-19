import { notFound } from 'next/navigation';
import { formatDate } from '@/lib/format';
import { getParentGoal } from '@/lib/parent/progress';
import { ProgressDetailShell } from '@/components/parent/ProgressDetailShell';

export const dynamic = 'force-dynamic';

export default async function ParentGoalPage({ params }: { params: { domain: string; goalId: string } }) {
  const goal = await getParentGoal(params.goalId);
  if (!goal) notFound();

  return (
    <ProgressDetailShell icon={goal.icon} title={goal.label} subtitle={goal.domainName} colour={goal.colour}>
      {goal.steps.length > 0 && (
        <>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">How this usually grows</p>
          <div className="mb-5">
            {goal.steps.map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex flex-col items-center flex-shrink-0">
                  <span className="w-7 h-7 rounded-full border-2 mt-0.5" style={{ borderColor: `${goal.colour}66` }} />
                  {i < goal.steps.length - 1 && <span className="w-0.5 flex-1 min-h-[16px] bg-gray-200 my-1" />}
                </div>
                <p className="text-[14px] text-gray-800 pt-1.5 pb-3 leading-snug">{s}</p>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-[13px] text-gray-500 mb-5 leading-relaxed">Your teachers update this at each checkpoint, a few times a year.</div>
        </>
      )}

      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">What we saw</p>
      {goal.observations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-[13px] text-gray-500">Nothing written down for this one yet.</div>
      ) : (
        <div className="space-y-2">
          {goal.observations.map((o) => (
            <div key={o.id} className="bg-white border border-gray-100 rounded-xl p-3">
              <p className="text-[11px] text-gray-500 mb-0.5"><span className="font-semibold text-gray-700">{o.author}</span> · {formatDate(o.on)}</p>
              <p className="text-[13px] text-gray-900 leading-relaxed">{o.body}</p>
            </div>
          ))}
        </div>
      )}
    </ProgressDetailShell>
  );
}
