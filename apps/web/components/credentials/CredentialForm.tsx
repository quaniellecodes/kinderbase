'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { CREDENTIAL_TYPE_LABELS, type CredentialType } from '@kinderbase/types';
import { scanDocument, isNative } from '@/lib/mobile/capacitor';
import { createCredential } from '@/app/(dashboard)/credentials/actions';

type Props = {
  onSuccess: () => void;
  onCancel: () => void;
};

export function CredentialForm({ onSuccess, onCancel }: Props) {
  const [credentialType, setCredentialType] = useState<CredentialType>('first_aid_cpr');
  const [customTypeName, setCustomTypeName] = useState('');
  const [issuingOrg, setIssuingOrg] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [noExpiration, setNoExpiration] = useState(false);
  const [showOnProfile, setShowOnProfile] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleCameraScan() {
    const dataUrl = await scanDocument();
    if (!dataUrl) return;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const scanned = new File([blob], 'scanned-credential.jpg', { type: 'image/jpeg' });
    setFile(scanned);
    setFileName('scanned-credential.jpg');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setFileName(selected.name);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError('Please attach a document.'); return; }
    setError(null);
    setSubmitting(true);

    const formData = new FormData();
    formData.set('credential_type', credentialType);
    formData.set('custom_type_name', customTypeName);
    formData.set('issuing_org', issuingOrg);
    formData.set('issued_at', issuedAt);
    formData.set('expires_at', noExpiration ? '' : expiresAt);
    formData.set('show_on_profile', String(showOnProfile));
    formData.set('file', file);

    const result = await createCredential(formData);
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Credential type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Credential type
        </label>
        <select
          value={credentialType}
          onChange={e => setCredentialType(e.target.value as CredentialType)}
          className="w-full rounded-[10px] border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          {(Object.entries(CREDENTIAL_TYPE_LABELS) as [CredentialType, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {credentialType === 'other' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Custom name
          </label>
          <input
            type="text"
            value={customTypeName}
            onChange={e => setCustomTypeName(e.target.value)}
            required
            placeholder="e.g. Mandated Reporter Training"
            className="w-full rounded-[10px] border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      )}

      {/* Issuing org */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Issuing organization
        </label>
        <input
          type="text"
          value={issuingOrg}
          onChange={e => setIssuingOrg(e.target.value)}
          required
          placeholder="e.g. American Red Cross"
          className="w-full rounded-[10px] border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date issued
          </label>
          <input
            type="date"
            value={issuedAt}
            onChange={e => setIssuedAt(e.target.value)}
            required
            className="w-full rounded-[10px] border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expiration date
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
            disabled={noExpiration}
            className="w-full rounded-[10px] border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-40 disabled:bg-gray-50"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={noExpiration}
          onChange={e => { setNoExpiration(e.target.checked); if (e.target.checked) setExpiresAt(''); }}
          className="rounded border-gray-300 text-brand focus:ring-brand"
        />
        This credential does not expire
      </label>

      {/* File upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Document
        </label>
        <div className="flex gap-2">
          {isNative && (
            <button
              type="button"
              onClick={handleCameraScan}
              className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-[10px] border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Camera className="w-4 h-4" />
              Scan
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-h-[44px] flex items-center justify-center gap-2 rounded-[10px] border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
        {fileName && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-chip px-3 py-2">
            <span className="flex-1 truncate">{fileName}</span>
            <button type="button" onClick={() => { setFile(null); setFileName(''); }}>
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        )}
      </div>

      {/* Show on profile */}
      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={showOnProfile}
          onChange={e => setShowOnProfile(e.target.checked)}
          className="rounded border-gray-300 text-brand focus:ring-brand"
        />
        Show on public profile
      </label>

      {error && <p className="text-sm text-status-red">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 min-h-[44px] rounded-[10px] border border-gray-200 text-sm font-medium text-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 min-h-[44px] rounded-[10px] bg-brand text-white text-sm font-medium disabled:opacity-60"
        >
          {submitting ? 'Saving…' : 'Save credential'}
        </button>
      </div>
    </form>
  );
}
