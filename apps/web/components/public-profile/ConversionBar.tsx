'use client';

import { useState } from 'react';

type Props = {
  name: string;
  handle: string;
};

export function ConversionBar({ name }: Props) {
  const [showModal, setShowModal] = useState(false);
  const firstName = name.split(' ')[0];

  return (
    <>
      {/* Sticky bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              Are you {firstName}?
            </p>
            <p className="text-xs text-gray-500">
              Claim this profile to manage your credentials.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex-shrink-0 min-h-[44px] px-4 rounded-[10px] bg-brand text-white text-sm font-medium whitespace-nowrap"
          >
            Claim profile
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2">
          Powered by KinderBase
        </p>
      </div>

      {/* Claim modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-[14px] w-full max-w-sm p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-medium text-gray-900">Claim your profile</h2>
            <p className="text-sm text-gray-500 mt-2">
              Create a KinderBase account to manage your credentials, share your profile, and receive expiration alerts.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <a
                href="/signup"
                className="w-full min-h-[44px] flex items-center justify-center rounded-[10px] bg-brand text-white text-sm font-medium"
              >
                Create account
              </a>
              <a
                href="/login"
                className="w-full min-h-[44px] flex items-center justify-center rounded-[10px] border border-gray-200 text-sm font-medium text-gray-700"
              >
                Sign in
              </a>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 w-full text-xs text-gray-400 text-center"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </>
  );
}
