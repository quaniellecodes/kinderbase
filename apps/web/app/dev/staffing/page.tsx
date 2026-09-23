import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { getActiveContextFromCookies } from '@/lib/session/active-context';
import { getClock } from '@/lib/clock';
import { loadRoomInput } from '@/lib/staffing/room-state';
import { evaluate, nextAgeTransition, mixText, BAND_LABEL, COMAR_VERSION } from '@kinderbase/core';
import { DevClock } from './DevClock';

// Debug harness (docs/sessions/01-ENGINE.md §6) — DEMO_MODE only.
export default async function DevStaffingPage() {
  if (process.env.DEMO_MODE !== 'true') notFound();

  const active = getActiveContextFromCookies();
  const clock = getClock();
  const now = clock.now();
  // datetime-local wants local "YYYY-MM-DDTHH:mm"
  const localInput = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (!active) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-lg font-medium mb-2">Staffing engine — debug</h1>
        <p className="text-sm text-gray-500">Sign in to the dashboard first so an active center context exists, then return here.</p>
      </div>
    );
  }

  const service = createServiceClient();
  const { data: rooms } = await service
    .from('classrooms')
    .select('id, name')
    .eq('center_id', active.centerId)
    .is('deleted_at', null)
    .order('name');

  const evals = await Promise.all(
    (rooms ?? []).map(async (r) => {
      const input = await loadRoomInput(r.id, clock, service);
      if (!input) return null;
      const e = evaluate(input);
      const t = nextAgeTransition(input);
      return { name: r.name, input, e, t };
    }),
  );

  const cell = 'px-3 py-2 align-top';
  const statusColor: Record<string, string> = { ok: 'text-status-green', at_minimum: 'text-status-amber', out: 'text-status-red' };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-lg font-medium text-gray-900">Staffing engine — debug</h1>
      <p className="text-xs text-gray-400 mb-4">{active.centerName} · COMAR {COMAR_VERSION} · now {now.toLocaleString()}</p>
      <DevClock current={localInput} />

      <div className="overflow-x-auto border border-gray-100 rounded-card bg-white">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
            <tr>
              <th className={cell}>Room</th>
              <th className={cell}>Mix</th>
              <th className={cell}>Governing rule</th>
              <th className={cell}>Req / present</th>
              <th className={cell}>Lead</th>
              <th className={cell}>Nap</th>
              <th className={cell}>Status</th>
              <th className={cell}>Next transition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {evals.filter(Boolean).map((row, i) => {
              const { name, input, e, t } = row!;
              return (
                <tr key={i}>
                  <td className={`${cell} font-medium text-gray-900`}>{name}</td>
                  <td className={`${cell} text-gray-600`}>{mixText(e.mix)}</td>
                  <td className={cell}>
                    <div className="text-gray-900">{e.rule.name}</div>
                    <div className="text-[11px] text-gray-400">{e.rule.citation}</div>
                  </td>
                  <td className={cell}>
                    <span className={input.staff.length < e.requiredNow ? 'text-status-red font-medium' : 'text-gray-900'}>
                      {e.requiredNow} / {input.staff.length}
                    </span>
                  </td>
                  <td className={cell}>{e.leadsPresent.length ? '✓' : e.checks.find((c) => c.key === 'lead')!.pass ? 'waived' : '✗'}</td>
                  <td className={`${cell} text-gray-600`}>{input.napState}</td>
                  <td className={`${cell} font-medium ${statusColor[e.status]}`}>{e.status.replace('_', ' ')}</td>
                  <td className={`${cell} text-[11px] text-gray-500`}>
                    {t ? `${BAND_LABEL[t.to]} in ${t.inDays}d → needs ${t.after.minStaff}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">
        Reads live attendance + assignments + nap events through the engine. Change the demo clock to re-evaluate.
      </p>
    </div>
  );
}
