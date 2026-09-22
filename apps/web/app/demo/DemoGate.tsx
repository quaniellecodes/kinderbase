'use client';

import { useEffect, useState } from 'react';

// Passcode / invite gate shown before the demo stage (docs/sessions/06 §6).
export function DemoGate({ invite }: { invite?: string }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(body: { passcode?: string; invite?: string }) {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/demo/gate/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      location.replace('/demo');
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setError(data.error ?? 'Something went wrong.');
    setBusy(false);
  }

  // A valid invite link logs the viewer straight in.
  useEffect(() => {
    if (invite) void submit({ invite });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite]);

  return (
    <div className="min-h-screen bg-[#eceae4] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
        <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center text-xl mb-4">🐣</div>
        <h1 className="text-lg font-semibold text-gray-900">KinderBase demo</h1>
        <p className="text-sm text-gray-500 mt-1">Enter the passcode you were given to explore the app.</p>

        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (passcode.trim() && !busy) void submit({ passcode });
          }}
        >
          <input
            autoFocus
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Passcode"
            className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          {error && <p className="text-[12px] text-status-red mt-2">{error}</p>}
          <button
            type="submit"
            disabled={!passcode.trim() || busy}
            className="w-full mt-3 rounded-lg bg-brand text-white text-sm font-semibold py-2.5 disabled:opacity-40"
          >
            {busy ? 'Checking…' : 'Enter demo'}
          </button>
        </form>

        <p className="text-[11px] text-gray-400 mt-4">Sample data only — no real children, families, or staff.</p>
      </div>
    </div>
  );
}
