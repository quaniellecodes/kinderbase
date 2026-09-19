'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Tablet, Hash, ImageIcon, X } from 'lucide-react';
import { updateBrandColor, setStaffPin, uploadIcon, removeIcon } from './actions';

type StaffPin = {
  id: string;
  full_name: string;
  kiosk_pin: string | null;
};

type Props = {
  orgId: string;
  centerId: string;
  initialColor: string;
  initialIconUrl: string | null;
  staffPins: StaffPin[];
};

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

function PinRow({ member }: { member: StaffPin }) {
  const [pin, setPin] = useState(member.kiosk_pin ?? '');
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const value = pin.trim() === '' ? null : pin.trim();
    startTransition(async () => {
      await setStaffPin(member.id, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex-1 text-sm text-gray-900 truncate">{member.full_name}</span>
      <input
        type="text"
        inputMode="numeric"
        maxLength={4}
        placeholder="—"
        value={pin}
        onChange={e => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4);
          setPin(v);
          setSaved(false);
        }}
        className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-1.5 font-mono text-center focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      <button
        onClick={handleSave}
        disabled={isPending || (pin.length > 0 && pin.length < 4)}
        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
          saved ? 'bg-green-500 text-white' : 'bg-brand text-white'
        }`}
      >
        {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}

export function SettingsClient({ orgId, centerId, initialColor, initialIconUrl, staffPins }: Props) {
  const [color, setColor] = useState(initialColor);
  const [iconUrl, setIconUrl] = useState<string | null>(initialIconUrl);
  const [iconPending, startIconTransition] = useTransition();
  const [colorPending, startColorTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleColorChange(val: string) {
    setColor(val);
    document.documentElement.style.setProperty('--color-brand-rgb', hexToRgb(val));
  }

  function handleColorSave() {
    startColorTransition(() => updateBrandColor(orgId, color));
  }

  function handleIconFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    startIconTransition(async () => {
      const result = await uploadIcon(orgId, formData);
      setIconUrl(result.url);
      router.refresh();
    });
  }

  function handleRemoveIcon() {
    startIconTransition(async () => {
      await removeIcon(orgId);
      setIconUrl(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Center icon */}
      <div className="bg-white rounded-card border border-gray-100 px-4 py-4">
        <h2 className="text-sm font-medium text-gray-900 mb-1">Center icon</h2>
        <p className="text-xs text-gray-400 mb-4">
          Appears in the browser tab and next to your center name in the sidebar. PNG or SVG, under 2MB.
        </p>
        <div className="flex items-center gap-4">
          {iconUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={iconUrl}
                alt="Center icon"
                className="w-14 h-14 rounded-xl object-contain border border-gray-100"
              />
              <button
                onClick={handleRemoveIcon}
                disabled={iconPending}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 rounded-full flex items-center justify-center text-white hover:bg-gray-900 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="w-14 h-14 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-gray-300" />
            </div>
          )}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleIconFile(file);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={iconPending}
              className="text-sm border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:border-gray-300 transition-colors disabled:opacity-50"
            >
              {iconPending ? 'Uploading…' : iconUrl ? 'Replace icon' : 'Upload icon'}
            </button>
          </div>
        </div>
      </div>

      {/* Brand color */}
      <div className="bg-white rounded-card border border-gray-100 px-4 py-4">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Brand color</h2>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={e => handleColorChange(e.target.value)}
            className="w-10 h-10 rounded-lg cursor-pointer border border-gray-200"
          />
          <input
            type="text"
            value={color}
            onChange={e => handleColorChange(e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <button
            onClick={handleColorSave}
            disabled={colorPending}
            className="text-sm bg-brand text-white px-4 py-2 rounded-lg font-medium disabled:opacity-60"
          >
            Save
          </button>
        </div>
        <div className="mt-3 h-8 rounded-lg" style={{ backgroundColor: color }} />
      </div>

      {/* Kiosk mode */}
      <div className="bg-white rounded-card border border-gray-100 px-4 py-4">
        <h2 className="text-sm font-medium text-gray-900 mb-1">Kiosk mode</h2>
        <p className="text-xs text-gray-400 mb-4">
          Lock this device into a dedicated view for staff clock-in. Staff enter their 4-digit PIN to clock in or out.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => router.push('/kiosk?mode=staff')}
            className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3 text-left hover:border-gray-300 transition-colors"
          >
            <Tablet className="w-5 h-5 text-brand flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">Staff sign-in</p>
              <p className="text-xs text-gray-400">Staff enter their PIN to clock in or out</p>
            </div>
          </button>
          <button
            onClick={() => router.push('/kiosk?mode=parent')}
            className="flex items-center gap-3 border border-gray-200 rounded-lg px-4 py-3 text-left hover:border-gray-300 transition-colors opacity-50 cursor-not-allowed"
            disabled
          >
            <Tablet className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">Parent sign-in</p>
              <p className="text-xs text-gray-400">Coming in a future session</p>
            </div>
          </button>
        </div>
      </div>

      {/* Staff PINs */}
      {staffPins.length > 0 && (
        <div className="bg-white rounded-card border border-gray-100 px-4 py-4">
          <div className="flex items-center gap-2 mb-1">
            <Hash className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-medium text-gray-900">Kiosk PINs</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Assign a 4-digit PIN to each staff member. Leave blank to disable kiosk access for that person.
          </p>
          <div className="divide-y divide-gray-100">
            {staffPins.map(m => (
              <PinRow key={m.id} member={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
