'use client';

import { useState, useTransition } from 'react';
import { Lock } from 'lucide-react';
import { kioskClockIn, kioskClockOut, kioskLookupPin } from './actions';

type StaffMember = {
  id: string;
  full_name: string;
  isClockedIn: boolean;
};

type Props = {
  centerId: string;
  centerName: string;
  brandRgb: string;
};

type ConfirmState = {
  member: StaffMember;
};

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

const PAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const;

export function KioskScreen({ centerId, centerName, brandRgb }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleKey(key: string) {
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
      setError('');
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    setError('');

    if (next.length === 4) {
      startTransition(async () => {
        const result = await kioskLookupPin(next, centerId);
        if (!result) {
          setError('PIN not found. Try again.');
          setPin('');
          return;
        }
        setPin('');
        setConfirm({ member: result });
      });
    }
  }

  function handleConfirm() {
    if (!confirm) return;
    const { member } = confirm;
    setConfirm(null);
    startTransition(async () => {
      if (member.isClockedIn) {
        await kioskClockOut(member.id, centerId);
      } else {
        await kioskClockIn(member.id, centerId);
      }
    });
  }

  return (
    <div
      className="fixed inset-0 bg-gray-50 flex flex-col overflow-hidden select-none"
      style={{ '--color-brand-rgb': brandRgb } as React.CSSProperties}
    >
      {/* Header */}
      <div className="bg-brand px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-lg font-medium text-white">{centerName}</h1>
          <p className="text-xs text-white/70 mt-0.5">Enter your 4-digit PIN to clock in or out</p>
        </div>
        <button
          className="text-white/50 p-2 cursor-default"
          aria-label="Kiosk locked"
        >
          <Lock className="w-5 h-5" />
        </button>
      </div>

      {/* PIN entry area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4">
        {/* Dots */}
        <div className="flex gap-4">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full border-2 transition-all ${
                i < pin.length
                  ? 'bg-brand border-brand'
                  : 'bg-transparent border-gray-300'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-500 font-medium -mt-4">{error}</p>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
          {PAD_KEYS.map((key, i) => {
            if (key === '') return <div key={i} />;
            return (
              <button
                key={i}
                onClick={() => handleKey(key)}
                disabled={isPending || (key !== '⌫' && pin.length >= 4)}
                className={`h-16 rounded-2xl text-xl font-medium transition-all active:scale-95 disabled:opacity-40 ${
                  key === '⌫'
                    ? 'bg-gray-200 text-gray-700'
                    : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
                }`}
              >
                {key}
              </button>
            );
          })}
        </div>
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex flex-col items-center text-center gap-3 mb-6">
              <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center text-xl font-medium text-white">
                {getInitials(confirm.member.full_name)}
              </div>
              <div>
                <p className="text-base font-medium text-gray-900">{confirm.member.full_name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {confirm.member.isClockedIn ? 'Clock out now?' : 'Clock in now?'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-600 text-sm py-3 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className={`flex-1 text-white text-sm py-3 rounded-xl font-medium disabled:opacity-60 ${
                  confirm.member.isClockedIn ? 'bg-red-500' : 'bg-green-500'
                }`}
              >
                {confirm.member.isClockedIn ? 'Clock out' : 'Clock in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
