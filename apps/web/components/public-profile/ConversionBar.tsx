'use client';

import { useState } from 'react';
import { Button, buttonVariants, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';

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
          <Button
            onClick={() => setShowModal(true)}
            className="flex-shrink-0 min-h-[44px] px-4 py-0 rounded-[10px] whitespace-nowrap"
          >
            Claim profile
          </Button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2">
          Powered by KinderBase
        </p>
      </div>

      {/* Claim modal */}
      <Modal open={showModal} onOpenChange={setShowModal} title="Claim your profile">
        <p className="text-sm text-gray-500 mt-2">
          Create a KinderBase account to manage your credentials, share your profile, and receive expiration alerts.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <a
            href="/signup"
            className={cn(buttonVariants({ variant: 'primary' }), 'w-full min-h-[44px] rounded-[10px]')}
          >
            Create account
          </a>
          <a
            href="/login"
            className={cn(buttonVariants({ variant: 'secondary' }), 'w-full min-h-[44px] rounded-[10px]')}
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
      </Modal>
    </>
  );
}
