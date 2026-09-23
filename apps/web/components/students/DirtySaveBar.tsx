'use client';

import { Button } from '@/components/ui';

/**
 * Sticky action bar shown while a dirty-form has unsaved changes. Renders
 * nothing when clean, so callers can mount it unconditionally.
 */
export function DirtySaveBar({
  count,
  saving,
  onDiscard,
  onSave,
}: {
  count: number;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky top-0 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-2.5 mb-3 bg-white/95 backdrop-blur border-b border-amber-200 flex items-center justify-between">
      <p className="text-sm text-amber-800">
        {count} unsaved change{count === 1 ? '' : 's'}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={saving}>
          Discard
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}
